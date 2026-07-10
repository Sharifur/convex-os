import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { livechatSessions, livechatMessages } from './schema';
import { inArray, isNull } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { LivechatService } from './livechat.service';
import { SesService } from '../../ses/ses.service';
import { SettingsService } from '../../settings/settings.service';
import { LivechatInboundService } from './livechat-inbound.service';
import { LivechatStreamService } from './livechat-stream.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { SelfImprovementService } from '../../knowledge-base/self-improvement.service';

const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000;    // 3 min visitor absence
const RESEND_COOLDOWN_MS = 30 * 60 * 1000;         // 30 min between emails per session
const SCAN_INTERVAL_MS = 60 * 1000;                // scan every 60s
const RECENT_MESSAGES_WINDOW_MS = 15 * 60 * 1000;  // look at messages from last 15 min
const HUMAN_ALERT_THRESHOLD_MS = 3 * 60 * 1000;    // 3 min waiting for operator
const KB_GAP_SWEEP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly

@Injectable()
export class LivechatInactivityService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(LivechatInactivityService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  private kbGapTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: DbService,
    private livechat: LivechatService,
    private ses: SesService,
    private settings: SettingsService,
    private inbound: LivechatInboundService,
    private stream: LivechatStreamService,
    private llm: LlmRouterService,
    private selfImprovement: SelfImprovementService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.sweep(); void this.sweepNeedsHuman(); }, SCAN_INTERVAL_MS);
    this.kbGapTimer = setInterval(() => { void this.sweepKbGaps(); }, KB_GAP_SWEEP_INTERVAL_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    if (this.kbGapTimer) clearInterval(this.kbGapTimer);
  }

  async sweep(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = new Date(now.getTime() - INACTIVITY_THRESHOLD_MS);
    const resendCutoff = new Date(now.getTime() - RESEND_COOLDOWN_MS);
    const messageWindow = new Date(now.getTime() - RECENT_MESSAGES_WINDOW_MS);

    // Find open/human_taken_over sessions where: visitor has email, visitor gone 3+ min (no
    // recent visitor message), no email recently sent, AND there's a recent agent/operator
    // reply the visitor may have missed. Use last visitor message time — not last_seen_at —
    // because operator replies must not reset the visitor absence clock. human_taken_over is
    // included because operator replies flip status to it (see operatorReply), so excluding
    // it silently dropped every operator-handled chat from this sweep.
    const rows = await this.db.db.execute(sql`
      SELECT s.id, s.visitor_email, s.visitor_name
      FROM livechat_sessions s
      WHERE s.status IN ('open', 'human_taken_over')
        AND s.visitor_email IS NOT NULL
        AND (s.inactivity_email_sent_at IS NULL OR s.inactivity_email_sent_at < ${resendCutoff.toISOString()})
        AND NOT EXISTS (
          SELECT 1 FROM livechat_messages m
          WHERE m.session_id = s.id
            AND m.role = 'visitor'
            AND m.created_at > ${inactiveThreshold.toISOString()}
        )
        AND EXISTS (
          SELECT 1 FROM livechat_messages m
          WHERE m.session_id = s.id
            AND m.role IN ('agent', 'operator')
            AND m.created_at > ${messageWindow.toISOString()}
        )
      LIMIT 20
    `);

    const sessions = rows as unknown as Array<{ id: string; visitor_email: string; visitor_name: string | null }>;
    if (!sessions.length) return;

    this.logger.debug(`Inactivity sweep: ${sessions.length} candidate session(s)`);

    for (const session of sessions) {
      await this.sendInactivityEmail(session.id, session.visitor_email, session.visitor_name).catch((err) => {
        this.logger.warn(`Inactivity email failed for session ${session.id.slice(-8)}: ${(err as Error).message}`);
      });
    }
  }

  private async sendInactivityEmail(sessionId: string, visitorEmail: string, visitorName: string | null): Promise<void> {
    const detail = await this.livechat.getSessionDetail(sessionId);
    if (!detail) return;

    const site = await this.livechat.getSiteById(detail.session.siteId);
    const rawFrom = site.transcriptFrom?.trim() || await this.settings.getDecrypted('ses_from_address');
    if (!rawFrom) {
      this.logger.warn(`Inactivity email skipped for ${sessionId.slice(-8)}: no from address configured`);
      return;
    }

    const senderLabel = site.botName?.trim() || site.label?.trim() || 'Support';
    const fromAddress = rawFrom.includes('<') ? rawFrom : `"${senderLabel}" <${rawFrom}>`;
    const visitorLabel = visitorName?.trim() || visitorEmail.split('@')[0];
    const botName = site.botName?.trim() || site.label;

    // Get last 5 messages
    const recentMsgs = detail.messages.slice(-5);
    if (!recentMsgs.length) return;

    const replyTo = (await this.inbound.buildReplyTo(sessionId)) ?? undefined;

    const brandColor = site.brandColor || '#2563eb';
    const appBaseUrl = (await this.settings.getDecrypted('app_base_url'))?.trim().replace(/\/+$/, '') || null;
    const pixelUrl = appBaseUrl ? `${appBaseUrl}/api/livechat/session/${encodeURIComponent(sessionId)}/email-pixel` : null;

    const subject = `You have a message from ${botName}`;
    const textBody = this.buildText({ visitorLabel, botName, messages: recentMsgs });
    const htmlBody = this.buildHtml({ visitorLabel, botName, brandColor, messages: recentMsgs, pixelUrl });

    await this.ses.sendEmail({ to: visitorEmail, from: fromAddress, subject, textBody, htmlBody, replyTo });

    // Stamp agent/bot messages as sentViaEmail so the operator sees the email icon
    // and the pixel endpoint can mark them as seen when the visitor opens the email.
    const agentMsgIds = recentMsgs
      .filter((m) => m.role === 'agent' || m.role === 'operator')
      .map((m) => m.id);
    if (agentMsgIds.length) {
      await this.db.db
        .update(livechatMessages)
        .set({ metadata: sql`COALESCE(${livechatMessages.metadata}, '{}'::jsonb) || '{"sentViaEmail":true}'::jsonb` })
        .where(inArray(livechatMessages.id, agentMsgIds));
    }

    await this.db.db
      .update(livechatSessions)
      .set({ inactivityEmailSentAt: new Date() })
      .where(eq(livechatSessions.id, sessionId));

    this.logger.log(`Inactivity email sent → ${visitorEmail} for session ${sessionId.slice(-8)} | replyTo: ${replyTo ?? 'none'}`);
  }

  async sweepNeedsHuman(): Promise<void> {
    const now = new Date();
    const alertThreshold = new Date(now.getTime() - HUMAN_ALERT_THRESHOLD_MS);

    // Alert once per waiting chat: still fires after the 3-min wait, but never
    // re-sends for the same session — human_alert_sent_at is stamped on first send
    // and only cleared when the session leaves 'needs_human'.
    const rows = await this.db.db.execute(sql`
      SELECT s.id, s.site_id, s.visitor_name, s.visitor_email, s.needs_human_at, s.human_alert_sent_at
      FROM livechat_sessions s
      WHERE s.status = 'needs_human'
        AND s.needs_human_at IS NOT NULL
        AND s.needs_human_at < ${alertThreshold.toISOString()}
        AND s.human_alert_sent_at IS NULL
      LIMIT 20
    `);

    const sessions = rows as unknown as Array<{ id: string; site_id: string; visitor_name: string | null; visitor_email: string | null; needs_human_at: string; human_alert_sent_at: string | null }>;
    if (!sessions.length) return;

    this.logger.debug(`Human alert sweep: ${sessions.length} session(s) waiting for operator`);

    for (const session of sessions) {
      const isFirstAlert = session.human_alert_sent_at === null;
      await this.sendHumanAlertEmail(session.id, session.site_id, session.visitor_name, session.visitor_email, session.needs_human_at, isFirstAlert).catch((err) => {
        this.logger.warn(`Human alert email failed for session ${session.id.slice(-8)}: ${(err as Error).message}`);
      });
    }
  }

  private async sendHumanAlertEmail(sessionId: string, siteId: string, visitorName: string | null, visitorEmail: string | null, needsHumanAt: string | null, isFirstAlert: boolean): Promise<void> {
    const site = await this.livechat.getSiteById(siteId);

    const adminTo = site.humanAlertEmail?.trim()
      || await this.settings.getDecrypted('livechat_alert_email')
      || await this.settings.getDecrypted('ses_from_address');
    if (!adminTo) {
      this.logger.warn(`Human alert skipped for ${sessionId.slice(-8)}: no admin email configured`);
      return;
    }
    const toAddress = adminTo.includes('<') ? adminTo : adminTo;

    const rawFrom = site.transcriptFrom?.trim() || await this.settings.getDecrypted('ses_from_address');
    if (!rawFrom) {
      this.logger.warn(`Human alert skipped for ${sessionId.slice(-8)}: no from address`);
      return;
    }
    const senderLabel = site.botName?.trim() || site.label?.trim() || 'Live Chat';
    const fromAddress = rawFrom.includes('<') ? rawFrom : `"${senderLabel}" <${rawFrom}>`;

    const visitorLabel = visitorName?.trim() || visitorEmail || 'A visitor';
    const siteName = site.label?.trim() || site.key;
    const brandColor = site.brandColor || '#2563eb';

    // Wait duration so the operator knows how long the visitor has been hanging.
    const waitText = this.formatWait(needsHumanAt);

    // Deep link straight to this conversation. Relative path for push (the
    // service worker resolves it against the PWA origin and opens in-app); the
    // email uses /go?s=<id> which is a public interstitial page — on Android with
    // the PWA installed it triggers the Web APK handler; on iOS it guides the
    // operator to open the link in Safari or install the PWA.
    const sessionPath = `/livechat?session=${encodeURIComponent(sessionId)}`;
    const goPath = `/go?s=${encodeURIComponent(sessionId)}`;
    const appBaseUrl = (await this.settings.getDecrypted('app_base_url'))?.trim().replace(/\/+$/, '') || null;
    const joinUrl = appBaseUrl ? `${appBaseUrl}${goPath}` : null;

    // Pull the visitor's last question so the operator has context before opening.
    let lastQuestion: string | null = null;
    const detail = await this.livechat.getSessionDetail(sessionId).catch(() => null);
    if (detail) {
      const lastVisitorMsg = [...detail.messages].reverse().find((m) => m.role === 'visitor');
      if (lastVisitorMsg?.content) lastQuestion = lastVisitorMsg.content.trim().slice(0, 280);
    }

    const adminSubject = `🟠 ${visitorLabel} is waiting for a human — ${siteName}`;
    const adminText = [
      `${visitorLabel} has been waiting ${waitText} in the ${siteName} live chat and no agent has joined yet.`,
      '',
      'Visitor details',
      `  • Name:    ${visitorName?.trim() || '—'}`,
      `  • Email:   ${visitorEmail || '—'}`,
      `  • Site:    ${siteName}`,
      `  • Waiting: ${waitText}`,
      ...(lastQuestion ? ['', 'Their last message:', `  "${lastQuestion}"`] : []),
      '',
      joinUrl ? `Join the chat: ${joinUrl}` : 'Open the live chat dashboard and take over the conversation before they drop off.',
    ].join('\n');
    const adminHtml = this.buildHumanAlertHtml({ visitorLabel, visitorName, visitorEmail, siteName, brandColor, waitText, lastQuestion, joinUrl });

    await this.ses.sendEmail({ to: toAddress, from: fromAddress, subject: adminSubject, textBody: adminText, htmlBody: adminHtml })
      .then(() => this.logger.log(`Human alert email sent → ${toAddress} for session ${sessionId.slice(-8)}`))
      .catch((err: Error) => this.logger.warn(`Human alert email failed for session ${sessionId.slice(-8)} (to: ${toAddress}): ${err.message}`));

    if (isFirstAlert) {
      if (visitorEmail) {
        const replyTo = (await this.inbound.buildReplyTo(sessionId)) ?? undefined;
        const visitorSubject = `We received your request — a human will be with you shortly`;
        const visitorText = [
          `Hi ${visitorLabel},`,
          '',
          `Thanks for reaching out to ${siteName}. We received your request for human assistance.`,
          '',
          'Our team has been notified and someone will join your chat shortly.',
          '',
          'You can reply to this email and your message will be added to the conversation.',
        ].join('\n');
        const visitorHtml = this.buildVisitorHumanAlertHtml({ visitorLabel, siteName, brandColor });
        await this.ses.sendEmail({ to: visitorEmail, from: fromAddress, subject: visitorSubject, textBody: visitorText, htmlBody: visitorHtml, replyTo })
          .then(() => this.logger.log(`Visitor human alert email sent → ${visitorEmail} for session ${sessionId.slice(-8)}`))
          .catch((err: Error) => this.logger.warn(`Visitor human alert email failed for session ${sessionId.slice(-8)} (to: ${visitorEmail}): ${err.message}`));
      }

      const apologyText = `Sorry for the wait — our team has been notified and a human agent will join shortly. Please bear with us.`;
      const apologyMsg = await this.livechat.appendMessage({ sessionId, role: 'agent', content: apologyText }).catch(() => null);
      if (apologyMsg) {
        this.stream.publish(sessionId, {
          type: 'message',
          sessionId,
          role: 'agent',
          content: apologyText,
          messageId: apologyMsg.id,
          createdAt: apologyMsg.createdAt.toISOString(),
        });
        this.logger.log(`Apology message injected for session ${sessionId.slice(-8)}`);
      }
    }

    await this.db.db
      .update(livechatSessions)
      .set({ humanAlertSentAt: new Date() })
      .where(eq(livechatSessions.id, sessionId));
  }

  // ─── Weekly KB gap analysis ────────────────────────────────────────────────
  // Groups unanswered visitor questions from the past 7 days by site, clusters
  // similar ones, and proposes KB entries (site-scoped) for admin approval.
  async sweepKbGaps(): Promise<void> {
    this.logger.log('KB gap sweep: starting weekly analysis');
    try {
      const rows = await this.db.db.execute<{ site_key: string; visitor_question: string; escalation_reason: string }>(sql`
        SELECT site_key, visitor_question, escalation_reason
        FROM livechat_kb_gaps
        WHERE created_at >= NOW() - INTERVAL '7 days'
        ORDER BY site_key, created_at DESC
        LIMIT 500
      `);

      if (!rows.length) {
        this.logger.debug('KB gap sweep: no gaps in the last 7 days');
        return;
      }

      // Group by site
      const bySite = new Map<string, string[]>();
      for (const row of rows) {
        if (!bySite.has(row.site_key)) bySite.set(row.site_key, []);
        bySite.get(row.site_key)!.push(row.visitor_question);
      }

      for (const [siteKey, questions] of bySite.entries()) {
        if (questions.length < 3) continue; // not enough signal for a site
        await this.analyzeGapsForSite(siteKey, questions);
      }
    } catch (err) {
      this.logger.error(`KB gap sweep failed: ${(err as Error).message}`);
    }
  }

  private async analyzeGapsForSite(siteKey: string, questions: string[]): Promise<void> {
    const questionList = questions.slice(0, 40).map((q, i) => `${i + 1}. "${q.slice(0, 200)}"`).join('\n');
    const system = `You are a knowledge base curator for a live chat product support team.
The following visitor questions were asked on site "${siteKey}" but the AI could NOT answer them — it had to escalate to a human because there was no KB entry covering the topic.

Your job: identify the top recurring themes (3+ similar questions) and propose ONE concise KB entry per theme that would let the AI answer it next time.

Return a JSON array (empty if no clear themes):
[{
  "theme": "one-line summary of what visitors kept asking",
  "occurrenceCount": 4,
  "entryType": "reference",
  "title": "max 8 words",
  "content": "Q: [clean generalized question]\\nA: [BLANK — the admin will fill this in, or note what info is needed]",
  "reasoning": "one sentence: what gap this fills"
}]

Return ONLY the JSON array.`;

    let proposals: Array<{ theme: string; occurrenceCount: number; entryType: string; title: string; content: string; reasoning: string }>;
    try {
      const res = await this.llm.complete({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Site: ${siteKey}\n\nUnanswered questions (${questions.length} total, showing ${Math.min(questions.length, 40)}):\n${questionList}` },
        ],
        provider: 'auto',
        model: 'gpt-4o-mini',
        maxTokens: 800,
        temperature: 0.2,
      });
      const text = res.content.trim();
      const match = text.match(/\[[\s\S]*\]/);
      proposals = JSON.parse(match?.[0] ?? text);
      if (!Array.isArray(proposals)) return;
    } catch (err) {
      this.logger.warn(`KB gap analysis LLM failed for site ${siteKey}: ${(err as Error).message}`);
      return;
    }

    for (const p of proposals) {
      if (!p.title || !p.content || (p.occurrenceCount ?? 0) < 3) continue;

      // Cooldown: skip if same title proposed for this site in last 14 days
      const dup = await this.db.db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int AS count FROM kb_proposals
        WHERE site_key = ${siteKey}
          AND title = ${p.title}
          AND source_type = 'kb_gap_sweep'
          AND created_at >= NOW() - INTERVAL '14 days'
      `);
      if (((dup[0]?.count as number) ?? 0) > 0) continue;

      await this.selfImprovement.proposeKbGapEntry({
        siteKey,
        entryType: p.entryType ?? 'reference',
        title: p.title,
        content: p.content,
        reasoning: p.reasoning ?? '',
        occurrenceCount: p.occurrenceCount,
        theme: p.theme ?? p.title,
      });
      this.logger.log(`KB gap proposal created for site ${siteKey}: "${p.title}" (${p.occurrenceCount}x)`);
    }
  }

  // Human-readable wait duration from the moment the session entered 'needs_human'.
  private formatWait(needsHumanAt: string | null): string {
    if (!needsHumanAt) return 'a few minutes';
    const started = new Date(needsHumanAt).getTime();
    if (Number.isNaN(started)) return 'a few minutes';
    const mins = Math.max(3, Math.round((Date.now() - started) / 60000));
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h} hour${h === 1 ? '' : 's'}`;
  }

  private buildHumanAlertHtml(input: {
    visitorLabel: string;
    visitorName: string | null;
    visitorEmail: string | null;
    siteName: string;
    brandColor: string;
    waitText: string;
    lastQuestion: string | null;
    joinUrl: string | null;
  }): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const label = esc(input.visitorLabel);
    const site = esc(input.siteName);
    const wait = esc(input.waitText);
    const name = input.visitorName?.trim() ? esc(input.visitorName.trim()) : '—';
    const email = input.visitorEmail?.trim() ? esc(input.visitorEmail.trim()) : '—';

    const detailRow = (k: string, v: string) =>
      `<tr><td style="padding:6px 0;font-size:12px;color:#6b7280;width:74px;vertical-align:top;">${k}</td><td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">${v}</td></tr>`;

    const questionBlock = input.lastQuestion
      ? `<tr><td style="padding:4px 22px 0;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;margin-bottom:6px;">Their last message</div>
    <div style="border-left:3px solid ${input.brandColor};background:#f9fafb;padding:10px 14px;border-radius:0 8px 8px 0;font-size:14px;color:#374151;line-height:1.5;">${esc(input.lastQuestion)}</div>
  </td></tr>`
      : '';

    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
  <tr><td style="padding:20px 22px;background:${input.brandColor};color:#fff;">
    <div style="font-size:17px;font-weight:700;letter-spacing:-.01em;">🟠 A visitor needs a human agent</div>
    <div style="font-size:12px;opacity:.85;margin-top:3px;">${site} · live chat</div>
  </td></tr>
  <tr><td style="padding:20px 22px 8px;font-size:15px;color:#111827;line-height:1.6;">
    <strong>${label}</strong> has been waiting <strong>${wait}</strong> and no agent has joined yet. Jump in before they drop off.
  </td></tr>
  <tr><td style="padding:6px 22px 4px;">
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #eef0f3;border-radius:10px;padding:6px 14px;">
      ${detailRow('Name', name)}
      ${detailRow('Email', email)}
      ${detailRow('Waiting', wait)}
    </table>
  </td></tr>
  ${questionBlock}
  ${input.joinUrl ? `<tr><td style="padding:20px 22px 4px;">
    <a href="${esc(input.joinUrl)}" style="display:block;text-align:center;background:${input.brandColor};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 20px;border-radius:10px;">Join the chat →</a>
  </td></tr>
  <tr><td style="padding:8px 22px 18px;">
    <div style="font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">Opens the conversation with <strong>${label}</strong> in your live chat console. On your phone, open it from the installed app for the fastest reply.</div>
  </td></tr>` : `<tr><td style="padding:20px 22px;">
    <div style="font-size:13px;color:#6b7280;line-height:1.6;">
      Open the live chat dashboard, find <strong>${label}</strong> under <strong>Needs human</strong>, and take over the conversation. They'll get an in-chat note that an agent is on the way.
    </div>
  </td></tr>`}
</table>
<div style="max-width:520px;margin:14px auto 0;text-align:center;font-size:11px;color:#9ca3af;">You're receiving this because you're a live chat operator for ${site}.</div>
</body></html>`;
  }

  private buildVisitorHumanAlertHtml(input: { visitorLabel: string; siteName: string; brandColor: string }): string {
    const label = input.visitorLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const site = input.siteName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">
  <tr><td style="padding:18px 22px;background:${input.brandColor};color:#fff;">
    <div style="font-size:16px;font-weight:600;">We received your request</div>
    <div style="font-size:12px;opacity:.85;margin-top:2px;">${site}</div>
  </td></tr>
  <tr><td style="padding:18px 22px;font-size:14px;color:#1f2937;line-height:1.6;">
    Hi <strong>${label}</strong>,<br><br>
    Thanks for reaching out. We received your request for human assistance and our team has been notified.<br><br>
    Someone will join your chat shortly. You can also reply to this email and your message will be added to the conversation.
  </td></tr>
</table></body></html>`;
  }

  private buildText(input: { visitorLabel: string; botName: string; messages: { role: string; content: string; createdAt: Date }[] }): string {
    const lines = [`Hi ${input.visitorLabel},`, '', `You have unread messages from ${input.botName}:`, ''];
    for (const m of input.messages) {
      const speaker = m.role === 'visitor' ? input.visitorLabel : m.role === 'operator' ? 'Support' : input.botName;
      lines.push(`${speaker}: ${m.content}`);
    }
    lines.push('', 'Reply to this email to continue the conversation.');
    return lines.join('\n');
  }

  private buildHtml(input: { visitorLabel: string; botName: string; brandColor: string; messages: { role: string; content: string; createdAt: Date }[]; pixelUrl?: string | null }): string {
    const rows = input.messages.map((m) => {
      const isVisitor = m.role === 'visitor';
      const speaker = isVisitor ? input.visitorLabel : m.role === 'operator' ? 'Support' : input.botName;
      const bg = isVisitor ? '#f3f4f6' : input.brandColor;
      const fg = isVisitor ? '#1f2937' : '#ffffff';
      const text = m.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<tr><td align="${isVisitor ? 'left' : 'right'}" style="padding:4px 0;">
  <div style="display:inline-block;max-width:80%;">
    <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${speaker.replace(/&/g, '&amp;')}</div>
    <div style="display:inline-block;padding:8px 12px;background:${bg};color:${fg};border-radius:12px;font-size:14px;line-height:1.4;">${text}</div>
  </div>
</td></tr>`;
    }).join('');

    const pixel = input.pixelUrl
      ? `<img src="${input.pixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
      : '';
    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">
  <tr><td style="padding:18px 22px;background:${input.brandColor};color:#fff;">
    <div style="font-size:16px;font-weight:600;">You have unread messages</div>
    <div style="font-size:12px;opacity:.85;margin-top:2px;">From ${input.botName}</div>
  </td></tr>
  <tr><td style="padding:14px 22px;"><table cellpadding="0" cellspacing="0" width="100%">${rows}</table></td></tr>
  <tr><td style="padding:14px 22px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
    Reply to this email to continue your conversation — your reply will be added to the chat automatically.
  </td></tr>
</table>${pixel}</body></html>`;
  }
}
