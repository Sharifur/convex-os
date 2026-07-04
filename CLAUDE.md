# Cortex-OS — Task Tracker

## Project Prefix: CX

## Sprint 1 — Live Chat human-alert fixes
**Status:** COMPLETE
**Started:** 2026-06-23
**Closed:** 2026-06-23

### Tickets

| Ticket | Title | Status | Priority | Tokens | Description |
|--------|-------|--------|----------|--------|-------------|
| CX-001 | Send human-alert email only once per waiting chat | DONE | HIGH | ~30k | Still fires after the 3-min wait, but never re-sends for the same waiting period. Wait/alert reset when an agent joins so a re-escalation gets one fresh email. |
| CX-002 | "Needs human" attention badge on admin LiveChat inbox | DONE | MED | ~30k | Orange pulsing badge on inbox rows whose status is `needs_human` so operators can spot chats needing attention at a glance. |
| CX-003 | Improve human-alert admin email template | DONE | MED | ~25k | Richer, actionable email: visitor name/email, wait duration, their last message quoted, clearer CTA + footer. |
| CX-004 | Operator can reply in a closed chat (auto-reopen) | DONE | HIGH | ~25k | Composer enabled on closed chats; sending auto-reopens as `human_taken_over` (backend + frontend). |
| CX-005 | Email "Join the chat" deep-link opens the exact conversation | DONE | HIGH | ~35k | New `app_base_url` setting (default `https://cortex.xgenious.com`); email CTA + push link to `/livechat?session=<id>`; web auto-opens session from `?session=`. Push click opens in installed PWA via SW. iOS email links open in Safari (Apple PWA limitation). |
| CX-006 | Push notification deduped — once per waiting chat | DONE | HIGH | ~35k | Removed repeating per-message needs-human pushes; the inactivity sweep is now the single source (gated by `human_alert_sent_at`, reset on join), mirroring the email. |

### Sprint Stats
- Total: 6  /  TODO: 0  /  IN_PROGRESS: 0  /  DONE: 6  /  BLOCKED: 0
- Tokens: ~180k total

### Notes
- Email logic: `apps/api/src/modules/agents/livechat/livechat-inactivity.service.ts` (`sweepNeedsHuman`)
- Wait/alert reset: `apps/api/src/modules/agents/livechat/livechat.service.ts` (`setSessionStatus`) — `humanAlertSentAt` reset to null on entering `needs_human`, and on join/reopen (`human_taken_over`/`open`).
- Badge: `apps/web/src/pages/LiveChatPage.tsx` (`InboxRow`)
- Email template: `livechat-inactivity.service.ts` (`buildHumanAlertHtml`, `formatWait`, `sendHumanAlertEmail`)
- Reopen-on-reply: `livechat-conversations.controller.ts` (`operatorReply`) + `LiveChatPage.tsx` (`composerEnabled`)

## Sprint 2 — Live Chat AI answer accuracy
**Status:** IN PROGRESS
**Started:** 2026-06-23

### Tickets

| Ticket | Title | Status | Priority | Tokens | Description |
|--------|-------|--------|----------|--------|-------------|
| CX-007 | Lock AI replies to the product the visitor is viewing | DONE | HIGH | ~45k | Bot quoted SafeCart's price to a visitor on the Influstar page. Root cause: `getAlwaysOnContext` loads ALL site products/offers and `buildKbPromptBlock` renders them side-by-side, so the model can grab the wrong product's pricing. Fix: resolve the active product from the current page (title + sourceUrl) and strip sibling-product entries from catalog/references at the data layer (template-independent), pin PRODUCT LOCK to the active product. Decisions: stay locked to current product (siblings only if visitor names them); match by title + sourceUrl. |
| CX-008 | Sitemap import with background job + polling | DONE | MED | ~35k | KB import tab gains a 3rd "Sitemap" mode. Accepts a sitemap URL or uploaded XML file (handles sitemap index nesting). Backend parses URLs synchronously, returns jobId immediately, processes up to 5,000 URLs in the background. Frontend polls every 2s and shows a live progress bar with imported/skipped/failed counts. |
| CX-009 | Add `documentation` KB type + fix pricing/how-it-works escalation | DONE | HIGH | ~25k | New entry type `documentation` — always injected into AI context for the active product (no search ranking required). Fixes: (1) sitemap import defaults to `documentation`; (2) `hasPricingInKb` also checks documentation entries; (3) `PRICE_PATTERN` extended to EUR/GBP/per-month formats; (4) `fetchPagePricingContext` snippet extractor fixed to catch "pricing" keyword windows (was matching pric in gate check but not in extractor). |

### Sprint Stats
- Total: 3  /  TODO: 0  /  IN_PROGRESS: 0  /  DONE: 3  /  BLOCKED: 0
- Tokens: ~105k total

### Notes
- AI reply pipeline: `apps/api/src/modules/agents/livechat/agent.ts` (`handleVisitorMessage`)
- KB retrieval/render: `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` (`searchEntries`, `getAlwaysOnContext`, `buildKbPromptBlock`)
- Product lock helpers + scoping live in `agent.ts` (`resolveActiveProduct`, `scopeEntriesToProduct`, `productPrimaryName`).
- `documentation` type: `schema.ts` comment, `getAlwaysOnContext` IN list, `buildKbPromptBlock` `## Product Documentation` section (1200 chars/entry, max 12).
- Sitemap import: `knowledge-base-ingestion.service.ts` `startSitemapJob` defaults `entryType='documentation'`; frontend `KnowledgeBasePage.tsx` shows type selector.
