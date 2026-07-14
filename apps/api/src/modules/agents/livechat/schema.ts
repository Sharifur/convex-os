import { pgTable, text, timestamp, boolean, integer, numeric, uniqueIndex, index, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const livechatSites = pgTable(
  'livechat_sites',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    key: text('key').notNull().unique(),
    label: text('label').notNull(),
    origin: text('origin').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    productContext: text('product_context'),
    replyTone: text('reply_tone'),
    trackBots: boolean('track_bots').notNull().default(false),
    autoApprove: boolean('auto_approve').notNull().default(true),
    botName: text('bot_name'),
    botSubtitle: text('bot_subtitle'),
    welcomeMessage: text('welcome_message'),
    welcomeQuickReplies: text('welcome_quick_replies'),
    brandColor: text('brand_color'),
    operatorName: text('operator_name'),
    position: text('position').notNull().default('bottom-right'),
    llmProvider: text('llm_provider'),
    llmModel: text('llm_model'),
    transcriptEnabled: boolean('transcript_enabled').notNull().default(false),
    transcriptBcc: text('transcript_bcc'),
    transcriptFrom: text('transcript_from'),
    humanAlertEmail: text('human_alert_email'),
    topicHandlingRules: text('topic_handling_rules'),
    requireEmail: boolean('require_email').notNull().default(false),
    widgetCacheBust: text('widget_cache_bust'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    originIdx: index('livechat_sites_origin_idx').on(t.origin),
  }),
);

export const livechatVisitors = pgTable(
  'livechat_visitors',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    siteId: text('site_id').notNull(),
    visitorId: text('visitor_id').notNull(),
    firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    ip: text('ip'),
    ipCountry: text('ip_country'),
    ipCountryName: text('ip_country_name'),
    ipRegion: text('ip_region'),
    ipCity: text('ip_city'),
    ipLat: numeric('ip_lat', { precision: 8, scale: 5 }),
    ipLon: numeric('ip_lon', { precision: 8, scale: 5 }),
    ipTimezone: text('ip_timezone'),
    ipIsp: text('ip_isp'),
    uaRaw: text('ua_raw'),
    browserName: text('browser_name'),
    browserVersion: text('browser_version'),
    osName: text('os_name'),
    osVersion: text('os_version'),
    deviceType: text('device_type'),
    deviceBrand: text('device_brand'),
    deviceModel: text('device_model'),
    language: text('language'),
    totalSessions: integer('total_sessions').notNull().default(0),
    totalMessages: integer('total_messages').notNull().default(0),
    totalPageviews: integer('total_pageviews').notNull().default(0),
  },
  (t) => ({
    siteVisitorUnique: uniqueIndex('livechat_visitors_site_visitor_unique').on(t.siteId, t.visitorId),
    siteIdx: index('livechat_visitors_site_idx').on(t.siteId),
    countryIdx: index('livechat_visitors_country_idx').on(t.ipCountry),
    lastSeenIdx: index('livechat_visitors_last_seen_idx').on(t.lastSeenAt),
  }),
);

export const livechatPageviews = pgTable(
  'livechat_pageviews',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    visitorPk: text('visitor_pk').notNull(),
    sessionId: text('session_id'),
    url: text('url').notNull(),
    path: text('path'),
    title: text('title'),
    referrer: text('referrer'),
    arrivedAt: timestamp('arrived_at').notNull().defaultNow(),
    leftAt: timestamp('left_at'),
    durationMs: integer('duration_ms'),
    seq: integer('seq'),
  },
  (t) => ({
    visitorIdx: index('livechat_pageviews_visitor_idx').on(t.visitorPk, t.arrivedAt),
    sessionIdx: index('livechat_pageviews_session_idx').on(t.sessionId),
  }),
);

export const livechatSessions = pgTable(
  'livechat_sessions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    siteId: text('site_id').notNull(),
    visitorPk: text('visitor_pk').notNull(),
    visitorId: text('visitor_id').notNull(),
    contactId: text('contact_id'),
    visitorEmail: text('visitor_email'),
    visitorName: text('visitor_name'),
    status: text('status').notNull().default('open'),
    currentPageUrl: text('current_page_url'),
    currentPageTitle: text('current_page_title'),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    transcriptSentAt: timestamp('transcript_sent_at'),
    inactivityEmailSentAt: timestamp('inactivity_email_sent_at'),
    needsHumanAt: timestamp('needs_human_at'),
    humanAlertSentAt: timestamp('human_alert_sent_at'),
    afterHoursNoticeSentAt: timestamp('after_hours_notice_sent_at'),
    pageContext: jsonb('page_context'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    siteVisitorUnique: uniqueIndex('livechat_sessions_site_visitor_unique').on(t.siteId, t.visitorId),
    statusIdx: index('livechat_sessions_status_idx').on(t.status),
    lastSeenIdx: index('livechat_sessions_last_seen_idx').on(t.lastSeenAt),
    contactIdx: index('livechat_sessions_contact_idx').on(t.contactId),
  }),
);

export const livechatMessages = pgTable(
  'livechat_messages',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    sessionId: text('session_id').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    pendingApproval: boolean('pending_approval').notNull().default(false),
    visitorRating: text('visitor_rating'),
    seenAt: timestamp('seen_at'),
    replyToId: text('reply_to_id'),
    replyToContent: text('reply_to_content'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('livechat_messages_session_idx').on(t.sessionId, t.createdAt),
  }),
);

export const livechatAttachments = pgTable(
  'livechat_attachments',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    sessionId: text('session_id').notNull(),
    messageId: text('message_id'),
    uploaderRole: text('uploader_role').notNull(),
    uploaderId: text('uploader_id'),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    r2Key: text('r2_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('livechat_attachments_session_idx').on(t.sessionId),
    messageIdx: index('livechat_attachments_message_idx').on(t.messageId),
  }),
);

export const livechatOperators = pgTable('livechat_operators', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  isDefault: boolean('is_default').notNull().default(false),
  siteKeys: text('site_keys'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Visitor-submitted thumbs rating after a session ends. One row per session.
export const livechatSessionFeedback = pgTable('livechat_session_feedback', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sessionId: text('session_id').notNull(),
  siteId: text('site_id').notNull(),
  rating: text('rating').notNull(), // 'up' | 'down'
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Questions the agent could not answer due to missing KB coverage or grounding failures.
export const livechatKbGaps = pgTable(
  'livechat_kb_gaps',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    siteKey: text('site_key').notNull(),
    sessionId: text('session_id').notNull(),
    visitorQuestion: text('visitor_question').notNull(),
    escalationReason: text('escalation_reason').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    siteKeyIdx: index('livechat_kb_gaps_site_key_idx').on(t.siteKey),
    createdAtIdx: index('livechat_kb_gaps_created_at_idx').on(t.createdAt),
  }),
);

// Operator flags on KB entries that produced a bad AI response.
export const livechatKbFlags = pgTable(
  'livechat_kb_flags',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    kbEntryId: text('kb_entry_id').notNull(),
    sessionId: text('session_id').notNull(),
    messageId: text('message_id').notNull(),
    siteKey: text('site_key').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    entryIdx: index('livechat_kb_flags_entry_idx').on(t.kbEntryId),
  }),
);
