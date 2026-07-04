import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const knowledgeEntries = pgTable('knowledge_entries', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  title:       text('title').notNull(),
  content:     text('content').notNull(),
  category:    text('category').notNull().default('general'),
  entryType:   text('entry_type').notNull().default('reference'),
  // 'reference'     — FTS-searched, injected when relevant to the message
  // 'fact'          — always injected regardless of message content
  // 'voice_profile' — global tone/style guide, always injected
  // 'blocklist'     — pattern to avoid in LLM output; one rule per entry
  // 'documentation' — always injected for the active product; use for product docs / how-it-works / pricing pages imported via sitemap
  priority:    integer('priority').notNull().default(50), // 1=low … 100=critical
  agentKeys:   text('agent_keys'),     // null = all agents; "livechat,support" = specific
  // Livechat-only site scoping. CSV strings; null/empty in both = applies to all sites.
  // siteKeys (include): only these sites match. excludedSiteKeys: all sites except these.
  // If both are set, include wins and exclude further narrows.
  siteKeys:          text('site_keys'),
  excludedSiteKeys:  text('excluded_site_keys'),
  sourceType:  text('source_type').notNull().default('manual'), // manual|pdf|docx|md|link
  sourceUrl:   text('source_url'),     // MinIO path or original URL
  parentDocId: text('parent_doc_id'), // set on chunk entries; FK to parent entry id
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
  lastRetrievedAt:  timestamp('last_retrieved_at'),
});

export const kbProposals = pgTable('kb_proposals', {
  id:                 text('id').primaryKey().$defaultFn(() => createId()),
  agentKey:           text('agent_key').notNull(),
  proposedEntryType:  text('proposed_entry_type').notNull(),
  title:              text('title').notNull(),
  content:            text('content').notNull(),
  polarity:           text('polarity'),
  reasoning:          text('reasoning'),
  telegramMessageId:  text('telegram_message_id'),
  status:             text('status').notNull().default('pending'),
  siteKey:            text('site_key'),
  sessionId:          text('session_id'),
  category:           text('category'),
  sourceType:         text('source_type').notNull().default('correction'),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
});

export const writingSamples = pgTable('writing_samples', {
  id:         text('id').primaryKey().$defaultFn(() => createId()),
  context:    text('context').notNull(),    // e.g. "angry customer reply"
  sampleText: text('sample_text').notNull(),
  polarity:   text('polarity').notNull().default('positive'), // 'positive' | 'negative'
  agentKeys:  text('agent_keys'),           // null = usable by all agents
  // Livechat-only site scoping (same shape as knowledgeEntries above).
  siteKeys:         text('site_keys'),
  excludedSiteKeys: text('excluded_site_keys'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
});
