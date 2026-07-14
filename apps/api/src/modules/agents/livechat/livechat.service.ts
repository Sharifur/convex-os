import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { eq, ne, sql, desc, and, inArray, gte, isNull, isNotNull } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import {
  livechatSites,
  livechatVisitors,
  livechatPageviews,
  livechatSessions,
  livechatMessages,
  livechatOperators,
  livechatKbGaps,
  livechatKbFlags,
} from './schema';
import { EnrichmentService, EnrichedVisitor } from '../../../common/visitor-enrichment/enrichment.service';
import { LivechatOriginCache } from './livechat-origin.cache';
import { ContactsService } from '../../contacts/contacts.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { SettingsService } from '../../settings/settings.service';

export type WidgetPosition = 'bottom-right' | 'bottom-left';

/** Real conversations are 5–30 visitor messages. Anything over this is abuse. */
export const MAX_VISITOR_MSGS_PER_SESSION = 100;
/** Default per-site agent-reply cap per day. Counter lives in Redis. */
export const DEFAULT_DAILY_AGENT_REPLY_CAP = 500;

export interface LivechatSiteRow {
  id: string;
  key: string;
  label: string;
  origin: string;
  enabled: boolean;
  productContext: string | null;
  replyTone: string | null;
  trackBots: boolean;
  autoApprove: boolean;
  operatorName: string | null;
  botName: string | null;
  botSubtitle: string | null;
  welcomeMessage: string | null;
  welcomeQuickReplies: string[];
  brandColor: string | null;
  position: WidgetPosition;
  llmProvider: string | null;
  llmModel: string | null;
  transcriptEnabled: boolean;
  transcriptBcc: string | null;
  transcriptFrom: string | null;
  humanAlertEmail: string | null;
  topicHandlingRules: string | null;
  requireEmail: boolean;
  widgetCacheBust: string | null;
  createdAt: Date;
}

export interface CreateSiteDto {
  key: string;
  label: string;
  origin: string;
  productContext?: string | null;
  replyTone?: string | null;
  trackBots?: boolean;
  autoApprove?: boolean;
  operatorName?: string | null;
  botName?: string | null;
  botSubtitle?: string | null;
  welcomeMessage?: string | null;
  welcomeQuickReplies?: string[] | string | null;
  brandColor?: string | null;
  position?: WidgetPosition;
  llmProvider?: string | null;
  llmModel?: string | null;
  transcriptEnabled?: boolean;
  transcriptBcc?: string | null;
  transcriptFrom?: string | null;
  humanAlertEmail?: string | null;
  topicHandlingRules?: string | null;
  requireEmail?: boolean;
}

export interface UpdateSiteDto {
  label?: string;
  origin?: string;
  enabled?: boolean;
  productContext?: string | null;
  replyTone?: string | null;
  trackBots?: boolean;
  autoApprove?: boolean;
  operatorName?: string | null;
  botName?: string | null;
  botSubtitle?: string | null;
  welcomeMessage?: string | null;
  welcomeQuickReplies?: string[] | string | null;
  brandColor?: string | null;
  position?: WidgetPosition;
  llmProvider?: string | null;
  llmModel?: string | null;
  transcriptEnabled?: boolean;
  transcriptBcc?: string | null;
  transcriptFrom?: string | null;
  humanAlertEmail?: string | null;
  topicHandlingRules?: string | null;
  requireEmail?: boolean;
}

export interface LivechatOperatorRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  isDefault: boolean;
  siteKeys: string[] | null;
  createdAt: Date;
}

export interface VisitorContext {
  site: LivechatSiteRow;
  visitorPk: string;
  isNew: boolean;
}

export interface SessionContext {
  sessionId: string;
  isNew: boolean;
}

@Injectable()
export class LivechatService implements OnModuleInit {
  private readonly logger = new Logger(LivechatService.name);

  private limitsCache: { perSession: number; dailyReply: number; expiresAt: number } | null = null;
  private readonly limitsCacheMs = 60_000;

  constructor(
    private db: DbService,
    private enrichment: EnrichmentService,
    private originCache: LivechatOriginCache,
    private contactsSvc: ContactsService,
    private kb: KnowledgeBaseService,
    private settings: SettingsService,
  ) {}

  onModuleInit() {
    // Fire-and-forget: backfill country data for visitors that connected before GeoIP was loaded.
    void this.backfillGeoCountries();
  }

  /** Settings-backed limits with 60s cache. Falls back to constants on error. */
  async getLimits(): Promise<{ perSession: number; dailyReply: number }> {
    if (this.limitsCache && this.limitsCache.expiresAt > Date.now()) return this.limitsCache;
    try {
      const [perSessionRaw, dailyRaw] = await Promise.all([
        this.settings.getDecrypted('livechat_per_session_msg_cap'),
        this.settings.getDecrypted('livechat_daily_agent_reply_cap'),
      ]);
      const parseInt10 = (v: string | null, fallback: number) => {
        if (!v) return fallback;
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : fallback;
      };
      this.limitsCache = {
        perSession: parseInt10(perSessionRaw, MAX_VISITOR_MSGS_PER_SESSION),
        dailyReply: parseInt10(dailyRaw, DEFAULT_DAILY_AGENT_REPLY_CAP),
        expiresAt: Date.now() + this.limitsCacheMs,
      };
    } catch {
      this.limitsCache = {
        perSession: MAX_VISITOR_MSGS_PER_SESSION,
        dailyReply: DEFAULT_DAILY_AGENT_REPLY_CAP,
        expiresAt: Date.now() + this.limitsCacheMs,
      };
    }
    return this.limitsCache;
  }

  /**
   * Upsert a Contact for a live-chat visitor and link the session row.
   * Identity rule: sourceRef is `${siteKey}:${visitorId}` (stable for the
   * visitor's localStorage UUID). Email/displayName are patched in when learned.
   */
  async upsertContactForLivechat(input: {
    siteKey: string;
    visitorId: string;
    websiteTag?: string | null;
    email?: string | null;
    displayName?: string | null;
  }): Promise<string> {
    const contact = await this.contactsSvc.upsertBySource({
      source: 'livechat',
      sourceRef: `${input.siteKey}:${input.visitorId}`,
      websiteTag: input.websiteTag ?? input.siteKey,
      email: input.email ?? null,
      displayName: input.displayName ?? null,
    });
    return contact.id;
  }

  async listSites(): Promise<LivechatSiteRow[]> {
    const rows = await this.db.db.select().from(livechatSites).orderBy(livechatSites.createdAt);
    return rows.map((r) => this.toSiteRow(r));
  }

  async getSiteById(id: string): Promise<LivechatSiteRow> {
    const [row] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.id, id));
    if (!row) throw new NotFoundException(`Live chat site not found: ${id}`);
    return this.toSiteRow(row);
  }

  async getSiteByKey(key: string): Promise<LivechatSiteRow | null> {
    const [row] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.key, key));
    return row ? this.toSiteRow(row) : null;
  }

  async getSiteByOrigin(origin: string): Promise<LivechatSiteRow | null> {
    const normalized = this.normalizeOrigin(origin);
    if (!normalized) return null;
    const [row] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.origin, normalized));
    return row ? this.toSiteRow(row) : null;
  }

  /** Validate that the request's Origin header matches the site row, then return the site.
   * Comparison is hostname-only so http:// and https:// variants of the same domain both pass.
   * When no origin/referer header is present (GET requests, proxies that strip headers), the
   * check is skipped — siteKey alone is treated as sufficient. */
  async resolveSiteForRequest(siteKey: string, requestOrigin: string | null | undefined): Promise<LivechatSiteRow> {
    const site = await this.getSiteByKey(siteKey);
    if (!site) throw new NotFoundException(`Unknown site: ${siteKey}`);
    if (!site.enabled) throw new ForbiddenException(`Site disabled: ${siteKey}`);
    const requestHostname = this.extractHostname(requestOrigin ?? null);
    if (requestHostname) {
      if (!site.origin) {
        this.logger.warn(`Site ${siteKey} has no origin configured — origin check skipped.`);
      } else if (!this.originMatchesSite(requestHostname, site.origin)) {
        this.logger.warn(`Origin mismatch for site ${siteKey}: received '${requestOrigin}', allowed '${site.origin}'`);
        throw new ForbiddenException('Origin not allowed');
      }
    }
    return site;
  }

  /** Upsert a visitor row, refreshing enrichment fields and lastSeenAt. */
  async upsertVisitor(input: {
    siteId: string;
    visitorId: string;
    enrichment: EnrichedVisitor;
  }): Promise<VisitorContext['visitorPk']> {
    const enriched = input.enrichment;
    const enrichedFields = {
      lastSeenAt: new Date(),
      ip: enriched.ip,
      ipCountry: enriched.country,
      ipCountryName: enriched.countryName,
      ipRegion: enriched.region,
      ipCity: enriched.city,
      ipLat: enriched.lat,
      ipLon: enriched.lon,
      ipTimezone: enriched.timezone,
      uaRaw: enriched.uaRaw,
      browserName: enriched.browserName,
      browserVersion: enriched.browserVersion,
      osName: enriched.osName,
      osVersion: enriched.osVersion,
      deviceType: enriched.deviceType,
      deviceBrand: enriched.deviceBrand,
      deviceModel: enriched.deviceModel,
      language: enriched.language,
    };
    const [row] = await this.db.db
      .insert(livechatVisitors)
      .values({ siteId: input.siteId, visitorId: input.visitorId, ...enrichedFields })
      .onConflictDoUpdate({
        target: [livechatVisitors.siteId, livechatVisitors.visitorId],
        set: enrichedFields,
      })
      .returning({ id: livechatVisitors.id });
    return row.id;
  }

  /** Insert a pageview row + bump visitor.totalPageviews + update session.currentPage if a session exists. */
  async recordPageview(input: {
    siteId: string;
    visitorPk: string;
    visitorId: string;
    sessionId: string | null;
    url: string;
    path: string | null;
    title: string | null;
    referrer: string | null;
  }): Promise<{ pageviewId: string }> {
    const [{ count }] = await this.db.db
      .select({ count: sql<number>`count(*)::int` })
      .from(livechatPageviews)
      .where(eq(livechatPageviews.visitorPk, input.visitorPk));

    const [pv] = await this.db.db
      .insert(livechatPageviews)
      .values({
        visitorPk: input.visitorPk,
        sessionId: input.sessionId,
        url: input.url,
        path: input.path,
        title: input.title,
        referrer: input.referrer,
        seq: (count ?? 0) + 1,
      })
      .returning({ id: livechatPageviews.id });

    await this.db.db
      .update(livechatVisitors)
      .set({ totalPageviews: sql`${livechatVisitors.totalPageviews} + 1`, lastSeenAt: new Date() })
      .where(eq(livechatVisitors.id, input.visitorPk));

    if (input.sessionId) {
      await this.db.db
        .update(livechatSessions)
        .set({ currentPageUrl: input.url, currentPageTitle: input.title, lastSeenAt: new Date() })
        .where(eq(livechatSessions.id, input.sessionId));
    }

    return { pageviewId: pv.id };
  }

  async recordPageviewLeave(pageviewId: string): Promise<void> {
    const [pv] = await this.db.db
      .select({ arrivedAt: livechatPageviews.arrivedAt, leftAt: livechatPageviews.leftAt })
      .from(livechatPageviews)
      .where(eq(livechatPageviews.id, pageviewId))
      .limit(1);
    if (!pv || pv.leftAt) return;
    const now = new Date();
    const durationMs = Math.max(0, now.getTime() - pv.arrivedAt.getTime());
    await this.db.db
      .update(livechatPageviews)
      .set({ leftAt: now, durationMs })
      .where(eq(livechatPageviews.id, pageviewId));
  }

  /** Get-or-create the open session for a visitor; on creation, bump visitor.totalSessions and upsert a Contact. */
  async getOrCreateSession(input: {
    siteId: string;
    siteKey: string;
    visitorPk: string;
    visitorId: string;
  }): Promise<SessionContext> {
    const [existing] = await this.db.db
      .select({ id: livechatSessions.id })
      .from(livechatSessions)
      .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)))
      .limit(1);
    if (existing) return { sessionId: existing.id, isNew: false };

    const contactId = await this.upsertContactForLivechat({
      siteKey: input.siteKey,
      visitorId: input.visitorId,
    });

    const [row] = await this.db.db
      .insert(livechatSessions)
      .values({
        siteId: input.siteId,
        visitorPk: input.visitorPk,
        visitorId: input.visitorId,
        contactId,
        status: 'open',
      })
      .returning({ id: livechatSessions.id });

    await this.db.db
      .update(livechatVisitors)
      .set({ totalSessions: sql`${livechatVisitors.totalSessions} + 1` })
      .where(eq(livechatVisitors.id, input.visitorPk));

    return { sessionId: row.id, isNew: true };
  }

  async setPageContext(sessionId: string, ctx: Record<string, unknown>): Promise<void> {
    await this.db.db
      .update(livechatSessions)
      .set({ pageContext: ctx })
      .where(eq(livechatSessions.id, sessionId));
  }

  async setVisitorIdentity(input: {
    siteId: string;
    siteKey: string;
    visitorId: string;
    email?: string | null;
    name?: string | null;
  }): Promise<void> {
    const set: Record<string, unknown> = { lastSeenAt: new Date() };
    if (input.email !== undefined) set.visitorEmail = input.email;
    if (input.name !== undefined) set.visitorName = input.name;
    if (Object.keys(set).length <= 1) return;
    await this.db.db
      .update(livechatSessions)
      .set(set)
      .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)));

    if (input.email || input.name) {
      const contactId = await this.upsertContactForLivechat({
        siteKey: input.siteKey,
        visitorId: input.visitorId,
        email: input.email ?? null,
        displayName: input.name ?? null,
      });
      await this.db.db
        .update(livechatSessions)
        .set({ contactId })
        .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)));
    }
  }

  async appendMessage(input: {
    sessionId: string;
    role: 'visitor' | 'agent' | 'operator' | 'system' | 'note';
    content: string;
    pendingApproval?: boolean;
    replyToId?: string | null;
    replyToContent?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<{ id: string; createdAt: Date; pendingApproval: boolean; duplicate?: boolean }> {
    // Dedupe identical visitor messages within a 5-second window.
    // Catches double-clicks, network retries, and the same content arriving
    // via two paths (REST + email-to-thread) at near-the-same time.
    if (input.role === 'visitor') {
      const fiveSecondsAgo = new Date(Date.now() - 5_000);
      const [recent] = await this.db.db
        .select({
          id: livechatMessages.id,
          createdAt: livechatMessages.createdAt,
          pendingApproval: livechatMessages.pendingApproval,
        })
        .from(livechatMessages)
        .where(
          and(
            eq(livechatMessages.sessionId, input.sessionId),
            eq(livechatMessages.role, 'visitor'),
            eq(livechatMessages.content, input.content),
            gte(livechatMessages.createdAt, fiveSecondsAgo),
          ),
        )
        .orderBy(desc(livechatMessages.createdAt))
        .limit(1);
      if (recent) {
        return { id: recent.id, createdAt: recent.createdAt, pendingApproval: recent.pendingApproval, duplicate: true };
      }

      // Per-session cap. Real conversations never approach this; a spammer
      // hammering one session does. Returns the duplicate-shape so the
      // public controller silently no-ops without leaking the cap to the
      // attacker. Cap is settings-driven (Settings → General).
      const limits = await this.getLimits();
      const [{ count }] = await this.db.db
        .select({ count: sql<number>`count(*)::int` })
        .from(livechatMessages)
        .where(and(eq(livechatMessages.sessionId, input.sessionId), eq(livechatMessages.role, 'visitor')));
      if ((count ?? 0) >= limits.perSession) {
        this.logger.warn(`session ${input.sessionId.slice(-8)} hit visitor message cap (${count}/${limits.perSession})`);
        return {
          id: 'capped',
          createdAt: new Date(),
          pendingApproval: false,
          duplicate: true,
        };
      }
    }

    const [row] = await this.db.db
      .insert(livechatMessages)
      .values({
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        pendingApproval: input.pendingApproval ?? false,
        replyToId: input.replyToId ?? null,
        replyToContent: input.replyToContent ?? null,
        metadata: input.metadata ?? null,
      })
      .returning({ id: livechatMessages.id, createdAt: livechatMessages.createdAt, pendingApproval: livechatMessages.pendingApproval });

    const [session] = await this.db.db
      .select({ visitorPk: livechatSessions.visitorPk, contactId: livechatSessions.contactId })
      .from(livechatSessions)
      .where(eq(livechatSessions.id, input.sessionId))
      .limit(1);

    if (session) {
      // Only visitor messages update lastSeenAt — operator/agent replies must not
      // reset the presence timestamp or they trigger false "visitor is online" state
      // and block the inactivity email that notifies the visitor of a new reply.
      if (input.role === 'visitor') {
        await this.db.db
          .update(livechatSessions)
          .set({ lastSeenAt: new Date() })
          .where(eq(livechatSessions.id, input.sessionId));
        await this.db.db
          .update(livechatVisitors)
          .set({ totalMessages: sql`${livechatVisitors.totalMessages} + 1`, lastSeenAt: new Date() })
          .where(eq(livechatVisitors.id, session.visitorPk));
      } else {
        await this.db.db
          .update(livechatVisitors)
          .set({ totalMessages: sql`${livechatVisitors.totalMessages} + 1` })
          .where(eq(livechatVisitors.id, session.visitorPk));
      }

      if (session.contactId && input.role === 'visitor') {
        await this.contactsSvc
          .addActivity(session.contactId, 'livechat_message', input.content.slice(0, 300), {
            refId: input.sessionId,
          })
          .catch((err) => this.logger.debug(`addActivity failed: ${(err as Error).message}`));
      }
    }
    return row;
  }

  async rateMessage(messageId: string, sessionId: string, rating: 'up' | 'down'): Promise<boolean> {
    // .returning() gives us a row array we can length-check; Drizzle's
    // postgres-js driver doesn't expose rowCount on the bare update result.
    const updated = await this.db.db
      .update(livechatMessages)
      .set({ visitorRating: rating })
      .where(and(eq(livechatMessages.id, messageId), eq(livechatMessages.sessionId, sessionId)))
      .returning({ id: livechatMessages.id });
    return updated.length > 0;
  }

  async markMessagesSeen(messageIds: string[], sessionId: string): Promise<string[]> {
    if (!messageIds.length) return [];
    const now = new Date();
    const updated = await this.db.db
      .update(livechatMessages)
      .set({ seenAt: now })
      .where(
        and(
          inArray(livechatMessages.id, messageIds),
          eq(livechatMessages.sessionId, sessionId),
          sql`${livechatMessages.seenAt} IS NULL`,
        ),
      )
      .returning({ id: livechatMessages.id });
    return updated.map((r) => r.id);
  }

  async markEmailOpenedForSession(sessionId: string): Promise<string[]> {
    const now = new Date();
    const updated = await this.db.db
      .update(livechatMessages)
      .set({ seenAt: now })
      .where(
        and(
          eq(livechatMessages.sessionId, sessionId),
          sql`${livechatMessages.metadata}->>'sentViaEmail' = 'true'`,
          isNull(livechatMessages.seenAt),
        ),
      )
      .returning({ id: livechatMessages.id });
    return updated.map((r) => r.id);
  }

  async getRecentMessages(sessionId: string, limit = 50) {
    // Exclude pending drafts — agent context should reflect what the visitor actually saw.
    return this.db.db
      .select()
      .from(livechatMessages)
      .where(and(eq(livechatMessages.sessionId, sessionId), eq(livechatMessages.pendingApproval, false)))
      .orderBy(desc(livechatMessages.createdAt))
      .limit(limit);
  }

  async getMessagesForSession(sessionId: string) {
    return this.db.db
      .select()
      .from(livechatMessages)
      .where(eq(livechatMessages.sessionId, sessionId))
      .orderBy(livechatMessages.createdAt);
  }

  async getSession(sessionId: string) {
    const [row] = await this.db.db
      .select()
      .from(livechatSessions)
      .where(eq(livechatSessions.id, sessionId))
      .limit(1);
    return row ?? null;
  }

  async getVisitor(visitorPk: string) {
    const [row] = await this.db.db
      .select()
      .from(livechatVisitors)
      .where(eq(livechatVisitors.id, visitorPk))
      .limit(1);
    return row ?? null;
  }

  async getVisitorForSession(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (!session) return null;
    return this.getVisitor(session.visitorPk);
  }

  async getRecentPageviews(visitorPk: string, limit = 5) {
    return this.db.db
      .select()
      .from(livechatPageviews)
      .where(eq(livechatPageviews.visitorPk, visitorPk))
      .orderBy(desc(livechatPageviews.arrivedAt))
      .limit(limit);
  }

  /** Dashboard-level stats: active sessions, needing human, today's count, pending drafts. */
  async sessionStats(): Promise<{ open: number; needsHuman: number; today: number; pendingDrafts: number }> {
    const [counts] = await this.db.db.execute<{
      open: number;
      needs_human: number;
      today: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('open','needs_human','human_taken_over'))::int AS open,
        COUNT(*) FILTER (WHERE status = 'needs_human')::int AS needs_human,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS today
      FROM livechat_sessions
    `);
    const [drafts] = await this.db.db
      .select({ count: sql<number>`count(*)::int` })
      .from(livechatMessages)
      .where(eq(livechatMessages.pendingApproval, true));
    return {
      open: counts?.open ?? 0,
      needsHuman: counts?.needs_human ?? 0,
      today: counts?.today ?? 0,
      pendingDrafts: drafts?.count ?? 0,
    };
  }

  /** Quick counters for the inbox header badge. */
  async pendingCounts(): Promise<{ sessions: number; drafts: number }> {
    const [drafts] = await this.db.db
      .select({ count: sql<number>`count(*)::int` })
      .from(livechatMessages)
      .where(eq(livechatMessages.pendingApproval, true));
    const [sessions] = await this.db.db
      .select({ count: sql<number>`count(distinct ${livechatMessages.sessionId})::int` })
      .from(livechatMessages)
      .where(eq(livechatMessages.pendingApproval, true));
    return { sessions: sessions?.count ?? 0, drafts: drafts?.count ?? 0 };
  }

  async getMessageById(id: string) {
    const [row] = await this.db.db.select().from(livechatMessages).where(eq(livechatMessages.id, id)).limit(1);
    return row ?? null;
  }

  async approveMessage(id: string): Promise<void> {
    await this.db.db
      .update(livechatMessages)
      .set({ pendingApproval: false })
      .where(eq(livechatMessages.id, id));
  }

  async deleteMessage(id: string): Promise<void> {
    await this.db.db.delete(livechatMessages).where(eq(livechatMessages.id, id));
  }

  async updateMessageContent(id: string, content: string): Promise<void> {
    await this.db.db.update(livechatMessages).set({ content }).where(eq(livechatMessages.id, id));
  }

  async setSessionStatus(sessionId: string, status: 'open' | 'human_taken_over' | 'needs_human' | 'closed'): Promise<void> {
    const extra: Record<string, unknown> = {};
    // Entering 'needs_human' starts a fresh wait: reset the timer AND the
    // alert flag so this waiting period is eligible for exactly one email.
    if (status === 'needs_human') { extra.needsHumanAt = new Date(); extra.humanAlertSentAt = null; }
    // Someone joined (or the chat reopened): wait time resets, clear both so a
    // later re-escalation is treated as a brand-new wait.
    if (status === 'human_taken_over' || status === 'open') { extra.needsHumanAt = null; extra.humanAlertSentAt = null; }
    await this.db.db
      .update(livechatSessions)
      .set({ status, lastSeenAt: new Date(), ...extra })
      .where(eq(livechatSessions.id, sessionId));
  }

  async markAfterHoursNoticeSent(sessionId: string): Promise<void> {
    await this.db.db
      .update(livechatSessions)
      .set({ afterHoursNoticeSentAt: new Date() })
      .where(eq(livechatSessions.id, sessionId));
  }

  async getQueuePosition(sessionId: string): Promise<number> {
    const rows = await this.db.db.execute(sql`
      SELECT COUNT(*)::int AS position
      FROM livechat_sessions
      WHERE site_id = (SELECT site_id FROM livechat_sessions WHERE id = ${sessionId})
        AND status = 'needs_human'
        AND needs_human_at <= (SELECT needs_human_at FROM livechat_sessions WHERE id = ${sessionId})
    `) as unknown as [{ position: number }];
    return rows[0]?.position ?? 0;
  }

  async listSessions(opts: { status?: string; siteKey?: string; hasPendingDrafts?: boolean; limit?: number; before?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const where: ReturnType<typeof eq>[] = [];
    if (opts.status) where.push(eq(livechatSessions.status, opts.status));

    let siteId: string | null = null;
    if (opts.siteKey) {
      const site = await this.getSiteByKey(opts.siteKey);
      if (!site) return [];
      siteId = site.id;
      where.push(eq(livechatSessions.siteId, siteId));
    }

    if (opts.hasPendingDrafts) {
      // Restrict to sessions with at least one pending draft. Subselect avoids
      // a DISTINCT ON over the join.
      const pendingSessionIds = await this.db.db
        .selectDistinct({ sessionId: livechatMessages.sessionId })
        .from(livechatMessages)
        .where(eq(livechatMessages.pendingApproval, true));
      const ids = pendingSessionIds.map((r) => r.sessionId);
      if (!ids.length) return [];
      where.push(inArray(livechatSessions.id, ids));
    }

    const rows = await this.db.db
      .select({
        id: livechatSessions.id,
        siteId: livechatSessions.siteId,
        siteKey: livechatSites.key,
        siteLabel: livechatSites.label,
        visitorPk: livechatSessions.visitorPk,
        visitorId: livechatSessions.visitorId,
        contactId: livechatSessions.contactId,
        visitorEmail: livechatSessions.visitorEmail,
        visitorName: livechatSessions.visitorName,
        status: livechatSessions.status,
        currentPageUrl: livechatSessions.currentPageUrl,
        currentPageTitle: livechatSessions.currentPageTitle,
        lastSeenAt: livechatSessions.lastSeenAt,
        createdAt: livechatSessions.createdAt,
        ipCountry: livechatVisitors.ipCountry,
        ipCity: livechatVisitors.ipCity,
        browserName: livechatVisitors.browserName,
        osName: livechatVisitors.osName,
        language: livechatVisitors.language,
      })
      .from(livechatSessions)
      .leftJoin(livechatVisitors, eq(livechatVisitors.id, livechatSessions.visitorPk))
      .leftJoin(livechatSites, eq(livechatSites.id, livechatSessions.siteId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(sql`
        CASE WHEN livechat_sessions.status = 'closed' THEN 1 ELSE 0 END ASC,
        (
          SELECT MAX(m.created_at) FROM livechat_messages m
          WHERE m.session_id = livechat_sessions.id AND m.pending_approval = false
        ) DESC NULLS LAST,
        livechat_sessions.last_seen_at DESC
      `)
      .limit(limit);

    const sessionIds = rows.map((r) => r.id);
    const allMessages = sessionIds.length
      ? await this.db.db
          .select({
            sessionId: livechatMessages.sessionId,
            role: livechatMessages.role,
            content: livechatMessages.content,
            createdAt: livechatMessages.createdAt,
            pendingApproval: livechatMessages.pendingApproval,
          })
          .from(livechatMessages)
          .where(inArray(livechatMessages.sessionId, sessionIds))
          .orderBy(desc(livechatMessages.createdAt))
      : [];

    const previewBySession = new Map<string, { role: string; content: string; createdAt: Date }>();
    const pendingCountBySession = new Map<string, number>();
    for (const p of allMessages) {
      // Last message preview ignores pending drafts (visitor never saw them).
      if (!previewBySession.has(p.sessionId) && !p.pendingApproval) {
        previewBySession.set(p.sessionId, { role: p.role, content: p.content.slice(0, 140), createdAt: p.createdAt });
      }
      if (p.pendingApproval) {
        pendingCountBySession.set(p.sessionId, (pendingCountBySession.get(p.sessionId) ?? 0) + 1);
      }
    }

    return rows.map((r) => ({
      ...r,
      lastMessage: previewBySession.get(r.id) ?? null,
      pendingDrafts: pendingCountBySession.get(r.id) ?? 0,
    }));
  }

  async getSessionDetail(sessionId: string) {
    const [session] = await this.db.db
      .select()
      .from(livechatSessions)
      .where(eq(livechatSessions.id, sessionId))
      .limit(1);
    if (!session) return null;

    const [visitor] = await this.db.db
      .select()
      .from(livechatVisitors)
      .where(eq(livechatVisitors.id, session.visitorPk))
      .limit(1);

    const messages = await this.getMessagesForSession(sessionId);

    return { session, visitor: visitor ?? null, messages };
  }

  /**
   * Bump the visitor's last_seen_at without inserting a pageview row.
   * Returns the active session id + previous URL so callers can decide
   * whether to push a `pageview` socket event for the operator UI.
   */
  async heartbeatVisitor(input: {
    siteId: string;
    visitorId: string;
    currentUrl?: string | null;
    currentTitle?: string | null;
  }): Promise<{ sessionId: string | null; previousUrl: string | null; previousTitle: string | null }> {
    await this.db.db
      .update(livechatVisitors)
      .set({ lastSeenAt: new Date() })
      .where(and(eq(livechatVisitors.siteId, input.siteId), eq(livechatVisitors.visitorId, input.visitorId)));

    // Read previous URL/title so the controller can decide whether to fan
    // out a pageview event when something actually changed.
    const [existing] = await this.db.db
      .select({
        id: livechatSessions.id,
        currentPageUrl: livechatSessions.currentPageUrl,
        currentPageTitle: livechatSessions.currentPageTitle,
      })
      .from(livechatSessions)
      .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)))
      .limit(1);

    if (input.currentUrl) {
      await this.db.db
        .update(livechatSessions)
        .set({ currentPageUrl: input.currentUrl, currentPageTitle: input.currentTitle ?? null, lastSeenAt: new Date() })
        .where(and(eq(livechatSessions.siteId, input.siteId), eq(livechatSessions.visitorId, input.visitorId)));
    }
    return {
      sessionId: existing?.id ?? null,
      previousUrl: existing?.currentPageUrl ?? null,
      previousTitle: existing?.currentPageTitle ?? null,
    };
  }

  /** All visitors seen in the last `windowSec` seconds, joined with their open session if any. */
  async listLiveVisitors(windowSec = 60) {
    const cutoff = new Date(Date.now() - windowSec * 1000);
    const rows = await this.db.db
      .select({
        visitorPk: livechatVisitors.id,
        visitorId: livechatVisitors.visitorId,
        siteId: livechatVisitors.siteId,
        siteKey: livechatSites.key,
        siteLabel: livechatSites.label,
        ipCountry: livechatVisitors.ipCountry,
        ipCity: livechatVisitors.ipCity,
        browserName: livechatVisitors.browserName,
        osName: livechatVisitors.osName,
        deviceType: livechatVisitors.deviceType,
        lastSeenAt: livechatVisitors.lastSeenAt,
        sessionId: livechatSessions.id,
        sessionStatus: livechatSessions.status,
        currentPageUrl: livechatSessions.currentPageUrl,
        currentPageTitle: livechatSessions.currentPageTitle,
        visitorEmail: livechatSessions.visitorEmail,
        visitorName: livechatSessions.visitorName,
      })
      .from(livechatVisitors)
      .leftJoin(
        livechatSessions,
        and(eq(livechatSessions.siteId, livechatVisitors.siteId), eq(livechatSessions.visitorId, livechatVisitors.visitorId)),
      )
      .leftJoin(livechatSites, eq(livechatSites.id, livechatVisitors.siteId))
      .where(gte(livechatVisitors.lastSeenAt, cutoff))
      .orderBy(desc(livechatVisitors.lastSeenAt))
      .limit(200);

    // Drop bot rows; UI never shows them.
    return rows.filter((r) => r.deviceType !== 'bot');
  }

  /** All past sessions for a visitor across time, with last-message preview + counts. */
  async getVisitorSessions(visitorPk: string, limit = 20) {
    const rows = await this.db.db
      .select({
        id: livechatSessions.id,
        siteId: livechatSessions.siteId,
        siteKey: livechatSites.key,
        siteLabel: livechatSites.label,
        status: livechatSessions.status,
        visitorEmail: livechatSessions.visitorEmail,
        visitorName: livechatSessions.visitorName,
        currentPageUrl: livechatSessions.currentPageUrl,
        currentPageTitle: livechatSessions.currentPageTitle,
        lastSeenAt: livechatSessions.lastSeenAt,
        createdAt: livechatSessions.createdAt,
      })
      .from(livechatSessions)
      .leftJoin(livechatSites, eq(livechatSites.id, livechatSessions.siteId))
      .where(eq(livechatSessions.visitorPk, visitorPk))
      .orderBy(desc(livechatSessions.lastSeenAt))
      .limit(limit);

    const sessionIds = rows.map((r) => r.id);
    const counts = sessionIds.length
      ? await this.db.db
          .select({
            sessionId: livechatMessages.sessionId,
            count: sql<number>`count(*)::int`,
          })
          .from(livechatMessages)
          .where(and(inArray(livechatMessages.sessionId, sessionIds), eq(livechatMessages.pendingApproval, false)))
          .groupBy(livechatMessages.sessionId)
      : [];
    const countBySession = new Map(counts.map((c) => [c.sessionId, c.count]));

    return rows.map((r) => ({ ...r, messageCount: countBySession.get(r.id) ?? 0 }));
  }

  async getVisitorPageviews(visitorPk: string, opts: { limit?: number; before?: string } = {}) {
    const limit = Math.min(opts.limit ?? 50, 500);
    return this.db.db
      .select()
      .from(livechatPageviews)
      .where(eq(livechatPageviews.visitorPk, visitorPk))
      .orderBy(desc(livechatPageviews.arrivedAt))
      .limit(limit);
  }

  private parseSiteKeys(raw: string | null): string[] | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
      return null;
    } catch {
      return null;
    }
  }

  private toOperatorRow(r: typeof livechatOperators.$inferSelect): LivechatOperatorRow {
    return {
      id: r.id,
      name: r.name,
      avatarUrl: r.avatarUrl,
      isDefault: r.isDefault,
      siteKeys: this.parseSiteKeys(r.siteKeys),
      createdAt: r.createdAt,
    };
  }

  async listOperators(): Promise<LivechatOperatorRow[]> {
    const rows = await this.db.db.select().from(livechatOperators).orderBy(livechatOperators.createdAt);
    return rows.map((r) => this.toOperatorRow(r));
  }

  async getOperatorById(id: string): Promise<LivechatOperatorRow | null> {
    const [row] = await this.db.db.select().from(livechatOperators).where(eq(livechatOperators.id, id)).limit(1);
    return row ? this.toOperatorRow(row) : null;
  }

  async createOperator(dto: {
    name: string;
    avatarUrl?: string | null;
    isDefault?: boolean;
    siteKeys?: string[] | null;
  }): Promise<LivechatOperatorRow> {
    if (dto.isDefault) {
      await this.db.db.update(livechatOperators).set({ isDefault: false });
    }
    const siteKeysRaw =
      Array.isArray(dto.siteKeys) && dto.siteKeys.length > 0 ? JSON.stringify(dto.siteKeys) : null;
    const [row] = await this.db.db
      .insert(livechatOperators)
      .values({
        name: dto.name,
        avatarUrl: dto.avatarUrl ?? null,
        isDefault: dto.isDefault ?? false,
        siteKeys: siteKeysRaw,
      })
      .returning();
    return this.toOperatorRow(row);
  }

  async updateOperator(
    id: string,
    dto: {
      name?: string;
      avatarUrl?: string | null;
      isDefault?: boolean;
      siteKeys?: string[] | null;
    },
  ): Promise<LivechatOperatorRow> {
    const [existing] = await this.db.db
      .select({ id: livechatOperators.id })
      .from(livechatOperators)
      .where(eq(livechatOperators.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException(`Operator not found: ${id}`);

    if (dto.isDefault) {
      await this.db.db.update(livechatOperators).set({ isDefault: false });
    }

    const set: Record<string, unknown> = {};
    if (dto.name !== undefined) set.name = dto.name;
    if (dto.avatarUrl !== undefined) set.avatarUrl = dto.avatarUrl;
    if (dto.isDefault !== undefined) set.isDefault = dto.isDefault;
    if (dto.siteKeys !== undefined) {
      set.siteKeys =
        Array.isArray(dto.siteKeys) && dto.siteKeys.length > 0 ? JSON.stringify(dto.siteKeys) : null;
    }

    const [row] = await this.db.db
      .update(livechatOperators)
      .set(set)
      .where(eq(livechatOperators.id, id))
      .returning();
    return this.toOperatorRow(row);
  }

  async deleteOperator(id: string): Promise<void> {
    const [existing] = await this.db.db
      .select({ id: livechatOperators.id })
      .from(livechatOperators)
      .where(eq(livechatOperators.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException(`Operator not found: ${id}`);
    await this.db.db.delete(livechatOperators).where(eq(livechatOperators.id, id));
  }

  async getOperatorsForSite(siteKey: string): Promise<LivechatOperatorRow[]> {
    const all = await this.listOperators();
    return all.filter((op) => {
      if (!op.siteKeys || op.siteKeys.length === 0) return true;
      return op.siteKeys.includes(siteKey);
    });
  }

  async createSite(dto: CreateSiteDto): Promise<LivechatSiteRow> {
    const key = dto.key?.trim().toLowerCase();
    const origin = this.normalizeOrigin(dto.origin);
    if (!key || !/^[a-z0-9_-]+$/.test(key)) {
      throw new BadRequestException('key must be lowercase alphanumeric with optional - or _');
    }
    if (!origin) throw new BadRequestException('origin must be a valid URL like https://example.com');
    if (!dto.label?.trim()) throw new BadRequestException('label is required');

    const existing = await this.getSiteByKey(key);
    if (existing) throw new BadRequestException(`Site key already exists: ${key}`);

    // Was this the very first live chat site? Used to gate global KB seeding.
    const [{ count: existingSiteCount }] = await this.db.db
      .select({ count: sql<number>`count(*)::int` })
      .from(livechatSites);

    const label = dto.label.trim();
    // Auto-fill site fields with sensible per-site defaults so a new chatbot
    // works the moment the snippet is pasted on the site, with no further
    // editing required. Operators can refine afterwards.
    const defaults = this.minimalSiteDefaults(label);

    const [row] = await this.db.db
      .insert(livechatSites)
      .values({
        key,
        label,
        origin,
        productContext: dto.productContext?.toString().trim() || null,
        replyTone: (dto.replyTone?.toString().trim()) || defaults.replyTone,
        trackBots: dto.trackBots ?? false,
        autoApprove: dto.autoApprove ?? true,
        botName: (dto.botName?.trim()) || defaults.botName,
        botSubtitle: (dto.botSubtitle?.trim()) || defaults.botSubtitle,
        welcomeMessage: (dto.welcomeMessage?.trim()) || defaults.welcomeMessage,
        welcomeQuickReplies: this.normalizeQuickReplies(dto.welcomeQuickReplies) || defaults.welcomeQuickReplies,
        brandColor: this.normalizeColor(dto.brandColor),
        position: this.normalizePosition(dto.position),
        llmProvider: dto.llmProvider?.trim() || null,
        llmModel: dto.llmModel?.trim() || null,
        transcriptEnabled: dto.transcriptEnabled ?? false,
        transcriptBcc: dto.transcriptBcc?.trim() || null,
        transcriptFrom: dto.transcriptFrom?.trim() || null,
        humanAlertEmail: dto.humanAlertEmail?.trim() || null,
        topicHandlingRules: dto.topicHandlingRules?.trim() || null,
        requireEmail: dto.requireEmail ?? false,
      })
      .returning();
    await this.originCache.refresh().catch(() => undefined);

    // Seed the shared `livechat` KB the first time *any* site is created.
    // The KB itself is shared across all live chat sites — voice profile and
    // generic facts apply to every site by default; per-site framing comes
    // from the site's productContext/replyTone columns.
    if ((existingSiteCount ?? 0) === 0) {
      await this.seedLivechatKbDefaults().catch((err) =>
        this.logger.warn(`KB seed failed (non-fatal): ${(err as Error).message}`),
      );
    }

    return this.toSiteRow(row);
  }

  /** Per-site placeholder text — used when the operator leaves the persona fields blank on create. */
  private minimalSiteDefaults(label: string): {
    botName: string;
    botSubtitle: string;
    welcomeMessage: string;
    welcomeQuickReplies: string;
    replyTone: string;
  } {
    return {
      botName: label,
      botSubtitle: 'We typically reply in a few seconds.',
      welcomeMessage: `Hi! I'm here to help — ask me anything about ${label}.`,
      welcomeQuickReplies: ['Pricing', 'How does it work?', 'Talk to a human'].join('\n'),
      replyTone: 'friendly, concise, and helpful — like a knowledgeable founder replying to a customer',
    };
  }

  /**
   * Idempotently seed the `livechat` KB with the minimal-viable starter set
   * so the agent has something to ground replies against on day one. Safe to
   * call multiple times — each insert is gated on a "marker" check.
   */
  private async seedLivechatKbDefaults(): Promise<void> {
    // Voice profile — only insert if no livechat-tagged voice_profile exists.
    const alwaysOn = await this.kb.getAlwaysOnContext('livechat').catch(() => [] as Awaited<ReturnType<typeof this.kb.getAlwaysOnContext>>);
    const hasVoice = alwaysOn.some((e) => e.entryType === 'voice_profile');
    if (!hasVoice) {
      await this.kb.createEntry({
        title: 'Live chat voice profile',
        content:
          'Direct, friendly, no corporate jargon. 2–4 sentences max. ' +
          'Reference the page the visitor is on when relevant. ' +
          'If you do not know the answer, say so plainly and offer to connect them with a human — never invent details.',
        category: 'general',
        entryType: 'voice_profile',
        priority: 100,
        agentKeys: 'livechat',
      });
      this.logger.log('Seeded livechat voice_profile');
    }

    // A couple of placeholder facts so the operator can see the structure
    // and replace them with real product info.
    const hasSeedFact = alwaysOn.some((e) => e.entryType === 'fact' && e.title?.startsWith('[seed]'));
    if (!hasSeedFact) {
      await this.kb.createEntry({
        title: '[seed] Replace with a real product fact',
        content:
          'Replace this entry with a one-paragraph fact the AI should always know about your product — e.g., pricing tiers, refund policy, support hours, or where to download/install. Tag with `livechat` (or per-brand keys).',
        category: 'general',
        entryType: 'fact',
        priority: 50,
        agentKeys: 'livechat',
      });
      this.logger.log('Seeded livechat placeholder fact');
    }

    // One positive writing sample so the agent has at least one tone reference.
    const samples = await this.kb.getWritingSamples('livechat').catch(() => [] as Awaited<ReturnType<typeof this.kb.getWritingSamples>>);
    if (samples.length === 0) {
      await this.kb.createSample({
        context: 'Pricing question on the homepage',
        sampleText:
          'Our Pro plan is $29/month and includes unlimited projects. There is also a 7-day free trial — no card needed. Want me to walk you through what is included?',
        polarity: 'positive',
        agentKeys: 'livechat',
      }).catch((err) => this.logger.debug(`writing sample seed skipped: ${(err as Error).message}`));
    }

    // Default prompt template (key `livechat.reply`). Skip if one already exists.
    const tpl = await this.kb.getPromptTemplate('livechat').catch(() => null);
    if (!tpl) {
      await this.kb.createTemplate({
        key: 'livechat.reply',
        system:
          'You are a live chat assistant on the website. ' +
          'Use the knowledge base entries, voice profile, and visitor context provided below. ' +
          'Write a direct reply to the visitor. 2–4 sentences max. ' +
          'No greetings like "Dear" or closings like "Best regards". ' +
          'When the visitor\'s current page is relevant (pricing, docs, a specific feature), reference it naturally. ' +
          'Just the reply.',
        userTemplate: '{{visitorMessage}}',
      }).catch((err) => this.logger.debug(`template seed skipped: ${(err as Error).message}`));
    }
  }

  async updateSite(id: string, dto: UpdateSiteDto): Promise<LivechatSiteRow> {
    const [existing] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.id, id));
    if (!existing) throw new NotFoundException(`Live chat site not found: ${id}`);

    const set: Record<string, unknown> = {};
    if (dto.label !== undefined) {
      if (!dto.label.trim()) throw new BadRequestException('label cannot be empty');
      set.label = dto.label.trim();
    }
    if (dto.origin !== undefined) {
      const normalized = this.normalizeOrigin(dto.origin);
      if (!normalized) throw new BadRequestException('origin must be a valid URL');
      set.origin = normalized;
    }
    if (dto.enabled !== undefined) set.enabled = dto.enabled;
    if (dto.productContext !== undefined) set.productContext = dto.productContext?.toString().trim() || null;
    if (dto.replyTone !== undefined) set.replyTone = dto.replyTone?.toString().trim() || null;
    if (dto.trackBots !== undefined) set.trackBots = dto.trackBots;
    if (dto.autoApprove !== undefined) set.autoApprove = dto.autoApprove;
    if (dto.operatorName !== undefined) set.operatorName = dto.operatorName?.trim() || null;
    if (dto.botName !== undefined) set.botName = dto.botName?.trim() || null;
    if (dto.botSubtitle !== undefined) set.botSubtitle = dto.botSubtitle?.trim() || null;
    if (dto.welcomeMessage !== undefined) set.welcomeMessage = dto.welcomeMessage?.trim() || null;
    if (dto.welcomeQuickReplies !== undefined) set.welcomeQuickReplies = this.normalizeQuickReplies(dto.welcomeQuickReplies);
    if (dto.brandColor !== undefined) set.brandColor = this.normalizeColor(dto.brandColor);
    if (dto.position !== undefined) set.position = this.normalizePosition(dto.position);
    if (dto.llmProvider !== undefined) set.llmProvider = dto.llmProvider?.trim() || null;
    if (dto.llmModel !== undefined) set.llmModel = dto.llmModel?.trim() || null;
    if (dto.transcriptEnabled !== undefined) set.transcriptEnabled = dto.transcriptEnabled;
    if (dto.transcriptBcc !== undefined) set.transcriptBcc = dto.transcriptBcc?.trim() || null;
    if (dto.transcriptFrom !== undefined) set.transcriptFrom = dto.transcriptFrom?.trim() || null;
    if (dto.humanAlertEmail !== undefined) set.humanAlertEmail = dto.humanAlertEmail?.trim() || null;
    if (dto.topicHandlingRules !== undefined) set.topicHandlingRules = dto.topicHandlingRules?.trim() || null;
    if (dto.requireEmail !== undefined) set.requireEmail = dto.requireEmail;

    if (Object.keys(set).length === 0) return this.toSiteRow(existing);

    const [row] = await this.db.db.update(livechatSites).set(set).where(eq(livechatSites.id, id)).returning();
    await this.originCache.refresh().catch(() => undefined);
    return this.toSiteRow(row);
  }

  async deleteSite(id: string): Promise<void> {
    const [existing] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.id, id));
    if (!existing) throw new NotFoundException(`Live chat site not found: ${id}`);
    await this.db.db.delete(livechatSites).where(eq(livechatSites.id, id));
    await this.originCache.refresh().catch(() => undefined);
  }

  async clearWidgetCache(id: string): Promise<{ cacheBust: string }> {
    const [existing] = await this.db.db.select().from(livechatSites).where(eq(livechatSites.id, id));
    if (!existing) throw new NotFoundException(`Live chat site not found: ${id}`);
    const cacheBust = new Date().toISOString();
    await this.db.db.update(livechatSites).set({ widgetCacheBust: cacheBust }).where(eq(livechatSites.id, id));
    return { cacheBust };
  }

  /** Normalize a single origin entry — URL, wildcard like *.example.com, or * for all. */
  private normalizeOriginEntry(entry: string): string | null {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    if (trimmed === '*') return '*';
    // Wildcard pattern: *.domain.com or https://*.domain.com
    const wildcardMatch = trimmed.match(/^(?:https?:\/\/)?\*\.([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i);
    if (wildcardMatch) return `*.${wildcardMatch[1].toLowerCase()}`;
    try {
      const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
      if (!u.protocol.startsWith('http')) return null;
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }

  /** Normalize a comma-separated list of origins/wildcards. Returns null if list is empty or all invalid. */
  private normalizeOrigin(origin: string | undefined | null): string | null {
    if (!origin) return null;
    const entries = origin.split(',').map((e) => this.normalizeOriginEntry(e)).filter((e): e is string => !!e);
    return entries.length ? entries.join(',') : null;
  }

  /** Check if a request origin matches the site's stored origin list (comma-separated, wildcard aware). */
  private originMatchesSite(requestHostname: string, siteOrigin: string): boolean {
    const normalize = (h: string) => h.replace(/^www\./, '');
    const reqNorm = normalize(requestHostname);
    for (const entry of siteOrigin.split(',')) {
      const e = entry.trim();
      if (e === '*') return true;
      if (e.startsWith('*.')) {
        const suffix = e.slice(1); // e.g. '.taskip.net'
        if (reqNorm === suffix.slice(1) || reqNorm.endsWith(suffix)) return true;
      } else {
        try {
          const h = normalize(new URL(e).hostname.toLowerCase());
          if (reqNorm === h) return true;
        } catch { /* skip invalid */ }
      }
    }
    return false;
  }

  private extractHostname(origin: string | undefined | null): string | null {
    if (!origin) return null;
    try {
      return new URL(origin.trim()).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private normalizeColor(c: string | null | undefined): string | null {
    if (!c) return null;
    const trimmed = c.trim();
    if (!trimmed) return null;
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
    return trimmed.toLowerCase();
  }

  private normalizePosition(p: string | null | undefined): WidgetPosition {
    return p === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  }

  /**
   * Quick replies are stored as a newline-separated string (compact, easy to
   * read in DB), but accept either a string or array from the DTO. Each
   * label is trimmed, deduped, and capped at 6 items × 60 chars to keep the
   * widget chip row manageable.
   */
  private normalizeQuickReplies(value: string[] | string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const list = Array.isArray(value) ? value : value.split(/[\n,]/);
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const raw of list) {
      const trimmed = raw.trim().slice(0, 60);
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(trimmed);
      if (cleaned.length >= 6) break;
    }
    return cleaned.length ? cleaned.join('\n') : null;
  }

  /** Parse the stored newline-string back into an array for API responses. */
  private parseQuickReplies(stored: string | null): string[] {
    if (!stored) return [];
    return stored
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  /** Backfill ipCountry/city/etc for visitors that have an IP but no country data.
   *  Called fire-and-forget after GeoIP database is loaded/replaced. */
  async backfillGeoCountries(): Promise<void> {
    const rows = await this.db.db
      .select({ id: livechatVisitors.id, ip: livechatVisitors.ip })
      .from(livechatVisitors)
      .where(and(isNotNull(livechatVisitors.ip), isNull(livechatVisitors.ipCountry)));

    for (const row of rows) {
      const geo = this.enrichment.lookupIp(row.ip);
      if (!geo.country) continue;
      await this.db.db
        .update(livechatVisitors)
        .set({
          ipCountry: geo.country,
          ipCountryName: geo.countryName,
          ipRegion: geo.region,
          ipCity: geo.city,
          ipLat: geo.lat,
          ipLon: geo.lon,
          ipTimezone: geo.timezone,
        })
        .where(eq(livechatVisitors.id, row.id));
    }
    this.logger.log(`GeoIP backfill complete — updated ${rows.length} visitor(s)`);
  }

  async saveKbGap(input: {
    siteKey: string;
    sessionId: string;
    visitorQuestion: string;
    escalationReason: string;
  }): Promise<void> {
    await this.db.db.insert(livechatKbGaps).values({
      siteKey: input.siteKey,
      sessionId: input.sessionId,
      visitorQuestion: input.visitorQuestion,
      escalationReason: input.escalationReason,
    });
  }

  async listKbGaps(siteKey?: string, limit = 100): Promise<typeof livechatKbGaps.$inferSelect[]> {
    const q = this.db.db
      .select()
      .from(livechatKbGaps)
      .orderBy(desc(livechatKbGaps.createdAt))
      .limit(limit);
    if (siteKey) {
      return q.where(eq(livechatKbGaps.siteKey, siteKey));
    }
    return q;
  }

  async deleteKbGap(id: string): Promise<void> {
    await this.db.db.delete(livechatKbGaps).where(eq(livechatKbGaps.id, id));
  }

  async flagKbSource(input: {
    kbEntryId: string;
    sessionId: string;
    messageId: string;
    siteKey: string;
    note?: string;
  }): Promise<{ id: string }> {
    const [row] = await this.db.db
      .insert(livechatKbFlags)
      .values({
        kbEntryId: input.kbEntryId,
        sessionId: input.sessionId,
        messageId: input.messageId,
        siteKey: input.siteKey,
        note: input.note ?? null,
      })
      .returning({ id: livechatKbFlags.id });
    return row;
  }

  private toSiteRow(r: typeof livechatSites.$inferSelect): LivechatSiteRow {
    return {
      id: r.id,
      key: r.key,
      label: r.label,
      origin: r.origin,
      enabled: r.enabled,
      productContext: r.productContext,
      replyTone: r.replyTone,
      trackBots: r.trackBots,
      autoApprove: r.autoApprove,
      operatorName: r.operatorName,
      botName: r.botName,
      botSubtitle: r.botSubtitle,
      welcomeMessage: r.welcomeMessage,
      welcomeQuickReplies: this.parseQuickReplies(r.welcomeQuickReplies),
      brandColor: r.brandColor,
      position: (r.position === 'bottom-left' ? 'bottom-left' : 'bottom-right') as WidgetPosition,
      llmProvider: r.llmProvider,
      llmModel: r.llmModel,
      transcriptEnabled: r.transcriptEnabled,
      transcriptBcc: r.transcriptBcc,
      transcriptFrom: r.transcriptFrom,
      humanAlertEmail: r.humanAlertEmail ?? null,
      topicHandlingRules: r.topicHandlingRules ?? null,
      requireEmail: r.requireEmail,
      widgetCacheBust: r.widgetCacheBust ?? null,
      createdAt: r.createdAt,
    };
  }

  async bulkCloseSessions(opts: { siteKey?: string; status?: string } = {}): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [ne(livechatSessions.status, 'closed')];

    if (opts.siteKey) {
      const site = await this.getSiteByKey(opts.siteKey);
      if (!site) return [];
      conditions.push(eq(livechatSessions.siteId, site.id));
    }

    if (opts.status && opts.status !== 'closed') {
      conditions.push(eq(livechatSessions.status, opts.status));
    }

    const rows = await this.db.db
      .select({ id: livechatSessions.id })
      .from(livechatSessions)
      .where(and(...conditions));

    const ids = rows.map((r) => r.id);
    if (!ids.length) return [];

    await this.db.db
      .update(livechatSessions)
      .set({ status: 'closed', lastSeenAt: new Date() })
      .where(inArray(livechatSessions.id, ids));

    return ids;
  }
}
