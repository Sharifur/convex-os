import type { WidgetConfig } from './config';
import { sendMessage, identify, uploadAttachment, MessageResponse, SiteConfigResponse, AttachmentSummary, OperatorSummary, VisitorPageContext } from './api';
import { connectVisitorSocket, LivechatEvent } from './socket';
import { WIDGET_STYLES } from './styles';
import { EMOJI_CATEGORIES, applyEmojiShortcuts } from './emoji';
import { isDisposableEmail, warmDisposableEmailCache } from './disposable-email';
import type { Socket } from 'socket.io-client';

const DEFAULT_SITE_CONFIG: SiteConfigResponse = {
  siteKey: '',
  botName: 'Hi there',
  botSubtitle: 'We typically reply in a few seconds.',
  welcomeMessage: null,
  brandColor: '#2563eb',
  position: 'bottom-right',
};

interface VisitorMessage {
  id: string;
  role: 'visitor' | 'agent' | 'operator' | 'system';
  content: string;
  createdAt: string;
  attachments?: AttachmentSummary[];
  operatorName?: string;
  operatorAvatarUrl?: string;
  /** Quick-reply chips, attached server-side after a streamed reply ends. */
  suggestions?: string[];
}

const MESSAGES_KEY = 'livechat_messages_cache_v2';
const CACHE_BUST_KEY = 'livechat_cache_bust';
const SESSION_KEY = 'livechat_session_id';
const IDENTIFY_DISMISSED_KEY = 'livechat_identify_dismissed'; // legacy, retained to not re-prompt loyal visitors
const IDENTIFY_NAME_KEY = 'livechat_identify_name';            // 'saved' | 'skipped' | <stored name>
const IDENTIFY_EMAIL_KEY = 'livechat_identify_email';          // 'saved' | 'skipped'
const RATE_LIMIT_KEY = 'livechat_send_log';
const PROACTIVE_KEY = 'livechat_proactive_seen';
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const EMAIL_PROMPT_AFTER_VISITOR_MSGS = 3;

export function mountWidget(cfg: WidgetConfig, siteConfig: SiteConfigResponse = DEFAULT_SITE_CONFIG) {
  applyServerCacheBust(cfg.siteKey, siteConfig.cacheBust);
  const pageLoadTime = Date.now();
  const host = document.createElement('div');
  host.id = 'livechat-widget-root';
  const isMobileViewport = () => window.innerWidth <= 480;
  const MOBILE_HOST_BOTTOM = '10px';
  const MOBILE_HOST_RIGHT = '10px';
  const desktopHostCss = 'position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;';
  const mobileClosedCss = `position: fixed; bottom: ${MOBILE_HOST_BOTTOM}; right: ${MOBILE_HOST_RIGHT}; z-index: 2147483646;`;
  host.style.cssText = isMobileViewport() ? mobileClosedCss : desktopHostCss;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  // Apply per-site brand color via CSS custom properties on the host element.
  const brand = sanitizeColor(siteConfig.brandColor) ?? '#2563eb';
  const rgba = hexToRgba(brand, 0.35);
  const rgbaHover = hexToRgba(brand, 0.45);
  host.style.setProperty('--lc-brand', brand);
  host.style.setProperty('--lc-brand-shadow', rgba);
  host.style.setProperty('--lc-brand-shadow-hover', rgbaHover);
  // data-position on the embed tag overrides the site's saved position.
  const effectivePosition = cfg.position ?? siteConfig.position;
  if (effectivePosition === 'bottom-left') host.classList.add('lc-position-left');

  const styleEl = document.createElement('style');
  styleEl.textContent = WIDGET_STYLES;
  shadow.appendChild(styleEl);

  // host.style.cssText = '...' replaces ALL inline styles, wiping the CSS vars
  // above. Call this after every cssText assignment to restore them.
  const reapplyCssVars = () => {
    host.style.setProperty('--lc-brand', brand);
    host.style.setProperty('--lc-brand-shadow', rgba);
    host.style.setProperty('--lc-brand-shadow-hover', rgbaHover);
  };

  const state = {
    open: false,
    sessionId: readSessionId(),
    messages: readCachedMessages(),
    socket: null as Socket | null,
    panel: null as HTMLDivElement | null,
    askedForEmail: false,
    askedForName: false,
    knownName: readKnownName(),
    unread: 0,
    sessionClosed: false,
    feedbackAsked: false,
    operators: siteConfig.operators ?? [],
    host,
    cfg,
    reapplyCssVars,
    activeDraftId: null as string | null,
    historyPushed: false,
    pendingTrigger: undefined as string | undefined,
    closePanelAnim: undefined as (() => void) | undefined,
    collectPageContext: undefined as (() => VisitorPageContext) | undefined,
    requireEmail: siteConfig.requireEmail ?? false,
    showMsgPreview: undefined as ((text: string) => void) | undefined,
    startQueuePolling: undefined as (() => void) | undefined,
    stopQueuePolling: undefined as (() => void) | undefined,
  };

  const bubbleBtn = document.createElement('button');
  bubbleBtn.className = 'lc-bubble';
  bubbleBtn.setAttribute('aria-label', 'Open chat');
  bubbleBtn.setAttribute('title', 'Open chat');
  bubbleBtn.type = 'button';
  bubbleBtn.innerHTML = chatIcon();
  shadow.appendChild(bubbleBtn);

  const unreadBadge = document.createElement('span');
  unreadBadge.className = 'lc-unread';
  unreadBadge.style.display = 'none';
  bubbleBtn.appendChild(unreadBadge);

  // Proactive welcome bubble — floats above the chat button, auto-shows after 1.5s.
  const proactiveBubble = document.createElement('div');
  proactiveBubble.className = 'lc-proactive';
  proactiveBubble.style.display = 'none';
  if (siteConfig.welcomeMessage) {
    proactiveBubble.innerHTML = `
      <button class="lc-proactive-close" aria-label="Dismiss">&#x2715;</button>
      <div class="lc-proactive-text">${escapeHtml(siteConfig.welcomeMessage)}</div>
    `;
    shadow.appendChild(proactiveBubble);
    let proactiveSeen = false;
    try { proactiveSeen = !!sessionStorage.getItem(PROACTIVE_KEY); } catch {}
    if (cfg.popup !== false && !proactiveSeen) {
      setTimeout(() => {
        if (!state.open) proactiveBubble.style.display = 'block';
      }, cfg.popupDelay ?? 1500);
    }
    proactiveBubble.querySelector('.lc-proactive-close')!.addEventListener('click', (e) => {
      e.stopPropagation();
      proactiveBubble.style.display = 'none';
      try { sessionStorage.setItem(PROACTIVE_KEY, '1'); } catch {}
    });
    proactiveBubble.querySelector('.lc-proactive-text')!.addEventListener('click', () => {
      proactiveBubble.style.display = 'none';
      try { sessionStorage.setItem(PROACTIVE_KEY, '1'); } catch {}
      bubbleBtn.click();
    });
  }

  // Incoming message preview popup — shown above the bubble when minimised
  const msgPreview = document.createElement('div');
  msgPreview.className = 'lc-msg-preview';
  msgPreview.style.display = 'none';
  msgPreview.innerHTML = `<button class="lc-msg-preview-close" aria-label="Dismiss">&#x2715;</button><span class="lc-msg-preview-text"></span>`;
  shadow.appendChild(msgPreview);

  let previewDismissTimer: ReturnType<typeof setTimeout> | null = null;

  function showMsgPreview(text: string) {
    if (state.open) return;
    const clean = text.replace(/__[a-z_]+__/g, '').trim();
    if (!clean) return;
    const truncated = clean.length > 90 ? clean.slice(0, 87) + '...' : clean;
    const textEl = msgPreview.querySelector<HTMLElement>('.lc-msg-preview-text');
    if (textEl) textEl.textContent = truncated;
    msgPreview.style.display = 'block';
    if (previewDismissTimer) clearTimeout(previewDismissTimer);
    previewDismissTimer = setTimeout(() => { msgPreview.style.display = 'none'; }, 6000);
  }

  msgPreview.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.lc-msg-preview-close')) {
      msgPreview.style.display = 'none';
      if (previewDismissTimer) { clearTimeout(previewDismissTimer); previewDismissTimer = null; }
      return;
    }
    msgPreview.style.display = 'none';
    state.open = true;
    openPanel();
  });

  // Seed the welcome message as a system-style agent line if no prior conversation exists.
  if (state.messages.length === 0 && siteConfig.welcomeMessage) {
    state.messages.push({
      id: 'welcome',
      role: 'agent',
      content: siteConfig.welcomeMessage,
      createdAt: new Date().toISOString(),
    });
    cacheMessages(state.messages);
  }

  const panel = buildPanel(shadow, cfg, state, render, siteConfig);
  panel.style.display = 'none';
  state.panel = panel;
  (panel as any)._state = state;
  (panel as any)._cfg = cfg;

  // On mobile we pin the host to the Visual Viewport so it tracks the
  // visible area exactly — accounting for the browser URL bar (which slides
  // in/out on scroll) and the software keyboard. Without this the header
  // ends up hidden behind the URL bar on Chrome, Firefox, and Safari.
  function applyMobileHostStyle() {
    const vv = window.visualViewport;
    if (vv) {
      host.style.cssText = `position: fixed; top: ${vv.offsetTop}px; left: ${vv.offsetLeft}px; width: ${vv.width}px; height: ${vv.height}px; z-index: 2147483646;`;
    } else {
      host.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;`;
    }
    reapplyCssVars();
  }

  // Apply host layout for whichever state we're in. Debounced through RAF so
  // rapid VV events (iOS Safari URL-bar slide) don't cause visible jank.
  let vvRafId: number | null = null;
  function scheduleHostUpdate() {
    if (vvRafId !== null) cancelAnimationFrame(vvRafId);
    vvRafId = requestAnimationFrame(() => {
      vvRafId = null;
      if (!state.open) return;
      if (isMobileViewport()) applyMobileHostStyle();
      else { host.style.cssText = desktopHostCss; reapplyCssVars(); }
    });
  }

  let vvListenerInstalled = false;
  function ensureVvListener() {
    if (vvListenerInstalled || !window.visualViewport) return;
    vvListenerInstalled = true;
    window.visualViewport!.addEventListener('resize', scheduleHostUpdate);
    window.visualViewport!.addEventListener('scroll', scheduleHostUpdate);
    // orientationchange fires before VV dimensions settle — wait 150 ms for
    // the browser to finish the rotation before we read the new dimensions.
    window.addEventListener('orientationchange', () => {
      setTimeout(scheduleHostUpdate, 150);
    });
  }

  // Android back-button / browser back gesture: intercept by pushing a
  // history entry when the panel opens and listening for popstate.
  // When the user goes back, we close the panel instead of navigating away.
  // When the panel closes normally we call history.back() to pop our entry so
  // the browser's history stack stays clean. Guard prevents double-close.
  window.addEventListener('popstate', () => {
    if (state.open && state.historyPushed) {
      state.historyPushed = false;
      closePanelAnim();
    }
  });

  function collectPageContext(): VisitorPageContext {
    const ctx: VisitorPageContext = {};
    try {
      const scrollable = document.body.scrollHeight - window.innerHeight;
      ctx.scrollDepth = scrollable > 0 ? Math.round((window.scrollY / scrollable) * 100) : 100;
    } catch {}
    ctx.timeOnPageSec = Math.round((Date.now() - pageLoadTime) / 1000);
    try {
      const h1 = document.querySelector('h1')?.textContent?.trim().slice(0, 100);
      if (h1) ctx.pageH1 = h1;
    } catch {}
    try {
      const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim().slice(0, 200);
      if (desc) ctx.metaDescription = desc;
    } catch {}
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('utm_source')) ctx.utmSource = p.get('utm_source')!.slice(0, 80);
      if (p.get('utm_campaign')) ctx.utmCampaign = p.get('utm_campaign')!.slice(0, 80);
      if (p.get('utm_medium')) ctx.utmMedium = p.get('utm_medium')!.slice(0, 80);
      if (p.get('utm_term')) ctx.utmTerm = p.get('utm_term')!.slice(0, 80);
    } catch {}
    try {
      if (document.referrer) ctx.referrerDomain = new URL(document.referrer).hostname.slice(0, 100);
    } catch {}
    try {
      ctx.isReturnVisitor = !!localStorage.getItem('livechat_session_id');
    } catch {}
    if (state.pendingTrigger) {
      ctx.triggeredBy = state.pendingTrigger.slice(0, 100);
      state.pendingTrigger = undefined;
    }
    if (cfg.context && Object.keys(cfg.context).length) ctx.custom = cfg.context;
    return ctx;
  }
  state.collectPageContext = collectPageContext;

  // Layer 2: any element with [data-lc-open="label"] opens the chat and
  // records the trigger label so the agent knows why the visitor opened chat.
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-lc-open]');
    if (!el) return;
    e.preventDefault();
    state.pendingTrigger = el.getAttribute('data-lc-open') ?? undefined;
    if (!state.open) {
      state.open = true;
      openPanel();
    }
  });

  function openPanel() {
    if (isMobileViewport()) {
      applyMobileHostStyle();
      ensureVvListener();
      try { history.pushState({ lcPanel: true }, ''); state.historyPushed = true; } catch {}
    }
    panel.classList.remove('lc-panel--closing');
    panel.style.display = 'flex';
    state.unread = 0;
    unreadBadge.style.display = 'none';
    msgPreview.style.display = 'none';
    if (previewDismissTimer) { clearTimeout(previewDismissTimer); previewDismissTimer = null; }
    scrollMessagesToEnd(panel);
    markAgentMessagesSeen(state);

    panel.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }

  function closePanelAnim() {
    state.open = false;
    panel.classList.add('lc-panel--closing');
    setTimeout(() => {
      if (!state.open) {
        panel.style.display = 'none';
        if (isMobileViewport()) { host.style.cssText = mobileClosedCss; reapplyCssVars(); }
      }
      panel.classList.remove('lc-panel--closing');
    }, 180);
  }
  state.closePanelAnim = closePanelAnim;

  bubbleBtn.addEventListener('click', () => {
    proactiveBubble.style.display = 'none';
    try { sessionStorage.setItem(PROACTIVE_KEY, '1'); } catch {}
    state.open = !state.open;
    if (state.open) {
      openPanel();
    } else {
      if (state.historyPushed) {
        state.historyPushed = false;
        try { history.back(); } catch {} // pops our entry; popstate guard won't re-close (state.open=false)
      }
      closePanelAnim();
    }
  });

  state.showMsgPreview = showMsgPreview;

  // If we already had a session from a previous page load, reconnect socket.
  if (state.sessionId) connectAndListen(cfg, state, render, siteConfig);
  // Pre-fetch the disposable email domain list so the email-prompt save
  // handler can validate locally without a network round-trip.
  warmDisposableEmailCache();

  let queuePollTimer: ReturnType<typeof setInterval> | null = null;

  function updateQueueBanner(position: number) {
    const p = state.panel as HTMLDivElement | undefined;
    const textEl = p?.querySelector<HTMLSpanElement>('.lc-queue-banner-text');
    if (!textEl) return;
    if (position <= 0) {
      textEl.textContent = 'Waiting for a human agent…';
    } else if (position === 1) {
      textEl.textContent = 'You are next in queue — an agent will join shortly.';
    } else {
      textEl.textContent = `You are #${position} in queue — an agent will join shortly.`;
    }
  }

  function startQueuePolling() {
    if (queuePollTimer) return;
    void pollQueue();
    queuePollTimer = setInterval(() => { void pollQueue(); }, 30_000);
  }

  function stopQueuePolling() {
    if (queuePollTimer) { clearInterval(queuePollTimer); queuePollTimer = null; }
  }

  state.startQueuePolling = startQueuePolling;
  state.stopQueuePolling = stopQueuePolling;

  async function pollQueue() {
    const sessionId = state.sessionId;
    if (!sessionId) return;
    try {
      const res = await fetch(
        `${cfg.apiBase}/livechat/session/${encodeURIComponent(sessionId)}/queue?siteKey=${encodeURIComponent(cfg.siteKey)}&visitorId=${encodeURIComponent(cfg.visitorId)}`,
        { credentials: 'omit' },
      );
      if (!res.ok) return;
      const data = await res.json() as { position?: number; status?: string };
      if (data.status !== 'needs_human') {
        const p = state.panel as HTMLDivElement | undefined;
        const banner = p?.querySelector<HTMLDivElement>('.lc-queue-banner');
        if (banner) banner.style.display = 'none';
        stopQueuePolling();
        return;
      }
      updateQueueBanner(data.position ?? 0);
    } catch { /* ignore network errors */ }
  }

  if (state.sessionId) {
    void (async () => {
      try {
        const session = await fetch(
          `${cfg.apiBase}/livechat/session/${encodeURIComponent(state.sessionId!)}/queue?siteKey=${encodeURIComponent(cfg.siteKey)}&visitorId=${encodeURIComponent(cfg.visitorId)}`,
          { credentials: 'omit' },
        );
        if (session.ok) {
          const data = await session.json() as { position?: number; status?: string };
          if (data.status === 'needs_human') {
            const p = state.panel as HTMLDivElement | undefined;
            const banner = p?.querySelector<HTMLDivElement>('.lc-queue-banner');
            if (banner) banner.style.display = 'flex';
            updateQueueBanner(data.position ?? 0);
            startQueuePolling();
          }
        }
      } catch { /* ignore */ }
    })();
  }

  function render() {
    renderMessages(panel, state);
    if (!state.open && state.unread > 0) {
      unreadBadge.textContent = String(Math.min(state.unread, 99));
      unreadBadge.style.display = 'flex';
    } else {
      unreadBadge.style.display = 'none';
    }
  }

  render();

  if (cfg.autoOpen) {
    setTimeout(() => { bubbleBtn.click(); }, 0);
  }
}

function buildPanel(shadow: ShadowRoot, cfg: WidgetConfig, state: any, render: () => void, siteConfig: SiteConfigResponse): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'lc-panel';
  // Header title: when multiple operators are configured, naming a single
  // one ("Aysha") is misleading because the avatar stack shows several
  // people. Use the brand/bot label instead. Single-operator case keeps the
  // operator's name so it still feels personal.
  const opCount = (siteConfig.operators ?? []).length;
  const headerTitle = opCount > 1
    ? (siteConfig.botName?.trim() || siteConfig.operatorName || 'Chat with us')
    : (siteConfig.operatorName?.trim() || siteConfig.botName);
  panel.innerHTML = `
    <div class="lc-header">
      <div class="lc-header-top">
        <div class="lc-header-inner">
          ${renderHeaderAvatars(siteConfig.operators ?? [], siteConfig.operatorName)}
          <div class="lc-header-text">
            <div class="lc-header-title">${escapeHtml(headerTitle)}</div>
          </div>
        </div>
        <div class="lc-header-actions">
          <button class="lc-newchat-btn" aria-label="Start new conversation">${composeIcon()}</button>
          <button class="lc-menu-btn" aria-label="Conversation menu" aria-haspopup="true">${menuIcon()}</button>
          <div class="lc-menu" role="menu" style="display:none;">
            <button class="lc-menu-item" data-action="new">${refreshIcon()} Start a new conversation</button>
            <button class="lc-menu-item" data-action="close">${xIcon()} End this chat</button>
          </div>
          <button class="lc-close" aria-label="Close">${chevronDownIcon()}</button>
        </div>
      </div>
      <div class="lc-header-sub-row">
        <span class="lc-online-dot"></span>${escapeHtml(siteConfig.botSubtitle)}
      </div>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${chevronDownIcon()} New messages</button>
    </div>
    <div class="lc-quick-replies" style="display:none;"></div>
    <div class="lc-toast" role="alert" style="display:none;"></div>
    <div class="lc-queue-banner" style="display:none;">
      <span class="lc-queue-banner-dot"></span>
      <span class="lc-queue-banner-text">Waiting for a human agent…</span>
    </div>
    <div class="lc-pending" style="display:none;"></div>
    <div class="lc-session-end" style="display:none;">
      <span>This conversation has ended.</span>
      <button type="button" class="lc-session-end-btn">Start new chat</button>
    </div>
    <div class="lc-confirm" style="display:none;" role="dialog" aria-modal="true">
      <div class="lc-confirm-box">
        <p class="lc-confirm-msg"></p>
        <div class="lc-confirm-actions">
          <button type="button" class="lc-confirm-cancel">Cancel</button>
          <button type="button" class="lc-confirm-ok">Confirm</button>
        </div>
      </div>
    </div>
    <form class="lc-composer" autocomplete="off">
      <input class="lc-hp" name="website" tabindex="-1" autocomplete="off" />
      <input class="lc-file-input" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none;" />
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${attachIcon()}</button>
      <button type="button" class="lc-emoji-btn" aria-label="Insert emoji">${smileyIcon()}</button>
      <div class="lc-emoji-pop" style="display:none;" role="dialog" aria-label="Emoji picker">
        <div class="lc-emoji-tabs">${EMOJI_CATEGORIES.map((c, i) => `<button type="button" class="lc-emoji-tab${i === 0 ? ' lc-emoji-tab-active' : ''}" data-cat="${i}">${c.name}</button>`).join('')}</div>
        <div class="lc-emoji-grid">${EMOJI_CATEGORIES[0].emojis.map((e) => `<button type="button" class="lc-emoji-pick" data-emoji="${e}">${e}</button>`).join('')}</div>
      </div>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${sendIcon()}</button>
    </form>
  `;
  shadow.appendChild(panel);

  const isLeftPos = (state.host as HTMLDivElement).classList.contains('lc-position-left');
  const MOBILE_CLOSED_CSS_BP = isLeftPos
    ? `position: fixed; bottom: 10px; left: 10px; z-index: 2147483646;`
    : `position: fixed; bottom: 10px; right: 10px; z-index: 2147483646;`;
  const confirmOverlay = panel.querySelector<HTMLDivElement>('.lc-confirm')!;
  const confirmMsg = panel.querySelector<HTMLParagraphElement>('.lc-confirm-msg')!;
  const confirmOk = panel.querySelector<HTMLButtonElement>('.lc-confirm-ok')!;
  const confirmCancel = panel.querySelector<HTMLButtonElement>('.lc-confirm-cancel')!;

  function showConfirm(message: string, okLabel: string, onOk: () => void): void {
    confirmMsg.textContent = message;
    confirmOk.textContent = okLabel;
    confirmOverlay.style.display = 'flex';
    const cleanup = () => { confirmOverlay.style.display = 'none'; };
    const onOkClick = () => { cleanup(); confirmCancel.removeEventListener('click', onCancelClick); onOk(); };
    const onCancelClick = () => { cleanup(); confirmOk.removeEventListener('click', onOkClick); };
    confirmOk.addEventListener('click', onOkClick, { once: true });
    confirmCancel.addEventListener('click', onCancelClick, { once: true });
  }

  const newChatBtn = panel.querySelector<HTMLButtonElement>('.lc-newchat-btn')!;
  newChatBtn.addEventListener('click', () => {
    showConfirm('Start a new conversation? The current chat will be cleared.', 'Start new', resetSession);
  });
  const closeBtn = panel.querySelector<HTMLButtonElement>('.lc-close')!;
  closeBtn.addEventListener('click', () => {
    if (state.historyPushed) {
      state.historyPushed = false;
      try { history.back(); } catch {}
    }
    if (state.closePanelAnim) { state.closePanelAnim(); return; }
    // Fallback (closePanelAnim not yet registered)
    state.open = false;
    panel.classList.add('lc-panel--closing');
    setTimeout(() => {
      panel.style.display = 'none';
      if (window.innerWidth <= 480) { state.host.style.cssText = MOBILE_CLOSED_CSS_BP; state.reapplyCssVars?.(); }
      panel.classList.remove('lc-panel--closing');
    }, 180);
  });

  // Conversation menu — kebab in the header. Two actions:
  //   "Start a new conversation" — drops the local sessionId and clears the
  //     transcript so the next message creates a fresh session server-side.
  //   "End this chat" — best-effort closes the session via the public endpoint
  //     and shows the "new conversation" affordance once the panel is empty.
  const menuBtn = panel.querySelector<HTMLButtonElement>('.lc-menu-btn')!;
  const menu = panel.querySelector<HTMLDivElement>('.lc-menu')!;
  const closeMenu = () => { menu.style.display = 'none'; };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });
  panel.addEventListener('click', (e) => {
    if (!menu.contains(e.target as Node) && e.target !== menuBtn) closeMenu();
  });
  menu.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lc-menu-item');
    if (!btn) return;
    closeMenu();
    const action = btn.getAttribute('data-action');
    if (action === 'new') {
      showConfirm('Start a new conversation? The current chat will be cleared.', 'Start new', resetSession);
    } else if (action === 'close') {
      showConfirm('End this chat? You can always start a new one.', 'End chat', async () => {
      const sessionId = state.sessionId;
      if (sessionId) {
        // Fire-and-forget — the visitor doesn't need to wait on the network.
        try {
          await fetch(`${cfg.apiBase}/livechat/session/${encodeURIComponent(sessionId)}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteKey: cfg.siteKey, visitorId: cfg.visitorId }),
            credentials: 'omit',
          });
        } catch { /* ignore — the next /message call will start a fresh session anyway */ }
      }
      resetSession();
      // Replace the auto-pushed welcome with a "chat ended" line so the
      // visitor has visible confirmation that their request worked.
      state.messages = [{
        id: `system-${Date.now()}`,
        role: 'system',
        content: 'Chat ended. Type a message to start a new conversation.',
        createdAt: new Date().toISOString(),
      }];
      cacheMessages(state.messages);
      render();
      });
    }
  });

  const msgsEl = panel.querySelector<HTMLDivElement>('.lc-messages')!;
  const scrollBtn = panel.querySelector<HTMLButtonElement>('.lc-scroll-btn')!;
  msgsEl.addEventListener('scroll', () => {
    const dist = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight;
    scrollBtn.style.display = dist > 120 ? 'flex' : 'none';
  });
  scrollBtn.addEventListener('click', () => {
    msgsEl.scrollTop = msgsEl.scrollHeight;
    scrollBtn.style.display = 'none';
  });

  const form = panel.querySelector<HTMLFormElement>('.lc-composer')!;
  const textarea = panel.querySelector<HTMLTextAreaElement>('textarea')!;
  const honeypot = panel.querySelector<HTMLInputElement>('.lc-hp')!;
  const sendBtn = panel.querySelector<HTMLButtonElement>('.lc-composer button[type="submit"]')!;
  const attachBtn = panel.querySelector<HTMLButtonElement>('.lc-attach-btn')!;
  const fileInput = panel.querySelector<HTMLInputElement>('.lc-file-input')!;
  const pendingEl = panel.querySelector<HTMLDivElement>('.lc-pending')!;
  const quickRepliesEl = panel.querySelector<HTMLDivElement>('.lc-quick-replies')!;
  const sessionEndBanner = panel.querySelector<HTMLDivElement>('.lc-session-end')!;
  const sessionEndBtn = panel.querySelector<HTMLButtonElement>('.lc-session-end-btn')!;
  const emojiBtn = panel.querySelector<HTMLButtonElement>('.lc-emoji-btn')!;
  const emojiPop = panel.querySelector<HTMLDivElement>('.lc-emoji-pop')!;
  const emojiTabs = panel.querySelector<HTMLDivElement>('.lc-emoji-tabs')!;
  const emojiGrid = panel.querySelector<HTMLDivElement>('.lc-emoji-grid')!;

  // Emoji picker — toggle visibility, switch categories, insert at caret.
  function insertAtCaret(value: string) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.value = textarea.value.slice(0, start) + value + textarea.value.slice(end);
    const pos = start + value.length;
    textarea.setSelectionRange(pos, pos);
    textarea.focus();
  }
  function renderCategory(idx: number) {
    const cat = EMOJI_CATEGORIES[idx];
    if (!cat) return;
    emojiGrid.innerHTML = cat.emojis.map((e) => `<button type="button" class="lc-emoji-pick" data-emoji="${e}">${e}</button>`).join('');
  }
  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPop.style.display = emojiPop.style.display === 'none' ? 'block' : 'none';
  });
  panel.addEventListener('click', (e) => {
    if (e.target instanceof Node && !emojiPop.contains(e.target) && e.target !== emojiBtn) {
      emojiPop.style.display = 'none';
    }
  });
  emojiTabs.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>('.lc-emoji-tab');
    if (!t) return;
    emojiTabs.querySelectorAll('.lc-emoji-tab').forEach((b) => b.classList.remove('lc-emoji-tab-active'));
    t.classList.add('lc-emoji-tab-active');
    renderCategory(Number(t.getAttribute('data-cat') ?? 0));
  });
  emojiGrid.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>('.lc-emoji-pick');
    if (!t) return;
    insertAtCaret(t.getAttribute('data-emoji') ?? '');
  });
  // Live shortcut auto-replace as the visitor types space, enter, or punctuation.
  textarea.addEventListener('input', () => {
    const before = textarea.value;
    const after = applyEmojiShortcuts(before);
    if (after !== before) {
      const caretShift = after.length - before.length;
      const pos = (textarea.selectionStart ?? before.length) + caretShift;
      textarea.value = after;
      textarea.setSelectionRange(pos, pos);
    }
  });

  // "Start new chat" resets all session state so the visitor gets a fresh start.
  function resetSession() {
    state.socket?.disconnect();
    state.socket = null;
    state.sessionId = null;
    state.sessionClosed = false;
    state.messages = [];
    state.askedForEmail = false;
    state.unread = 0;
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    try { localStorage.removeItem(MESSAGES_KEY); } catch {}
    try { localStorage.removeItem(IDENTIFY_DISMISSED_KEY); } catch {}
    sessionEndBanner.style.display = 'none';
    textarea.disabled = false;
    sendBtn.disabled = false;
    attachBtn.disabled = false;
    if (siteConfig?.welcomeMessage) {
      state.messages.push({ id: 'welcome', role: 'agent', content: siteConfig.welcomeMessage, createdAt: new Date().toISOString() });
      cacheMessages(state.messages);
    }
    render();
  }
  sessionEndBtn.addEventListener('click', resetSession);

  const pendingAttachments: (AttachmentSummary & { localUrl?: string })[] = [];

  // Bot signals — sent with each message. Server uses these to silently
  // drop traffic without alerting attackers. Real users always pass.
  const panelMountedAt = Date.now();
  let hadInteraction = false;
  textarea.addEventListener('keydown', () => { hadInteraction = true; });
  textarea.addEventListener('input', () => { hadInteraction = true; });

  // Programmatic chip / quick-reply submit. Tapping a chip sets value
  // assignment which doesn't fire input/keydown, so we'd otherwise look
  // like a bot to the server. Mark interaction explicitly before submit.
  function submitFromChip(value: string) {
    textarea.value = value;
    hadInteraction = true;
    form.requestSubmit();
  }
  // Expose to renderMessages, which lives outside this closure but needs
  // to wire up agent-suggestion chips through the same hadInteraction gate.
  (panel as any)._submitFromChip = submitFromChip;

  // Show quick reply chips below the welcome bubble while no visitor message has
  // been sent yet. Tap = send that label as the visitor's first message.
  const renderQuickReplies = () => {
    const visitorHasSpoken = state.messages.some((m: VisitorMessage) => m.role === 'visitor');
    // Drop "talk to human" / "speak to a human" style pills — visitors don't
    // need a button for that; the AI escalates to human automatically when
    // the visitor asks. Surfacing the option on first paint signals the bot
    // can't actually help, which kills engagement.
    const HUMAN_RE = /\b(talk|speak|connect|chat)\b.*\b(human|agent|person|representative|support team)\b|\b(human|live agent|real person)\b/i;
    const chips = (siteConfig.welcomeQuickReplies ?? [])
      .filter(Boolean)
      .filter((label) => !HUMAN_RE.test(label));
    if (visitorHasSpoken || chips.length === 0) {
      quickRepliesEl.style.display = 'none';
      quickRepliesEl.innerHTML = '';
      return;
    }
    quickRepliesEl.style.display = 'flex';
    quickRepliesEl.innerHTML = chips
      .map((label, i) => `<button data-i="${i}" type="button">${escapeHtml(label)}</button>`)
      .join('');
    quickRepliesEl.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        const label = chips[i];
        if (!label) return;
        submitFromChip(label);
      });
    });
  };

  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast(panel, `File too large: ${file.name} (max 10 MB)`);
      return;
    }
    if (pendingAttachments.length >= 5) {
      showToast(panel, 'You can attach up to 5 files per message.');
      return;
    }
    if (!state.sessionId) {
      showToast(panel, 'Send a message first, then attach files.');
      return;
    }
    const localUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    const placeholder: AttachmentSummary & { localUrl?: string } = {
      id: 'pending-' + Date.now(),
      mimeType: file.type,
      sizeBytes: file.size,
      originalFilename: file.name,
      url: '',
      localUrl,
    };
    pendingAttachments.push(placeholder);
    renderPending();
    try {
      const att = await uploadAttachment(cfg, state.sessionId, file);
      const idx = pendingAttachments.indexOf(placeholder);
      if (idx >= 0) pendingAttachments[idx] = { ...att, localUrl };
      renderPending();
    } catch (err) {
      const idx = pendingAttachments.indexOf(placeholder);
      if (idx >= 0) pendingAttachments.splice(idx, 1);
      if (localUrl) URL.revokeObjectURL(localUrl);
      showToast(panel, `Upload failed: ${(err as Error).message}`);
      renderPending();
    }
  });

  function renderPending() {
    if (!pendingAttachments.length) {
      pendingEl.style.display = 'none';
      pendingEl.innerHTML = '';
      return;
    }
    pendingEl.style.display = 'flex';
    pendingEl.innerHTML = pendingAttachments
      .map((a, i) => {
        const isUploading = a.id.startsWith('pending-');
        const previewUrl = a.localUrl ?? '';
        const isImage = a.mimeType.startsWith('image/');
        const thumb = isImage && previewUrl
          ? `<img class="lc-chip-thumb" src="${escapeHtml(previewUrl)}" alt="">`
          : '';
        const label = isUploading
          ? `${thumb}<span class="lc-chip-label lc-chip-uploading">Uploading…</span><span class="lc-spinner"></span>`
          : `${thumb}<span class="lc-chip-label">${escapeHtml(a.originalFilename)}</span><button data-i="${i}" aria-label="Remove">×</button>`;
        return `<span class="lc-chip${isUploading ? ' lc-chip--busy' : ''}">${label}</span>`;
      })
      .join('');
    pendingEl.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        const removed = pendingAttachments.splice(i, 1)[0];
        if (removed?.localUrl) URL.revokeObjectURL(removed.localUrl);
        renderPending();
      });
    });
  }

  let typingOffTimer: ReturnType<typeof setTimeout> | null = null;
  let typingOn = false;
  const sendTypingState = (on: boolean) => {
    if (typingOn === on) return;
    typingOn = on;
    state.socket?.emit('livechat:typing', { on });
  };
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(120, textarea.scrollHeight) + 'px';
    if (textarea.value.trim()) {
      sendTypingState(true);
      if (typingOffTimer) clearTimeout(typingOffTimer);
      typingOffTimer = setTimeout(() => sendTypingState(false), 1500);
    } else {
      sendTypingState(false);
    }
  });
  textarea.addEventListener('blur', () => sendTypingState(false));
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  // Paste-to-upload: any image in the clipboard becomes an attachment.
  textarea.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (!files.length) return;
    e.preventDefault();
    if (!state.sessionId) {
      showToast(panel, 'Send a message first, then paste images.');
      return;
    }
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        showToast(panel, `Pasted image too large: ${file.name || 'image'} (max 10 MB)`);
        continue;
      }
      if (pendingAttachments.length >= 5) break;
      const namedFile = file.name ? file : new File([file], `pasted-${Date.now()}.png`, { type: file.type });
      const localUrl = URL.createObjectURL(namedFile);
      const placeholder: AttachmentSummary & { localUrl?: string } = {
        id: 'pending-' + Math.random().toString(36).slice(2),
        mimeType: file.type,
        sizeBytes: file.size,
        originalFilename: namedFile.name,
        url: '',
        localUrl,
      };
      pendingAttachments.push(placeholder);
      renderPending();
      try {
        const att = await uploadAttachment(cfg, state.sessionId, namedFile);
        const idx = pendingAttachments.indexOf(placeholder);
        if (idx >= 0) pendingAttachments[idx] = { ...att, localUrl };
        renderPending();
      } catch (err) {
        const idx = pendingAttachments.indexOf(placeholder);
        if (idx >= 0) pendingAttachments.splice(idx, 1);
        URL.revokeObjectURL(localUrl);
        showToast(panel, `Upload failed: ${(err as Error).message}`);
        renderPending();
      }
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (honeypot.value) return;
    if (state.sessionClosed) {
      showToast(panel, 'This conversation has ended. Start a new chat below.');
      return;
    }
    const content = textarea.value.trim();
    // Auto-capture email if visitor types one and we don't have it yet.
    const emailInMsg = /[^\s,;'"<>]+@[^\s,;'"<>]+\.[^\s,;'"<>]{2,}/.exec(content)?.[0];
    if (emailInMsg) {
      let emailAlreadySaved = false;
      try { const v = localStorage.getItem(IDENTIFY_EMAIL_KEY); emailAlreadySaved = v === 'saved' || (!!v && v !== 'skipped'); } catch {}
      if (!emailAlreadySaved) {
        import('./api').then((m) => m.identify(cfg, { email: emailInMsg })).then(() => {
          try { localStorage.setItem(IDENTIFY_EMAIL_KEY, 'saved'); localStorage.setItem(IDENTIFY_DISMISSED_KEY, 'saved'); } catch {}
          // Fill the gate input if it's visible
          const gateInput = panel.querySelector<HTMLInputElement>('.lc-gate-email');
          if (gateInput) gateInput.value = emailInMsg;
          const inlineInput = panel.querySelector<HTMLInputElement>('.lc-inline-identify[data-step="email"] .lc-inline-input');
          if (inlineInput) { inlineInput.value = emailInMsg; (inlineInput as any).closest?.('form')?.requestSubmit?.(); }
        }).catch(() => {});
      }
    }
    const stillUploading = pendingAttachments.some((a) => a.id.startsWith('pending-'));
    const readyAttachments = pendingAttachments.filter((a) => a.url && !a.id.startsWith('pending-'));
    if (stillUploading) {
      showToast(panel, 'Your image is still uploading — please wait a moment.');
      return;
    }
    if (!content && !readyAttachments.length) return;
    if (!checkRateLimit()) {
      showToast(panel, 'Slow down — too many messages in the last minute.');
      return;
    }
    if (siteConfig.requireEmail) {
      let emailSaved = false;
      try { const v = localStorage.getItem(IDENTIFY_EMAIL_KEY); emailSaved = v === 'saved' || (!!v && v !== 'skipped'); } catch {}
      if (!emailSaved) {
        const hasVisitorMsgs = (state.messages as VisitorMessage[]).some((m) => m.role === 'visitor');
        if (hasVisitorMsgs) {
          showToast(panel, 'Please enter your email to continue.');
          const emailInput = panel.querySelector<HTMLInputElement>('.lc-inline-identify[data-step="email"] .lc-inline-input');
          if (emailInput) emailInput.focus();
          return;
        }
      }
    }
    sendBtn.disabled = true;
    textarea.value = '';
    textarea.style.height = 'auto';
    sendTypingState(false);

    pushVisitor(state, content, readyAttachments);
    pendingAttachments.length = 0;
    renderPending();
    renderQuickReplies();
    render();
    showTyping(panel);

    try {
      const res: MessageResponse = await sendMessage(
        cfg,
        content,
        readyAttachments.map((a) => a.id),
        {
          hp: honeypot.value || undefined,
          elapsedMs: Date.now() - panelMountedAt,
          hadInteraction,
        },
        state.collectPageContext?.() ?? {},
      );
      hideTyping(panel);
      state.sessionId = res.sessionId;
      writeSessionId(res.sessionId);
      if ('content' in res.agent && res.agent.content) {
        const agentId = res.agent.id ?? '';
        if (!state.socket) {
          // No WebSocket yet — HTTP is the only delivery path.
          pushAgent(state, res.agent.content, agentId);
        } else {
          // Socket is connected so WS stream events are the primary path.
          // fetch().then() is a microtask and runs before WS onmessage macrotasks,
          // so stream_start/end may not have processed yet even if they arrived.
          // Defer 250ms to let the event loop drain WS tasks first, then fall back
          // to HTTP content only if WS never delivered the message.
          const capturedContent = res.agent.content;
          setTimeout(() => {
            const alreadyDelivered =
              state.messages.some((m: VisitorMessage) => m.id === agentId) ||
              !!state.activeDraftId;
            if (!alreadyDelivered) {
              pushAgent(state, capturedContent, agentId);
              render();
            }
          }, 250);
        }
      }
      if (!state.socket) connectAndListen(cfg, state, render, siteConfig);
      if (siteConfig.requireEmail) {
        let emailSaved = false;
        try { const v = localStorage.getItem(IDENTIFY_EMAIL_KEY); emailSaved = v === 'saved' || (!!v && v !== 'skipped'); } catch {}
        if (!emailSaved) {
          const emailPromptShown = (state.messages as VisitorMessage[]).some((m: VisitorMessage) => m.id === 'identify-email' || m.id === 'identify-email-done');
          if (!emailPromptShown) {
            state.messages.push({ id: 'identify-email', role: 'agent', content: '__identify_email__', createdAt: new Date().toISOString() });
            render();
          }
        }
      } else {
        maybePromptEmail(panel, state, render);
      }
    } catch (err) {
      hideTyping(panel);
      showToast(panel, 'Could not send — please try again.');
    }
    sendBtn.disabled = false;
    render();
  });

  // Identify prompts are rendered inline in the message list as agent
  // messages — see renderMessages() for the markup. We bind click handlers
  // post-render via event delegation on the messages container.
  const messagesEl = panel.querySelector<HTMLDivElement>('.lc-messages')!;
  messagesEl.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const skipBtn = target.closest<HTMLButtonElement>('.lc-inline-skip');
    if (skipBtn) {
      const step = skipBtn.getAttribute('data-step');
      if (step === 'name') {
        try { localStorage.setItem(IDENTIFY_NAME_KEY, 'skipped'); } catch {}
      } else if (step === 'email') {
        try { localStorage.setItem(IDENTIFY_EMAIL_KEY, 'skipped'); } catch {}
      }
      // Drop the inline prompt from state and re-render.
      state.messages = (state.messages as VisitorMessage[]).filter((m) => m.id !== `identify-${step}`);
      render();
      return;
    }
    const saveBtn = target.closest<HTMLButtonElement>('.lc-inline-save');
    if (saveBtn) {
      const step = saveBtn.getAttribute('data-step');
      const wrap = saveBtn.closest('.lc-inline-identify') as HTMLDivElement | null;
      const input = wrap?.querySelector<HTMLInputElement>('input');
      const value = input?.value?.trim() ?? '';
      if (step === 'name') {
        if (!value) return;
        try {
          await identify(cfg, { name: value });
          state.knownName = value;
          try { localStorage.setItem(IDENTIFY_NAME_KEY, value); } catch {}
          // Replace the prompt with a friendly confirmation that stays in the thread.
          const idx = state.messages.findIndex((m: VisitorMessage) => m.id === 'identify-name');
          if (idx >= 0) {
            state.messages[idx] = {
              id: `identify-name-done`,
              role: 'system',
              content: `Nice to meet you, ${value}!`,
              createdAt: new Date().toISOString(),
            };
          }
          render();
        } catch { /* ignore */ }
      } else if (step === 'email') {
        const setError = (msg: string) => {
          input?.classList.add('lc-inline-input--invalid');
          let errEl = wrap?.querySelector('.lc-inline-error') as HTMLDivElement | null;
          if (!errEl && wrap) {
            errEl = document.createElement('div');
            errEl.className = 'lc-inline-error';
            wrap.querySelector('.lc-inline-row')?.after(errEl);
          }
          if (errEl) errEl.textContent = msg;
        };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          setError("That doesn't look right — double-check?");
          return;
        }
        if (await isDisposableEmail(value)) {
          setError('Please use a permanent email — we can’t follow up on temporary inboxes.');
          return;
        }
        try {
          await identify(cfg, { email: value });
          try { localStorage.setItem(IDENTIFY_EMAIL_KEY, 'saved'); } catch {}
          try { localStorage.setItem(IDENTIFY_DISMISSED_KEY, 'saved'); } catch {}
          const idx = state.messages.findIndex((m: VisitorMessage) => m.id === 'identify-email');
          if (idx >= 0) {
            state.messages[idx] = {
              id: `identify-email-done`,
              role: 'system',
              content: `Great — we'll reach out at ${value} if we miss you here.`,
              createdAt: new Date().toISOString(),
            };
          }
          render();
        } catch { /* ignore */ }
      }
    }
  });
  // Enter-to-save inside the inline inputs.
  messagesEl.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter') return;
    const target = ke.target as HTMLElement;
    if (!target.matches('.lc-inline-identify input')) return;
    ke.preventDefault();
    const wrap = target.closest('.lc-inline-identify');
    const saveBtn = wrap?.querySelector<HTMLButtonElement>('.lc-inline-save');
    saveBtn?.click();
  });

  // Initial quick-reply render — runs before the user has typed anything.
  renderQuickReplies();

  return panel;
}

function markAgentMessagesSeen(state: any) {
  if (!state.open || !state.socket) return;
  if (!state._seenIds) state._seenIds = new Set<string>();
  const unseen = (state.messages as VisitorMessage[])
    .filter((m) => (m.role === 'agent' || m.role === 'operator') && !state._seenIds.has(m.id))
    .map((m) => m.id);
  if (!unseen.length) return;
  unseen.forEach((id: string) => state._seenIds.add(id));
  state.socket.emit('livechat:messages_seen', { messageIds: unseen });
}

function connectAndListen(cfg: WidgetConfig, state: any, render: () => void, siteConfig?: SiteConfigResponse) {
  if (!state.sessionId || state.socket) return;
  state.socket = connectVisitorSocket(cfg, state.sessionId, (event: LivechatEvent) => {
    if (event.type === 'typing') {
      const panel = state.panel as HTMLDivElement | undefined;
      if (!panel) return;
      if (event.on) showTyping(panel);
      else hideTyping(panel);
      return;
    }

    if (event.type === 'session_status' && event.status === 'closed') {
      state.socket?.disconnect();
      state.socket = null;
      state.sessionClosed = true;
      // Show the session-end banner and disable the composer so the visitor
      // knows they need to start a new chat rather than keep typing.
      const p = state.panel as HTMLDivElement | undefined;
      if (p) {
        const banner = p.querySelector<HTMLDivElement>('.lc-session-end');
        const ta = p.querySelector<HTMLTextAreaElement>('textarea');
        const sb = p.querySelector<HTMLButtonElement>('.lc-composer button[type="submit"]');
        const ab = p.querySelector<HTMLButtonElement>('.lc-attach-btn');
        if (banner) banner.style.display = 'flex';
        if (ta) ta.disabled = true;
        if (sb) sb.disabled = true;
        if (ab) ab.disabled = true;
        // Push a system-style "How was this chat?" prompt with thumbs chips
        // unless we already asked.
        if (!state.feedbackAsked) {
          state.feedbackAsked = true;
          state.messages.push({
            id: `feedback-${Date.now()}`,
            role: 'system',
            content: '__feedback__',
            createdAt: new Date().toISOString(),
          });
        }
      }
      render();
      return;
    }

    if (event.type === 'session_status' && (event.status === 'needs_human' || event.status === 'human_taken_over' || event.status === 'open')) {
      const p = state.panel as HTMLDivElement | undefined;
      const banner = p?.querySelector<HTMLDivElement>('.lc-queue-banner');
      if (banner) {
        if (event.status === 'needs_human') {
          banner.style.display = 'flex';
          state.startQueuePolling?.();
        } else {
          banner.style.display = 'none';
          state.stopQueuePolling?.();
        }
      }
      return;
    }

    // Streaming reply: render a placeholder bubble keyed by draftId, append
    // deltas, then on stream_end swap the placeholder's id for the real
    // messageId so future renders dedupe correctly.
    //
    // stream_delta patches the streaming bubble's DOM node directly instead of
    // calling render() — a full render() rebuilds list.innerHTML on every chunk
    // which the browser can batch into a single repaint, making text appear all
    // at once. Direct DOM patching lets each chunk paint individually.
    if (event.type === 'agent_stream_start' && event.draftId) {
      const panel = state.panel as HTMLDivElement | undefined;
      if (panel) hideTyping(panel);
      if (!state.messages.some((m: VisitorMessage) => m.id === event.draftId)) {
        state.activeDraftId = event.draftId;
        state.messages.push({
          id: event.draftId,
          role: 'agent',
          content: '',
          createdAt: event.createdAt ?? new Date().toISOString(),
        });
        render(); // Creates the streaming bubble with lc-msg--streaming class
      }
      return;
    }
    if (event.type === 'agent_stream_delta' && event.draftId && event.delta) {
      const idx = state.messages.findIndex((m: VisitorMessage) => m.id === event.draftId);
      if (idx >= 0) {
        state.messages[idx] = { ...state.messages[idx], content: state.messages[idx].content + event.delta };
        const panel = state.panel as HTMLDivElement | undefined;
        const msgEl = panel?.querySelector<HTMLElement>('.lc-msg--streaming');
        if (msgEl) {
          // Show raw text during streaming — mdToHtml runs on stream_end.
          msgEl.textContent = state.messages[idx].content;
          const msgs = panel?.querySelector<HTMLDivElement>('.lc-messages');
          if (msgs) msgs.scrollTop = msgs.scrollHeight;
        } else {
          render();
        }
      }
      return;
    }
    if (event.type === 'agent_stream_end' && event.draftId && event.messageId) {
      state.activeDraftId = null;
      const draftIdx = state.messages.findIndex((m: VisitorMessage) => m.id === event.draftId);
      // Guard: if HTTP fallback already delivered this messageId, remove the orphaned
      // draft bubble instead of duplicating it. This handles the polling-transport race
      // where the POST response arrives before the WS stream_start event.
      if (state.messages.some((m: VisitorMessage) => m.id === event.messageId)) {
        if (draftIdx >= 0) {
          state.messages.splice(draftIdx, 1);
          cacheMessages(state.messages);
          render();
        }
        return;
      }
      if (draftIdx >= 0) {
        state.messages[draftIdx] = { ...state.messages[draftIdx], id: event.messageId, content: event.content ?? state.messages[draftIdx].content };
        cacheMessages(state.messages);
        if (!state.open) {
          state.unread = (state.unread ?? 0) + 1;
          playNotificationSound();
          state.showMsgPreview?.(event.content ?? state.messages[draftIdx].content);
        } else markAgentMessagesSeen(state);
        render();
      }
      return;
    }
    if (event.type === 'agent_suggestions' && event.messageId && event.suggestions?.length) {
      const idx = state.messages.findIndex((m: VisitorMessage) => m.id === event.messageId);
      if (idx >= 0) {
        state.messages[idx] = { ...state.messages[idx], suggestions: event.suggestions.slice(0, 3) };
        render();
      }
      return;
    }

    if (event.type !== 'message' || !event.messageId) return;
    if (event.role === 'visitor') return;
    if (state.messages.some((m: VisitorMessage) => m.id === event.messageId)) return;
    // If a streaming draft is in-flight and a plain message arrives, the stream was
    // abandoned (LLM error → fallback reply). Remove the orphaned draft bubble.
    if (state.activeDraftId) {
      const di = state.messages.findIndex((m: VisitorMessage) => m.id === state.activeDraftId);
      if (di >= 0) state.messages.splice(di, 1);
      state.activeDraftId = null;
    }
    if (event.role === 'system') {
      pushSystem(state, event.content ?? '', event.messageId);
    } else {
      const opName: string | undefined = (event as any).operatorName ?? undefined;
      // Server resolves the default operator and ships the avatar URL on the
      // event itself; fall back to the operators roster from /livechat/config
      // for older bundles still emitting just the name.
      const opAvatar: string | undefined =
        ((event as any).operatorAvatarUrl as string | undefined)
        ?? (opName ? (siteConfig?.operators?.find((op) => op.name === opName)?.avatarUrl ?? undefined) : undefined);
      pushAgent(state, event.content ?? '', event.messageId, event.role === 'operator', (event as any).attachments, opName, opAvatar);
    }
    const panel = state.panel as HTMLDivElement | undefined;
    if (panel) hideTyping(panel);
    if (!state.open) {
      state.unread = (state.unread ?? 0) + 1;
      playNotificationSound();
      state.showMsgPreview?.(event.content ?? '');
    } else markAgentMessagesSeen(state);
    render();
  });
}

function showRequireEmailGate(panel: HTMLDivElement, cfg: import('./config').WidgetConfig, state: any, render: () => void, siteConfig: import('./api').SiteConfigResponse) {
  const existing = panel.querySelector<HTMLDivElement>('.lc-email-gate');
  if (existing) { existing.style.display = 'flex'; return; }

  const gate = document.createElement('div');
  gate.className = 'lc-email-gate';
  gate.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;background:var(--lc-bg,#0f172a);z-index:10;';
  gate.innerHTML = `
    <div style="font-size:14px;font-weight:600;text-align:center;">Enter your email to start chatting</div>
    <div style="font-size:12px;color:#94a3b8;text-align:center;">We'll use this to follow up if we miss you.</div>
    <input class="lc-gate-email" type="email" placeholder="you@example.com" autocomplete="email"
      style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;" />
    <div class="lc-gate-error" style="color:#f87171;font-size:11px;display:none;"></div>
    <button class="lc-gate-submit" style="width:100%;padding:10px;border-radius:8px;background:var(--lc-brand,#2563eb);color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;">Continue</button>
  `;
  panel.appendChild(gate);

  const emailInput = gate.querySelector<HTMLInputElement>('.lc-gate-email')!;
  const errEl = gate.querySelector<HTMLDivElement>('.lc-gate-error')!;
  const submitBtn = gate.querySelector<HTMLButtonElement>('.lc-gate-submit')!;

  const showErr = (msg: string) => { errEl.textContent = msg; errEl.style.display = 'block'; };

  const submit = async () => {
    const val = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { showErr("That doesn't look like a valid email."); return; }
    errEl.style.display = 'none';
    submitBtn.disabled = true;
    try {
      await import('./api').then((m) => m.identify(cfg, { email: val }));
      try { localStorage.setItem(IDENTIFY_EMAIL_KEY, 'saved'); localStorage.setItem(IDENTIFY_DISMISSED_KEY, 'saved'); } catch {}
      gate.style.display = 'none';
      panel.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    } catch { showErr('Something went wrong — please try again.'); submitBtn.disabled = false; }
  };
  submitBtn.addEventListener('click', submit);
  emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  setTimeout(() => emailInput.focus(), 50);
}

function renderMessages(panel: HTMLDivElement, state: any) {
  const list = panel.querySelector<HTMLDivElement>('.lc-messages');
  if (!list) return;
  if (state.messages.length === 0) {
    list.innerHTML = `<div class="lc-empty">Send us a message — we will get right back to you.</div>`;
    return;
  }
  // Only the very last agent/operator message can show chips — once the visitor
  // replies, they're stale.
  const lastAgentIdx = (() => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const m = state.messages[i] as VisitorMessage;
      if (m.role === 'agent' || m.role === 'operator') return i;
      if (m.role === 'visitor') return -1;
    }
    return -1;
  })();
  list.innerHTML = state.messages
    .map((m: VisitorMessage, idx: number) => {
      // Inline identify prompts render as agent bubbles with embedded inputs
      // — no separate form below the composer, so it reads as part of the
      // conversation. data-step on the bubble drives the click handlers.
      if (m.content === '__identify_name__' || m.content === '__identify_email__') {
        const isName = m.content === '__identify_name__';
        const step = isName ? 'name' : 'email';
        const greet = !isName && state.knownName ? `<span class="lc-inline-greet">Thanks ${escapeHtml(state.knownName)}! </span>` : '';
        const prompt = isName
          ? `Mind if I get your name?`
          : `${greet}If we miss you here, what's the best email to follow up on?`;
        const placeholder = isName ? 'Your name' : 'you@example.com';
        const inputType = isName ? 'text' : 'email';
        const autoComp = isName ? 'given-name' : 'email';
        return `<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-ai">${aiSparkleIcon()}</div>
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-agent lc-inline-identify" data-step="${step}">
              <div class="lc-inline-prompt">${prompt}</div>
              <div class="lc-inline-row">
                <input type="${inputType}" class="lc-inline-input" placeholder="${placeholder}" autocomplete="${autoComp}" />
                <button type="button" class="lc-inline-save" data-step="${step}" aria-label="Save">${sendIcon()}</button>
              </div>
              ${isName || !state.requireEmail ? `<button type="button" class="lc-inline-skip" data-step="${step}">${isName ? 'Skip' : 'Maybe later'}</button>` : ''}
            </div>
          </div>
        </div>`;
      }

      // Visitor input stays plain (their own typing); agent / operator / system
      // get the markdown subset so **bold**, *italic*, and [links](…) render.
      const text = m.content
        ? (m.role === 'visitor' ? linkifyHtml(m.content) : mdToHtml(m.content))
        : '';
      const atts = (m.attachments ?? []).map(renderAttachment).join('');
      const attWrapper = atts ? `<div class="lc-attachments">${atts}</div>` : '';
      const time = formatTime(m.createdAt);
      const timeEl = time ? `<div class="lc-msg-time">${time}</div>` : '';
      const chips = (idx === lastAgentIdx && m.suggestions && m.suggestions.length)
        ? `<div class="lc-chips">${m.suggestions.map((s) => `<button class="lc-chip" data-chip="${escapeAttr(s)}">${escapeHtml(s)}</button>`).join('')}</div>`
        : '';

      if (m.role === 'system') {
        if (m.content === '__feedback__') {
          return `<div class="lc-msg lc-msg-system lc-feedback" data-feedback-id="${escapeAttr(m.id)}">
            <span>How was this chat?</span>
            <button class="lc-fb-btn" data-rating="up" aria-label="Good">👍</button>
            <button class="lc-fb-btn" data-rating="down" aria-label="Bad">👎</button>
          </div>`;
        }
        return `<div class="lc-msg lc-msg-system">${text}</div>`;
      }
      if (m.role === 'visitor') {
        return `<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${text}${attWrapper}</div>
            ${timeEl}
          </div>
        </div>`;
      }
      const ratingHtml = m.id && m.id !== 'welcome'
        ? `<div class="lc-msg-rating" data-msg-id="${escapeAttr(m.id)}">
            <button class="lc-rate-btn" data-rating="up" aria-label="Helpful">&#128077;</button>
            <button class="lc-rate-btn" data-rating="down" aria-label="Not helpful">&#128078;</button>
           </div>`
        : '';
      if (m.role === 'operator') {
        const name = m.operatorName ?? 'Operator';
        const avatarEl = m.operatorAvatarUrl
          ? `<img class="lc-msg-avatar lc-msg-avatar-img" src="${escapeAttr(m.operatorAvatarUrl)}" alt="${escapeHtml(name)}" title="${escapeHtml(name)}">`
          : `<div class="lc-msg-avatar lc-msg-avatar-op" title="${escapeHtml(name)}">${escapeHtml(getInitials(name))}</div>`;
        return `<div class="lc-msg-row lc-msg-row-agent">
          ${avatarEl}
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${escapeHtml(name)}</div>
            <div class="lc-msg lc-msg-agent">${text}${attWrapper}</div>
            ${timeEl}
            ${chips}
          </div>
        </div>`;
      }
      const isStreaming = m.id === state.activeDraftId;
      const streamClass = isStreaming ? ' lc-msg--streaming' : '';
      return `<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar lc-msg-avatar-ai">${aiSparkleIcon()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent${streamClass}">${isStreaming ? escapeHtml(m.content) : text}${attWrapper}</div>
          ${timeEl}
          ${chips}
          ${ratingHtml}
        </div>
      </div>`;
    })
    .join('');
  // Per-message rating buttons.
  list.querySelectorAll<HTMLDivElement>('.lc-msg-rating').forEach((wrapper) => {
    wrapper.querySelectorAll<HTMLButtonElement>('.lc-rate-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rating = btn.getAttribute('data-rating') as 'up' | 'down';
        const msgId = wrapper.getAttribute('data-msg-id') ?? '';
        const sessionId = (panel as any)._state?.sessionId ?? '';
        const cfg = (panel as any)._cfg;
        if (!msgId || !sessionId || !cfg) return;
        wrapper.querySelectorAll('.lc-rate-btn').forEach((b) => (b as HTMLButtonElement).disabled = true);
        btn.classList.add('lc-rate-btn--active');
        try {
          await fetch(`${cfg.apiBase}/livechat/session/${encodeURIComponent(sessionId)}/message/${encodeURIComponent(msgId)}/rating`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteKey: cfg.siteKey, visitorId: cfg.visitorId, rating }),
            credentials: 'omit',
          });
        } catch {}
      });
    });
  });
  // Bind chip clicks: paste the chip text into the textarea and submit.
  list.querySelectorAll<HTMLButtonElement>('.lc-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-chip') ?? '';
      if (!value) return;
      const submit = (panel as any)._submitFromChip as ((v: string) => void) | undefined;
      if (submit) submit(value);
      else {
        // Fallback for older builds — still set interaction flag via input event.
        const ta = panel.querySelector<HTMLTextAreaElement>('textarea');
        const f = panel.querySelector<HTMLFormElement>('.lc-composer');
        if (!ta || !f) return;
        ta.value = value;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        f.requestSubmit();
      }
    });
  });
  // Bind feedback-button clicks. Posts to /livechat/session/:id/feedback,
  // then collapses the prompt into a thank-you line.
  list.querySelectorAll<HTMLButtonElement>('.lc-fb-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const wrapper = btn.closest('.lc-feedback') as HTMLDivElement | null;
      const rating = btn.getAttribute('data-rating') as 'up' | 'down' | null;
      if (!wrapper || !rating) return;
      const sessionId = state.sessionId;
      const cfg = state.cfg;
      if (sessionId && cfg) {
        try {
          await fetch(`${cfg.apiBase}/livechat/session/${encodeURIComponent(sessionId)}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteKey: cfg.siteKey, visitorId: cfg.visitorId, rating }),
            credentials: 'omit',
          });
        } catch { /* ignore */ }
      }
      wrapper.innerHTML = `<span>Thanks for the feedback!</span>`;
    });
  });
  scrollMessagesToEnd(panel);
}

function scrollMessagesToEnd(panel: HTMLDivElement) {
  const list = panel.querySelector<HTMLDivElement>('.lc-messages');
  if (list) list.scrollTop = list.scrollHeight;
}

function showTyping(panel: HTMLDivElement) {
  const list = panel.querySelector<HTMLDivElement>('.lc-messages');
  if (!list || list.querySelector('.lc-typing')) return;
  const typing = document.createElement('div');
  typing.className = 'lc-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  list.appendChild(typing);
  list.scrollTop = list.scrollHeight;
}

function hideTyping(panel: HTMLDivElement) {
  panel.querySelectorAll('.lc-typing').forEach((n) => n.remove());
}

/**
 * Two-step identify flow rendered inline in the conversation thread, not as
 * a separate form. Each prompt is pushed as an agent-style message with a
 * single inline input so it reads as a natural part of the chat.
 *
 * Stage 1 — name: triggered after the first agent reply.
 * Stage 2 — email: triggered after EMAIL_PROMPT_AFTER_VISITOR_MSGS visitor turns.
 *
 * Each step is gated by a localStorage flag so dismissals stick across reloads.
 */
function maybePromptEmail(panel: HTMLDivElement, state: any, render: () => void) {
  let legacyDismissed = false;
  try { legacyDismissed = !!localStorage.getItem(IDENTIFY_DISMISSED_KEY); } catch {}
  const messages = state.messages as VisitorMessage[];
  const visitorTurns = messages.filter((m) => m.role === 'visitor').length;
  const agentTurns = messages.filter((m) => m.role === 'agent').length;

  let nameStored: string | null = null;
  try { nameStored = localStorage.getItem(IDENTIFY_NAME_KEY); } catch {}
  const nameAlreadyHandled = !!nameStored || !!state.knownName || legacyDismissed;
  const namePromptShown = messages.some((m) => m.id === 'identify-name' || m.id === 'identify-name-done');
  if (!nameAlreadyHandled && !namePromptShown && agentTurns >= 1) {
    state.askedForName = true;
    state.messages.push({
      id: 'identify-name',
      role: 'agent',
      content: '__identify_name__',
      createdAt: new Date().toISOString(),
    });
    render();
  }

  let emailHandled = false;
  try { emailHandled = !!localStorage.getItem(IDENTIFY_EMAIL_KEY); } catch {}
  const emailPromptShown = messages.some((m) => m.id === 'identify-email' || m.id === 'identify-email-done');
  if (!emailHandled && !legacyDismissed && !emailPromptShown && visitorTurns >= EMAIL_PROMPT_AFTER_VISITOR_MSGS) {
    state.askedForEmail = true;
    state.messages.push({
      id: 'identify-email',
      role: 'agent',
      content: '__identify_email__',
      createdAt: new Date().toISOString(),
    });
    render();
  }
}

function readKnownName(): string | null {
  try {
    const v = localStorage.getItem(IDENTIFY_NAME_KEY);
    if (!v || v === 'saved' || v === 'skipped') return null;
    return v;
  } catch {
    return null;
  }
}

function pushVisitor(state: any, content: string, attachments?: AttachmentSummary[]) {
  state.messages.push({
    id: 'local-' + Date.now(),
    role: 'visitor',
    content,
    createdAt: new Date().toISOString(),
    attachments,
  });
  cacheMessages(state.messages);
}
function pushAgent(state: any, content: string, id: string, asOperator = false, attachments?: AttachmentSummary[], operatorName?: string, operatorAvatarUrl?: string) {
  state.messages.push({
    id: id || 'srv-' + Date.now(),
    role: asOperator ? 'operator' : 'agent',
    content,
    createdAt: new Date().toISOString(),
    attachments,
    operatorName,
    operatorAvatarUrl,
  });
  cacheMessages(state.messages);
}
function pushSystem(state: any, content: string, id?: string) {
  state.messages.push({ id: id || 'sys-' + Date.now(), role: 'system', content, createdAt: new Date().toISOString() });
  cacheMessages(state.messages);
}

function checkRateLimit(): boolean {
  try {
    const now = Date.now();
    const log: number[] = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) ?? '[]').filter((t: number) => now - t < RATE_LIMIT_WINDOW_MS);
    if (log.length >= RATE_LIMIT_MAX) return false;
    log.push(now);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(log));
    return true;
  } catch {
    return true;
  }
}

function readSessionId(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
function writeSessionId(id: string) {
  try { localStorage.setItem(SESSION_KEY, id); } catch {}
}
function applyServerCacheBust(siteKey: string, serverBust: string | null | undefined) {
  if (!serverBust) return;
  try {
    const stored = localStorage.getItem(`${CACHE_BUST_KEY}_${siteKey}`);
    if (stored !== serverBust) {
      localStorage.removeItem(MESSAGES_KEY);
      localStorage.setItem(`${CACHE_BUST_KEY}_${siteKey}`, serverBust);
    }
  } catch {}
}

function readCachedMessages(): VisitorMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function cacheMessages(messages: VisitorMessage[]) {
  try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-50))); } catch {}
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function sanitizeColor(c: string | null | undefined): string | null {
  if (!c) return null;
  const trimmed = c.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  return trimmed;
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderAttachment(a: AttachmentSummary): string {
  const isImage = a.mimeType.startsWith('image/');
  if (isImage && a.url) {
    return `<a href="${escapeAttr(a.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${escapeAttr(a.url)}" alt="${escapeAttr(a.originalFilename)}" /></a>`;
  }
  const size = formatBytes(a.sizeBytes);
  const href = a.url ? escapeAttr(a.url) : '#';
  return `<a class="lc-attach-file" href="${href}" target="_blank" rel="noopener noreferrer">${fileIcon()}<span>${escapeHtml(a.originalFilename)}</span><span class="lc-attach-size">${size}</span></a>`;
}

/** Escape text and convert any http(s) URLs into rel-safe links opening in a new tab. */
function linkifyHtml(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const m = url.match(/[.,;:!?)]+$/);
    const tail = m ? m[0] : '';
    const clean = tail ? url.slice(0, -tail.length) : url;
    return `<a href="${escapeAttr(clean)}" target="_blank" rel="noopener noreferrer nofollow">${clean}</a>${tail}`;
  });
  return linked.replace(/\n/g, '<br>');
}

/**
 * Render a small markdown subset for agent/operator messages safely:
 * `code`, **bold**, *italic*, [text](url), and line breaks. Everything is
 * escaped first; markdown tokens then re-introduce a tightly whitelisted set
 * of tags. No headings, no images, no raw HTML — keeps the surface tiny.
 */
function mdToHtml(text: string): string {
  let s = escapeHtml(text);
  // Inline code first so its contents aren't re-processed by bold/italic/link.
  const codes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(`<code class="lc-md-code">${c}</code>`);
    return ` C${codes.length - 1} `;
  });
  // Markdown links [text](http(s)://...).
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  });
  // Bold **text** — non-greedy, no line breaks inside.
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  // Italic *text* — guard against the second char of `**` by requiring no `*` inside.
  s = s.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  // Bare URL linkify (avoid those already inside an href).
  s = s.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g, (_match, lead, url) => {
    const m = url.match(/[.,;:!?)]+$/);
    const tail = m ? m[0] : '';
    const clean = tail ? url.slice(0, -tail.length) : url;
    return `${lead}<a href="${escapeAttr(clean)}" target="_blank" rel="noopener noreferrer nofollow">${clean}</a>${tail}`;
  });
  // Restore code spans.
  s = s.replace(/ C(\d+) /g, (_, i) => codes[Number(i)] ?? '');
  // Newlines → <br>. Markdown's double-newline → paragraph would be overkill here.
  s = s.replace(/\n/g, '<br>');
  return s;
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function showToast(panel: HTMLDivElement, message: string, duration = 3500) {
  const toast = panel.querySelector<HTMLDivElement>('.lc-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout((toast as any)._timer);
  (toast as any)._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function attachIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>`;
}

function fileIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
}

function chatIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
}

function botAvatarIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
}

function msgBotIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
}

function chevronDownIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
}

function sendIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
}

function menuIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>`;
}

function refreshIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.36L3 16"/><path d="M3 21v-5h5"/></svg>`;
}

function xIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
}

function smileyIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`;
}

function aiSparkleIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>`;
}

function composeIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
}

function renderHeaderAvatars(operators: OperatorSummary[], fallbackName?: string | null): string {
  // Empty roster but a fallback name (e.g. site.operatorName) — render a single
  // initials-avatar so the header still feels personal instead of a generic bot.
  if (!operators.length && fallbackName?.trim()) {
    return `<div class="lc-header-avatars"><div class="lc-op-avatar lc-op-initials" style="z-index:3">${escapeHtml(getInitials(fallbackName.trim()))}</div></div>`;
  }
  if (!operators.length) {
    return `<div class="lc-header-avatar">${botAvatarIcon()}</div>`;
  }
  const shown = operators.slice(0, 3);
  const avatars = shown.map((op, i) => {
    const ml = i === 0 ? '' : 'margin-left:-10px;';
    const zi = `z-index:${3 - i};`;
    if (op.avatarUrl) {
      return `<img class="lc-op-avatar" src="${escapeAttr(op.avatarUrl)}" alt="${escapeHtml(op.name)}" style="${zi}${ml}">`;
    }
    return `<div class="lc-op-avatar lc-op-initials" style="${zi}${ml}">${escapeHtml(getInitials(op.name))}</div>`;
  }).join('');
  return `<div class="lc-header-avatars">${avatars}</div>`;
}
