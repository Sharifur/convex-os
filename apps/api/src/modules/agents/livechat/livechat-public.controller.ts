import { Controller, Post, Get, Body, Param, Query, Req, Res, BadRequestException } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { LivechatService } from './livechat.service';
import { EnrichmentService } from '../../../common/visitor-enrichment/enrichment.service';
import { LivechatStreamService } from './livechat-stream.service';
import { LivechatAgent } from './agent';
import { LivechatRateLimitService } from './livechat-rate-limit.service';
import { LivechatAttachmentsService } from './livechat-attachments.service';
import { LivechatMetricsService } from './livechat-metrics.service';
import { PushService } from '../../push/push.service';
import { LivechatTranscriptService } from './livechat-transcript.service';

interface PageviewBody {
  siteKey: string;
  visitorId: string;
  url: string;
  path?: string;
  title?: string;
  referrer?: string;
  language?: string;
}

interface LeaveBody {
  siteKey: string;
  visitorId: string;
  pageviewId: string;
}

interface HeartbeatBody {
  siteKey: string;
  visitorId: string;
  url?: string;
  title?: string;
}

interface IdentifyBody {
  siteKey: string;
  visitorId: string;
  email?: string | null;
  name?: string | null;
}

interface VisitorPageContext {
  scrollDepth?: number;
  timeOnPageSec?: number;
  pageH1?: string;
  metaDescription?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmTerm?: string;
  referrerDomain?: string;
  isReturnVisitor?: boolean;
  triggeredBy?: string;
  custom?: Record<string, string | number | boolean>;
}

interface MessageBody {
  siteKey: string;
  visitorId: string;
  content: string;
  attachmentIds?: string[];
  pageContext?: VisitorPageContext;
  replyToId?: string;
  replyToContent?: string;
  /** Anti-bot signals — silently fail the request when triggered. */
  meta?: {
    /** Honeypot field. Real widget keeps this empty; bots auto-fill. */
    hp?: string;
    /** ms since panel was first shown. Bots blast under 800. */
    elapsedMs?: number;
    /** Did the textarea ever fire an input/keydown? Bots set value via JS. */
    hadInteraction?: boolean;
  };
}

function detectBot(meta: MessageBody['meta'], isFirstMessage: boolean): string | null {
  if (!meta) return null;
  if (meta.hp && meta.hp.length > 0) return 'honeypot_filled';
  if (meta.hadInteraction === false) return 'no_keystrokes';
  if (isFirstMessage && typeof meta.elapsedMs === 'number' && meta.elapsedMs < 800) return 'too_fast';
  return null;
}

/**
 * Resolve the visitor's true IP. Fastify's trustProxy=true gives us req.ip
 * from X-Forwarded-For, but some hosts (Cloudflare, fronting CDNs) put the
 * original IP in their own header instead — those are checked first so
 * GeoLite2 reads the visitor's IP, not the proxy's.
 */
function extractRequestOrigin(req: FastifyRequest): string | null {
  // Use only the Origin header for CORS origin validation. The HTTP Referer header
  // is the navigation referrer (e.g. Google) for server-side/prerender requests and
  // must NOT be used for origin checks — it would block legitimate widget requests
  // from pages visited via search engines.
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.trim()) return origin.trim();
  return null;
}

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'tempmail.com', 'temp-mail.org', 'throwam.com', 'throwam.net',
  '10minutemail.com', '10minutemail.net', 'minutemail.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'trashmail.com', 'trashmail.at', 'trashmail.io', 'trashmail.me', 'trashmail.net',
  'dispostable.com', 'sharklasers.com', 'guerrillamailblock.com',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
  'maildrop.cc', 'mailnull.com', 'mailnull.net',
  'fakeinbox.com', 'fakemailgenerator.com', 'fakemail.fr',
  'getnada.com', 'getairmail.com', 'inboxkitten.com',
  'mohmal.com', 'moakt.com', 'emailondeck.com',
  'spamevader.com', 'spamfree24.org', 'mailtemp.info',
  'tempr.email', 'spam4.me', 'throwam.com', 'discard.email',
  'nwytg.com', 'armyspy.com', 'cuvox.de', 'dayrep.com',
  'einrot.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com',
  'rhyta.com', 'superrito.com', 'teleworm.us',
]);

const DUMMY_LOCAL_PATTERNS = /^(test|dummy|fake|temp|trial|demo|sample|noreply|no-reply|example|placeholder|asdf|qwerty|aaa+|bbb+|ccc+|abc|xyz|foo|bar|baz|user\d*|admin\d*|random|nobody)\d*$/i;

function isDisposableOrDummyEmail(email: string): boolean {
  const [local, domain] = email.toLowerCase().split('@');
  if (!local || !domain) return false;

  // TLD must be at least 2 chars; single-char local is obviously fake
  const tld = domain.split('.').pop() ?? '';
  if (tld.length < 2) return true;
  if (local.length < 2) return true;

  // Domain labels must each be at least 2 chars (y.y has label 'y')
  const labels = domain.split('.');
  if (labels.some((l) => l.length < 2)) return true;

  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  if (DUMMY_LOCAL_PATTERNS.test(local)) return true;
  if (local.includes('test') || local.includes('dummy') || local.includes('fake')) return true;
  return false;
}

function extractClientIp(req: FastifyRequest): string | null {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();
  // X-Forwarded-For is `client, proxy1, proxy2, ...` — leftmost is the visitor.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? null;
}

interface WidgetConfigResponse {
  siteKey: string;
  operatorName: string | null;
  operators: { name: string; avatarUrl: string | null }[];
  botName: string;
  botSubtitle: string;
  welcomeMessage: string | null;
  welcomeQuickReplies: string[];
  brandColor: string;
  position: 'bottom-right' | 'bottom-left';
  requireEmail: boolean;
  cacheBust: string | null;
}

@Controller('livechat')
export class LivechatPublicController {
  constructor(
    private livechat: LivechatService,
    private enrichment: EnrichmentService,
    private stream: LivechatStreamService,
    private agent: LivechatAgent,
    private rateLimit: LivechatRateLimitService,
    private attachments: LivechatAttachmentsService,
    private metrics: LivechatMetricsService,
    private push: PushService,
    private transcript: LivechatTranscriptService,
  ) {}

  @Get('config')
  async config(@Req() req: FastifyRequest, @Query('siteKey') siteKey?: string): Promise<WidgetConfigResponse> {
    if (!siteKey) throw new BadRequestException('siteKey query param is required');
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(siteKey, origin);
    const operators = await this.livechat.getOperatorsForSite(site.key);
    const defaultOperator = operators.find((op) => op.isDefault) ?? null;
    return {
      siteKey: site.key,
      operatorName: defaultOperator?.name ?? site.operatorName ?? null,
      operators: operators.map((op) => ({ name: op.name, avatarUrl: op.avatarUrl ?? null })),
      botName: site.botName?.trim() || site.label,
      botSubtitle: site.botSubtitle?.trim() || 'We typically reply in a few seconds.',
      welcomeMessage: site.welcomeMessage,
      welcomeQuickReplies: site.welcomeQuickReplies,
      brandColor: site.brandColor || '#2563eb',
      position: site.position,
      requireEmail: site.requireEmail,
      cacheBust: site.widgetCacheBust ?? null,
    };
  }

  @Post('track/pageview')
  async pageview(@Req() req: FastifyRequest, @Body() body: PageviewBody) {
    if (!body?.siteKey || !body?.visitorId || !body?.url) {
      throw new BadRequestException('siteKey, visitorId and url are required');
    }
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin);
    const safeVisitorId = String(body.visitorId).replace(/:/g, '_').slice(0, 128);
    await this.rateLimit.check('pageview', `${site.key}:${safeVisitorId}`, 60);

    const enriched = this.enrichment.enrich(
      extractClientIp(req),
      req.headers['user-agent'] as string | undefined,
      body.language ?? (req.headers['accept-language'] as string | undefined),
    );

    if (!site.trackBots && enriched.deviceType === 'bot') {
      return { ok: true, skipped: 'bot' };
    }

    const visitorPk = await this.livechat.upsertVisitor({
      siteId: site.id,
      visitorId: body.visitorId,
      enrichment: enriched,
    });

    const { pageviewId } = await this.livechat.recordPageview({
      siteId: site.id,
      visitorPk,
      visitorId: body.visitorId,
      sessionId: null,
      url: body.url.slice(0, 2000),
      path: (body.path ?? this.pathFromUrl(body.url))?.slice(0, 500) ?? null,
      title: body.title?.slice(0, 300) ?? null,
      referrer: body.referrer?.slice(0, 2000) ?? null,
    });

    this.stream.publishToOperators({ type: 'visitor_activity', visitorPk, siteKey: site.key });

    return { ok: true, pageviewId, visitorPk };
  }

  @Post('track/heartbeat')
  async heartbeat(@Req() req: FastifyRequest, @Body() body: HeartbeatBody) {
    if (!body?.siteKey || !body?.visitorId) {
      throw new BadRequestException('siteKey and visitorId are required');
    }
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin);
    const safeVisitorId = String(body.visitorId).replace(/:/g, '_').slice(0, 128);
    await this.rateLimit.check('heartbeat', `${site.key}:${safeVisitorId}`, 120);
    const { sessionId, previousUrl, previousTitle } = await this.livechat.heartbeatVisitor({
      siteId: site.id,
      visitorId: body.visitorId,
      currentUrl: body.url ?? null,
      currentTitle: body.title ?? null,
    });
    // Look up visitor PK so the operator UI can index by id.
    const [visitor] = (await this.livechat.listLiveVisitors(120)).filter(
      (v) => v.siteId === site.id && v.visitorId === body.visitorId,
    );
    if (visitor) {
      this.stream.publishToOperators({ type: 'visitor_activity', visitorPk: visitor.visitorPk, siteKey: site.key });
    }
    // When the visitor's current URL or title changed since the previous
    // heartbeat, push a pageview event into the session room so an operator
    // currently viewing the conversation sees "Currently on" update in
    // realtime — without waiting for a full pageview navigation event.
    if (sessionId && body.url && (body.url !== previousUrl || (body.title ?? null) !== previousTitle)) {
      this.stream.publish(sessionId, {
        type: 'pageview',
        sessionId,
        visitorPk: visitor?.visitorPk ?? '',
        url: body.url,
        title: body.title ?? null,
        at: new Date().toISOString(),
      });
    }
    return { ok: true };
  }

  @Post('track/leave')
  async leave(@Req() req: FastifyRequest, @Body() body: LeaveBody) {
    if (!body?.pageviewId) throw new BadRequestException('pageviewId is required');
    const origin = extractRequestOrigin(req);
    if (body.siteKey) await this.livechat.resolveSiteForRequest(body.siteKey, origin);
    await this.livechat.recordPageviewLeave(body.pageviewId);
    return { ok: true };
  }

  /**
   * Visitor-initiated session close. Origin-gated and ownership-verified —
   * the session must belong to the visitorId on the calling site, otherwise
   * a malicious page on another origin could close someone else's chat.
   */
  @Post('session/:id/close')
  async closeSession(
    @Req() req: FastifyRequest,
    @Param('id') sessionId: string,
    @Body() body: { siteKey?: string; visitorId?: string },
  ) {
    if (!body?.siteKey || !body?.visitorId) {
      throw new BadRequestException('siteKey and visitorId are required');
    }
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin);
    const session = await this.livechat.getSession(sessionId);
    if (!session || session.siteId !== site.id || session.visitorId !== body.visitorId) {
      // Mirror the public widget's expectation: if it's not the visitor's
      // own session, pretend it's already closed — don't leak existence.
      return { ok: true };
    }
    await this.livechat.setSessionStatus(sessionId, 'closed');
    this.stream.publish(sessionId, { type: 'session_status', sessionId, status: 'closed' });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId });
    void this.transcript.maybeSendOnClose(sessionId);
    return { ok: true };
  }

  @Get('session/:id/queue')
  async getQueuePosition(
    @Req() req: FastifyRequest,
    @Param('id') sessionId: string,
    @Query('siteKey') siteKey?: string,
    @Query('visitorId') visitorId?: string,
  ) {
    if (!siteKey || !visitorId) throw new BadRequestException('siteKey and visitorId are required');
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(siteKey, origin);
    const session = await this.livechat.getSession(sessionId);
    if (!session || session.siteId !== site.id || session.visitorId !== visitorId) {
      return { position: 0, status: 'unknown' };
    }
    const position = await this.livechat.getQueuePosition(sessionId);
    return { position, status: session.status };
  }

  /**
   * Visitor-submitted thumbs rating after a session ends. Origin-gated and
   * ownership-checked the same way as session close so a malicious page can't
   * stuff someone else's CSAT.
   */
  @Post('session/:id/feedback')
  async sessionFeedback(
    @Req() req: FastifyRequest,
    @Param('id') sessionId: string,
    @Body() body: { siteKey?: string; visitorId?: string; rating?: 'up' | 'down'; comment?: string },
  ) {
    if (!body?.siteKey || !body?.visitorId) throw new BadRequestException('siteKey and visitorId are required');
    if (body.rating !== 'up' && body.rating !== 'down') throw new BadRequestException('rating must be "up" or "down"');
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin);
    const session = await this.livechat.getSession(sessionId);
    if (!session || session.siteId !== site.id || session.visitorId !== body.visitorId) {
      // Same opaque-failure pattern as session close.
      return { ok: true };
    }
    await this.metrics.submitFeedback({
      sessionId,
      siteId: site.id,
      rating: body.rating,
      comment: body.comment?.slice(0, 600),
    });
    return { ok: true };
  }

  @Post('session/:id/message/:msgId/rating')
  async messageRating(
    @Req() req: FastifyRequest,
    @Param('id') sessionId: string,
    @Param('msgId') messageId: string,
    @Body() body: { siteKey?: string; visitorId?: string; rating?: 'up' | 'down' },
  ) {
    if (!body?.siteKey || !body?.visitorId) throw new BadRequestException('siteKey and visitorId are required');
    if (body.rating !== 'up' && body.rating !== 'down') throw new BadRequestException('rating must be "up" or "down"');
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin);
    const session = await this.livechat.getSession(sessionId);
    if (!session || session.siteId !== site.id || session.visitorId !== body.visitorId) return { ok: true };
    await this.livechat.rateMessage(messageId, sessionId, body.rating);
    return { ok: true };
  }

  @Post('identify')
  async identify(@Req() req: FastifyRequest, @Body() body: IdentifyBody) {
    if (!body?.siteKey || !body?.visitorId) {
      throw new BadRequestException('siteKey and visitorId are required');
    }
    const email = body.email?.trim().slice(0, 254) ?? undefined;
    const name = body.name?.trim().slice(0, 100) ?? undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email address');
    }
    if (email && isDisposableOrDummyEmail(email)) {
      throw new BadRequestException('Please use a real email address');
    }
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin);
    await this.livechat.setVisitorIdentity({
      siteId: site.id,
      siteKey: site.key,
      visitorId: body.visitorId,
      email,
      name,
    });
    return { ok: true };
  }

  @Post('message')
  async message(@Req() req: FastifyRequest, @Body() body: MessageBody) {
    const rawAttachmentIds = Array.isArray(body?.attachmentIds) ? body.attachmentIds.slice(0, 5) : [];
    const hasAttachments = rawAttachmentIds.length > 0;
    if (!body?.siteKey || !body?.visitorId || (!body?.content?.trim() && !hasAttachments)) {
      throw new BadRequestException('siteKey, visitorId and content (or attachments) are required');
    }
    const origin = extractRequestOrigin(req);
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin);
    const safeVisitorId = String(body.visitorId).replace(/:/g, '_').slice(0, 128);
    await this.rateLimit.check('message', `${site.key}:${safeVisitorId}`, 30);

    const enriched = this.enrichment.enrich(
      extractClientIp(req),
      req.headers['user-agent'] as string | undefined,
      req.headers['accept-language'] as string | undefined,
    );

    const visitorPk = await this.livechat.upsertVisitor({
      siteId: site.id,
      visitorId: body.visitorId,
      enrichment: enriched,
    });

    const { sessionId } = await this.livechat.getOrCreateSession({
      siteId: site.id,
      siteKey: site.key,
      visitorPk,
      visitorId: body.visitorId,
    });

    if (body.pageContext && typeof body.pageContext === 'object') {
      const raw = JSON.stringify(body.pageContext);
      if (raw.length <= 5120) {
        void this.livechat.setPageContext(sessionId, body.pageContext as Record<string, unknown>);
      }
    }

    const visitorContent = (body.content ?? '').trim();

    // Bot heuristics — silent. Real users always pass; we don't error so
    // the attacker can't tell their messages aren't getting through.
    const sessionDetail = await this.livechat.getSession(sessionId).catch(() => null);
    const messageCount = sessionDetail
      ? await this.livechat.getRecentMessages(sessionId, 1).then((rs) => rs.length).catch(() => 0)
      : 0;
    const isFirstMessage = messageCount === 0;
    const botReason = detectBot(body.meta, isFirstMessage);
    if (botReason) {
      // Pretend it succeeded — return the same shape as a deduped send.
      return {
        ok: true,
        sessionId,
        deduped: true,
        visitor: { id: 'silenced', createdAt: new Date() },
        agent: { skipped: 'silenced' },
      };
    }

    const visitorMsg = await this.livechat.appendMessage({
      sessionId,
      role: 'visitor',
      content: visitorContent,
      replyToId: body.replyToId || null,
      replyToContent: body.replyToContent ? body.replyToContent.slice(0, 200) : null,
    });

    // Dedupe — appendMessage flagged this as an exact recent duplicate.
    // Don't re-publish, don't re-run the agent, don't re-link attachments.
    if (visitorMsg.duplicate) {
      return {
        ok: true,
        sessionId,
        deduped: true,
        visitor: { id: visitorMsg.id, createdAt: visitorMsg.createdAt },
        agent: { skipped: 'deduped' },
      };
    }

    let attachments: Awaited<ReturnType<LivechatAttachmentsService['getById']>>[] = [];
    if (hasAttachments) {
      await this.attachments.linkToMessage(rawAttachmentIds, visitorMsg.id, sessionId);
      attachments = await Promise.all(rawAttachmentIds.map((id) => this.attachments.getById(id)));
    }

    this.stream.publish(sessionId, {
      type: 'message',
      sessionId,
      role: 'visitor',
      content: visitorContent,
      messageId: visitorMsg.id,
      createdAt: visitorMsg.createdAt.toISOString(),
      attachments: attachments.map(toAttachmentSummary),
    });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId });
    this.stream.publishToOperators({ type: 'new_visitor_message', sessionId });

    // If the visitor only sent attachments without text, skip the LLM run.
    const result = visitorContent
      ? await this.agent.handleVisitorMessage({ sessionId, visitorMessage: visitorContent })
      : { ok: true, status: 'skipped_taken_over' as const };

    // Push notification: fire to subscribed operators for per-message events
    // (a draft awaiting review, or the visitor replying to an operator who has
    // already taken over).
    //
    // Needs-human alerts (first escalation + the throttled "still waiting"
    // reminders) are intentionally NOT pushed here. The inactivity sweep
    // sends a single de-duplicated push + email per waiting period (gated by
    // human_alert_sent_at, reset when an operator joins) so the same waiting
    // chat is never pushed more than once. See LivechatInactivityService.
    const pushable =
      result.status === 'pending_approval' ||
      result.status === 'skipped_taken_over';
    if (pushable) {
      const session = await this.livechat.getSession(sessionId).catch(() => null);
      const name = session?.visitorName?.trim() || session?.visitorEmail || `visitor${body.visitorId.slice(-5)}`;
      const title =
        result.status === 'pending_approval' ? `Review needed — ${name}` :
        `${name} replied`;
      void this.push.sendToAll({
        title,
        body: visitorContent.slice(0, 140) || '(attachment)',
        tag: `lc-${sessionId}`,
        url: `/livechat?session=${sessionId}`,
        renotify: true,
        requireInteraction: false,
      }).catch(() => undefined);
    }

    return {
      ok: true,
      sessionId,
      visitor: { id: visitorMsg.id, createdAt: visitorMsg.createdAt, attachments: attachments.map(toAttachmentSummary) },
      agent:
        'reply' in result && result.reply
          ? { id: result.agentMessageId, content: result.reply, status: result.status }
          : { skipped: result.status },
    };
  }

  // 1x1 transparent GIF served when visitor opens the inactivity email.
  // Marks sentViaEmail agent messages as seen → green double-check for operator.
  @Get('session/:id/email-pixel')
  async emailPixel(@Param('id') id: string, @Res() res: FastifyReply): Promise<void> {
    // Fire-and-forget — don't block the pixel response on DB writes
    this.livechat.markEmailOpenedForSession(id).then((seenIds) => {
      if (seenIds.length) {
        const seenAt = new Date().toISOString();
        this.stream.publish(id, { type: 'messages_seen', sessionId: id, messageIds: seenIds, seenAt });
        this.stream.publishToOperators({ type: 'session_upserted', sessionId: id });
      }
    }).catch(() => undefined);

    const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.header('Content-Type', 'image/gif');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(PIXEL);
  }

  private pathFromUrl(url: string): string | null {
    try {
      return new URL(url).pathname;
    } catch {
      return null;
    }
  }
}

function toAttachmentSummary(a: { id: string; mimeType: string; sizeBytes: number; originalFilename: string; url: string }) {
  return {
    id: a.id,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    originalFilename: a.originalFilename,
    url: a.url,
  };
}
