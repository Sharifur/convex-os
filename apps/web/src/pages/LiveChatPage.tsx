import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  Globe,
  PencilLine,
  UserCheck,
  PlayCircle,
  Lock,
  Trash2,
  Plus,
  Send,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronDown,
  Phone,
  Video,
  Ban,
  MoreHorizontal,
  ArrowRight,
  Filter,
  CornerDownRight,
  Smile,
  Type,
  User as UserIcon,
  Code2,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Mail,
  Check as CheckIcon,
  XCircle,
  Pencil,
  ArrowLeft,
  Bell,
  BellOff,
  ThumbsDown,
  CheckCheck,
  CornerUpLeft,
  Languages,
  Flag,
  RefreshCw,
  Loader2,
  Search,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { getPushStatus, subscribePush, unsubscribePush, type PushStatus } from '@/lib/push';

async function apiFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
  return res.status === 204 ? null : res.json();
}

interface Site {
  id: string;
  key: string;
  label: string;
  origin: string;
  enabled: boolean;
  productContext: string | null;
  replyTone: string | null;
  trackBots: boolean;
  autoApprove: boolean;
  requireEmail: boolean;
  operatorName: string | null;
  botName: string | null;
  botSubtitle: string | null;
  welcomeMessage: string | null;
  welcomeQuickReplies: string[];
  brandColor: string | null;
  position: 'bottom-right' | 'bottom-left';
  llmProvider: string | null;
  llmModel: string | null;
  transcriptEnabled: boolean;
  transcriptBcc: string | null;
  transcriptFrom: string | null;
  humanAlertEmail: string | null;
  topicHandlingRules: string | null;
  createdAt: string;
}

interface Operator {
  id: string;
  name: string;
  avatarUrl: string | null;
  isDefault: boolean;
  siteKeys: string[] | null;
  createdAt: string;
}

interface SessionRow {
  id: string;
  siteId: string;
  siteKey: string | null;
  siteLabel: string | null;
  visitorPk: string;
  visitorId: string;
  visitorEmail: string | null;
  visitorName: string | null;
  status: string;
  currentPageUrl: string | null;
  currentPageTitle: string | null;
  lastSeenAt: string;
  ipCountry: string | null;
  ipCity: string | null;
  browserName: string | null;
  osName: string | null;
  language: string | null;
  lastMessage: { role: string; content: string; createdAt: string } | null;
  pendingDrafts?: number;
  pageContext?: PageContext | null;
}

interface Visitor {
  id: string;
  visitorId: string;
  ip: string | null;
  ipCountry: string | null;
  ipCountryName: string | null;
  ipCity: string | null;
  ipRegion: string | null;
  ipTimezone: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  language: string | null;
  totalSessions: number;
  totalMessages: number;
  totalPageviews: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface AttachmentSummary {
  id: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  url: string;
}

interface KbSource {
  id: string;
  title: string;
  entryType: string;
}

interface MessageRow {
  id: string;
  sessionId: string;
  role: 'visitor' | 'agent' | 'operator' | 'system' | 'note';
  content: string;
  createdAt: string;
  seenAt?: string | null;
  attachments?: AttachmentSummary[];
  pendingApproval?: boolean;
  replyToId?: string | null;
  replyToContent?: string | null;
  metadata?: { kbSources?: KbSource[]; sentViaEmail?: boolean } | null;
}

interface PageContext {
  referrerDomain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  [key: string]: unknown;
}

interface SessionDetail {
  session: SessionRow & { visitorPk: string; siteId: string; pageContext?: PageContext | null };
  visitor: Visitor | null;
  messages: MessageRow[];
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

const SEARCH_ENGINES: Record<string, string> = {
  'google.com': 'Google', 'www.google.com': 'Google',
  'bing.com': 'Bing', 'www.bing.com': 'Bing',
  'yahoo.com': 'Yahoo', 'search.yahoo.com': 'Yahoo',
  'duckduckgo.com': 'DuckDuckGo',
  'yandex.ru': 'Yandex', 'yandex.com': 'Yandex',
  'baidu.com': 'Baidu',
  'ecosia.org': 'Ecosia',
  'brave.com': 'Brave Search',
  'ask.com': 'Ask',
  'aol.com': 'AOL',
};

const AI_REFERRERS: Record<string, string> = {
  'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT',
  'gemini.google.com': 'Gemini', 'bard.google.com': 'Gemini',
  'claude.ai': 'Claude',
  'perplexity.ai': 'Perplexity',
  'copilot.microsoft.com': 'Copilot', 'bing.com/chat': 'Copilot',
  'you.com': 'You.com',
  'phind.com': 'Phind',
  'poe.com': 'Poe',
  'character.ai': 'Character.AI',
};

const SOCIAL_REFERRERS: Record<string, string> = {
  'facebook.com': 'Facebook', 'www.facebook.com': 'Facebook', 'l.facebook.com': 'Facebook',
  'twitter.com': 'X (Twitter)', 'x.com': 'X (Twitter)', 't.co': 'X (Twitter)',
  'linkedin.com': 'LinkedIn', 'www.linkedin.com': 'LinkedIn',
  'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram',
  'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
  'reddit.com': 'Reddit', 'old.reddit.com': 'Reddit',
  'pinterest.com': 'Pinterest',
  'tiktok.com': 'TikTok',
  'whatsapp.com': 'WhatsApp', 'wa.me': 'WhatsApp',
  'telegram.org': 'Telegram', 't.me': 'Telegram',
};

function classifyTrafficSource(ctx: PageContext | null | undefined): {
  type: 'search' | 'ai' | 'social' | 'email' | 'utm' | 'referral' | 'direct' | null;
  label: string;
  detail?: string;
} | null {
  if (!ctx) return null;

  if (ctx.utmSource) {
    const src = String(ctx.utmSource);
    const medium = ctx.utmMedium ? String(ctx.utmMedium) : '';
    const campaign = ctx.utmCampaign ? String(ctx.utmCampaign) : '';
    if (medium === 'email' || medium === 'newsletter') return { type: 'email', label: 'Email campaign', detail: campaign || src };
    return { type: 'utm', label: src, detail: campaign || medium || undefined };
  }

  const ref = ctx.referrerDomain ? String(ctx.referrerDomain).replace(/^www\./, '') : null;
  if (!ref) return { type: 'direct', label: 'Direct' };

  const fullRef = ctx.referrerDomain ? String(ctx.referrerDomain) : '';
  if (AI_REFERRERS[fullRef]) return { type: 'ai', label: AI_REFERRERS[fullRef] };
  if (SEARCH_ENGINES[fullRef]) return { type: 'search', label: SEARCH_ENGINES[fullRef] };
  if (SOCIAL_REFERRERS[fullRef]) return { type: 'social', label: SOCIAL_REFERRERS[fullRef] };

  const stripped = ref.startsWith('www.') ? ref.slice(4) : ref;
  if (AI_REFERRERS[stripped]) return { type: 'ai', label: AI_REFERRERS[stripped] };
  if (SEARCH_ENGINES[stripped]) return { type: 'search', label: SEARCH_ENGINES[stripped] };
  if (SOCIAL_REFERRERS[stripped]) return { type: 'social', label: SOCIAL_REFERRERS[stripped] };

  return { type: 'referral', label: ref };
}

const SOURCE_BADGE: Record<string, string> = {
  search: 'bg-blue-500/15 text-blue-400',
  ai: 'bg-purple-500/15 text-purple-400',
  social: 'bg-pink-500/15 text-pink-400',
  email: 'bg-yellow-500/15 text-yellow-400',
  utm: 'bg-green-500/15 text-green-400',
  referral: 'bg-orange-500/15 text-orange-400',
  direct: 'bg-muted text-muted-foreground',
};

const SOURCE_TAG: Record<string, string> = {
  search: 'Search',
  ai: 'AI',
  social: 'Social',
  email: 'Email',
  utm: 'Campaign',
  referral: 'Referral',
  direct: 'Direct',
};

type Tab = 'conversations' | 'sites' | 'operators' | 'setup' | 'debug';

export default function LiveChatPage() {
  const [tab, setTab] = useState<Tab>('conversations');

  return (
    <div className="h-full flex flex-col">
      <header className="px-3 sm:px-6 pt-3 sm:pt-5 pb-2 sm:pb-3 border-b border-border">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h1 className="text-base sm:text-lg font-semibold">Live Chat</h1>
          <div className="ml-auto">
            <PushNotificationsToggle />
          </div>
        </div>
        <nav className="flex gap-1 -mb-2 sm:-mb-3 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabButton active={tab === 'conversations'} onClick={() => setTab('conversations')}>
            Conversations
          </TabButton>
          <TabButton active={tab === 'sites'} onClick={() => setTab('sites')}>
            Sites
          </TabButton>
          <TabButton active={tab === 'operators'} onClick={() => setTab('operators')}>
            Operators
          </TabButton>
          <TabButton active={tab === 'setup'} onClick={() => setTab('setup')}>
            Setup
          </TabButton>
          <TabButton active={tab === 'debug'} onClick={() => setTab('debug')}>
            GEOLite2
          </TabButton>
        </nav>
      </header>
      <div className="flex-1 overflow-hidden">
        {tab === 'conversations' && <ConversationsTab />}
        {tab === 'sites' && <SitesTab />}
        {tab === 'operators' && <OperatorsTab />}
        {tab === 'setup' && <SetupTab />}
        {tab === 'debug' && <DebugTab />}
      </div>
    </div>
  );
}

function PushNotificationsToggle() {
  const token = useAuthStore((s) => s.token)!;
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    getPushStatus(token).then(setStatus);
  }, [token]);

  if (!status) return null;
  if (!status.supported) return null;
  if (!status.configured) {
    return (
      <button
        onClick={async () => {
          if (!confirm('Generate VAPID keys for push notifications? Safe to run once — refuses to overwrite existing keys.')) return;
          setBusy(true);
          try {
            const res = await fetch('/push/generate-vapid-keys', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) {
              alert(`Setup failed: ${data?.message ?? res.statusText}`);
            } else if (data?.alreadyConfigured) {
              alert('VAPID keys are already configured.');
            } else {
              alert('VAPID keys generated. Reload the page, then click "Enable push".');
            }
            setStatus(await getPushStatus(token));
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        title="Auto-generate VAPID keys for push notifications"
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
      >
        <BellOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Set up push</span>
      </button>
    );
  }

  const enable = async () => {
    setBusy(true);
    const res = await subscribePush(token);
    if (!res.ok) alert(res.error ?? 'Failed to enable notifications');
    setStatus(await getPushStatus(token));
    setBusy(false);
  };
  const disable = async () => {
    setBusy(true);
    await unsubscribePush(token);
    setStatus(await getPushStatus(token));
    setBusy(false);
  };

  if (status.subscribed) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch('/push/test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                alert(data?.message ?? 'Test failed');
              } else {
                setTestSent(true);
                setTimeout(() => setTestSent(false), 3000);
              }
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          title="Send a test push notification to this device"
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
        >
          <span className="hidden sm:inline">{testSent ? 'Sent!' : 'Test'}</span>
        </button>
        <button
          onClick={disable}
          disabled={busy}
          title="Disable push notifications on this device"
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">On</span>
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={enable}
      disabled={busy}
      title="Get a push notification when a visitor needs human help"
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
    >
      <BellOff className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Enable push</span>
    </button>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm border-b-2 transition-colors ${
        active ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sites tab
// ─────────────────────────────────────────────────────────────────────────────

function SitesTab() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ['livechat-sites'],
    queryFn: () => apiFetch(token, '/agents/livechat/sites'),
  });

  const [editing, setEditing] = useState<Partial<Site> | null>(null);
  const [installing, setInstalling] = useState<Site | null>(null);
  const [clearedSiteId, setClearedSiteId] = useState<string | null>(null);

  const clearCacheMut = useMutation({
    mutationFn: (siteId: string) =>
      apiFetch(token, `/agents/livechat/sites/${siteId}/clear-cache`, { method: 'POST' }),
    onSuccess: (_data, siteId) => {
      qc.invalidateQueries({ queryKey: ['livechat-sites'] });
      setClearedSiteId(siteId);
      setTimeout(() => setClearedSiteId(null), 2500);
    },
  });

  const saveMut = useMutation({
    mutationFn: async (s: Partial<Site>) => {
      const payload = {
        label: s.label,
        origin: s.origin,
        enabled: s.enabled,
        productContext: s.productContext ?? null,
        replyTone: s.replyTone ?? null,
        trackBots: s.trackBots,
        autoApprove: s.autoApprove,
        requireEmail: s.requireEmail ?? false,
        botName: s.botName ?? null,
        botSubtitle: s.botSubtitle ?? null,
        welcomeMessage: s.welcomeMessage ?? null,
        welcomeQuickReplies: s.welcomeQuickReplies ?? [],
        brandColor: s.brandColor ?? null,
        position: s.position ?? 'bottom-right',
        llmProvider: s.llmProvider ?? null,
        llmModel: s.llmModel ?? null,
        transcriptEnabled: s.transcriptEnabled ?? false,
        transcriptBcc: s.transcriptBcc ?? null,
        transcriptFrom: s.transcriptFrom ?? null,
        humanAlertEmail: s.humanAlertEmail ?? null,
        topicHandlingRules: s.topicHandlingRules ?? null,
      };
      if (s.id) {
        return apiFetch(token, `/agents/livechat/sites/${s.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      return apiFetch(token, '/agents/livechat/sites', {
        method: 'POST',
        body: JSON.stringify({ key: s.key, ...payload }),
      });
    },
    onSuccess: (saved: Site, vars: Partial<Site>) => {
      qc.invalidateQueries({ queryKey: ['livechat-sites'] });
      const wasCreate = !vars.id;
      setEditing(null);
      if (wasCreate && saved?.key) setInstalling(saved);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/agents/livechat/sites/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['livechat-sites'] }),
  });

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Each site row enables the live chat widget on a specific origin.</p>
          <Button size="sm" onClick={() => setEditing({ key: '', label: '', origin: '', enabled: true })}>
            <Plus className="w-4 h-4 mr-1" /> New site
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sites.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            No sites yet. Add one to start receiving chats.
          </div>
        ) : (
          sites.map((s) => (
            <div key={s.id} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full shrink-0 mt-0.5 border border-border"
                    style={{ background: s.brandColor ?? '#2563eb' }}
                    title={s.brandColor ?? '#2563eb'}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.botName?.trim() || s.label}</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.key}</code>
                      {!s.enabled && <span className="text-xs bg-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded">disabled</span>}
                      {s.position === 'bottom-left' && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">left</span>
                      )}
                      {s.llmModel && <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">{s.llmModel}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Globe className="w-3 h-3" /> {s.origin}
                    </div>
                    {s.welcomeMessage && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">"{s.welcomeMessage}"</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clearCacheMut.mutate(s.id)}
                    disabled={clearCacheMut.isPending}
                    title="Clear widget cache — forces all visitors to reload their conversation on next page visit"
                  >
                    {clearedSiteId === s.id
                      ? <Check className="w-4 h-4 text-emerald-500" />
                      : <RefreshCw className={`w-4 h-4 ${clearCacheMut.isPending ? 'animate-spin' : ''}`} />
                    }
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setInstalling(s)} title="Install instructions">
                    <Code2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                    <PencilLine className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete site "${s.label}"? This does not delete past sessions.`)) {
                        deleteMut.mutate(s.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              <SiteMetricsRow siteId={s.id} token={token} />
            </div>
          ))
        )}

        {editing && (
          <SiteFormModal
            site={editing}
            onClose={() => {
              saveMut.reset();
              setEditing(null);
            }}
            onSave={(s) => saveMut.mutate(s)}
            error={saveMut.isError ? parseSaveError((saveMut.error as Error)?.message) : null}
          />
        )}
        {installing && <InstallModal site={installing} freshlyCreated={!editing} onClose={() => setInstalling(null)} />}
      </div>
    </div>
  );
}

interface SiteMetrics {
  siteId: string;
  windowDays: number;
  sessionsTotal: number;
  sessionsClosed: number;
  sessionsEscalated: number;
  agentReplies: number;
  operatorReplies: number;
  fallbacks: number;
  thumbsUp: number;
  thumbsDown: number;
  csatPct: number | null;
  avgMessagesPerSession: number;
  avgFirstResponseMs: number | null;
}

function SiteMetricsRow({ siteId, token }: { siteId: string; token: string }) {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery<SiteMetrics>({
    queryKey: ['livechat-site-metrics', siteId, days],
    queryFn: () => apiFetch(token, `/agents/livechat/sites/${siteId}/metrics?days=${days}`),
    refetchInterval: 30_000,
  });
  if (isLoading || !data) {
    return (
      <div className="border-t border-border/50 pt-3 mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    );
  }
  const responseLabel = data.avgFirstResponseMs != null
    ? data.avgFirstResponseMs < 1000
      ? `${data.avgFirstResponseMs}ms`
      : `${(data.avgFirstResponseMs / 1000).toFixed(1)}s`
    : '—';
  return (
    <div className="border-t border-border/50 pt-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Quality · last {data.windowDays}d</span>
        <select
          className="text-[11px] bg-background border border-border rounded px-1.5 py-0.5"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={1}>24h</option>
          <option value={7}>7d</option>
          <option value={30}>30d</option>
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Metric label="Sessions" value={data.sessionsTotal} sub={`${data.sessionsEscalated} escalated`} />
        <Metric label="AI replies" value={data.agentReplies} sub={data.fallbacks > 0 ? `${data.fallbacks} fallback${data.fallbacks === 1 ? '' : 's'}` : undefined} />
        <Metric label="First response" value={responseLabel} sub={`${data.avgMessagesPerSession} msgs/session`} />
        <Metric
          label="CSAT"
          value={data.csatPct != null ? `${data.csatPct}%` : '—'}
          sub={data.thumbsUp + data.thumbsDown > 0 ? `${data.thumbsUp} up / ${data.thumbsDown} down` : 'no ratings yet'}
          accent={data.csatPct != null ? (data.csatPct >= 70 ? 'good' : data.csatPct >= 40 ? 'warn' : 'bad') : undefined}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: 'good' | 'warn' | 'bad' }) {
  const accentClass = accent === 'good' ? 'text-emerald-500' : accent === 'warn' ? 'text-yellow-500' : accent === 'bad' ? 'text-red-500' : '';
  return (
    <div className="bg-muted/30 rounded px-2 py-1.5">
      <div className={`text-base font-semibold ${accentClass}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function InstallModal({ site, freshlyCreated, onClose }: { site: Site; freshlyCreated: boolean; onClose: () => void }) {
  const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') || window.location.origin;
  const [showPopup, setShowPopup] = useState(true);
  const [autoOpen, setAutoOpen] = useState(false);
  const [popupDelay, setPopupDelay] = useState(1500);
  const [copied, setCopied] = useState(false);

  const extraAttrs = [
    !showPopup ? 'data-popup="false"' : '',
    autoOpen ? 'data-open="true"' : '',
    showPopup && popupDelay !== 1500 ? `data-delay="${popupDelay}"` : '',
  ].filter(Boolean).join(' ');
  const snippet = `<script src="${apiBase}/livechat.js" data-site="${site.key}"${extraAttrs ? ' ' + extraAttrs : ''} defer></script>`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-xl max-h-[90vh] overflow-auto p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {freshlyCreated && <Check className="w-5 h-5 text-emerald-500" />}
            <h3 className="font-semibold">
              {freshlyCreated ? `Site "${site.label}" created` : `Install "${site.label}"`}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Add this single &lt;script&gt; tag to <strong>{site.origin}</strong> to enable the chat widget. The same tag also handles visitor tracking — no extra setup needed.
          </p>
        </div>

        <div className="border border-border rounded-lg p-3 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customize embed</div>
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="text-sm font-medium">Show welcome popup</div>
              <div className="text-xs text-muted-foreground">Float the welcome message above the chat bubble on load</div>
            </div>
            <input
              type="checkbox"
              checked={showPopup}
              onChange={(e) => setShowPopup(e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </label>
          {showPopup && (
            <label className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Popup delay</div>
                <div className="text-xs text-muted-foreground">Milliseconds before the popup appears</div>
              </div>
              <input
                type="number"
                min={0}
                max={30000}
                step={500}
                value={popupDelay}
                onChange={(e) => setPopupDelay(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 text-sm border border-border rounded px-2 py-1 bg-background text-right"
              />
            </label>
          )}
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="text-sm font-medium">Auto-open on load</div>
              <div className="text-xs text-muted-foreground">Open the chat panel immediately without clicking the bubble</div>
            </div>
            <input
              type="checkbox"
              checked={autoOpen}
              onChange={(e) => setAutoOpen(e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Install snippet</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy snippet'}</span>
            </Button>
          </div>
          <code className="block text-xs bg-muted px-3 py-3 rounded font-mono break-all leading-relaxed">{snippet}</code>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Where to paste it</div>
          <ol className="text-sm space-y-1.5 list-decimal pl-5">
            <li>Open your site's HTML template (or footer partial / theme include).</li>
            <li>Paste the snippet just before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag so it loads after your page content.</li>
            <li>Deploy / publish the change. The widget loads with <code className="bg-muted px-1 rounded">defer</code> so it doesn't block your page paint.</li>
          </ol>
          <div className="mt-2 text-xs text-muted-foreground">
            Site origin must match exactly: <code className="bg-muted px-1 rounded">{site.origin}</code>. If your site serves both <code>www.</code> and apex, add a separate row for each.
          </div>
        </div>

        <div className="bg-muted/50 border border-border rounded p-3 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Security — automatic, no config needed</div>
          <ul className="text-sm space-y-1 list-disc pl-4 text-muted-foreground">
            <li><strong>Origin validation</strong> — every API request is checked against <code className="bg-muted px-1 rounded">{site.origin}</code>. Requests from any other origin are rejected (403).</li>
            <li><strong>Anti-bot signals</strong> — the widget silently sends a honeypot field, time-to-first-keystroke, and elapsed-typing time with each message. Bot submissions are filtered before reaching the AI.</li>
            <li><strong>Rate limiting</strong> — messages are capped per visitor per site key to prevent spam bursts.</li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Quick test</div>
          <ol className="text-sm space-y-1 list-decimal pl-5 text-muted-foreground">
            <li>Open <code className="bg-muted px-1 rounded">{site.origin}</code> in an incognito window.</li>
            <li>Look for the chat bubble in the {site.position === 'bottom-left' ? 'bottom-left' : 'bottom-right'} corner.</li>
            <li>Click it, send "hi" — the AI should reply within ~5 seconds.</li>
            <li>Open <strong>Live Chat → Conversations</strong> here; the new session shows up with the visitor's country and browser.</li>
          </ol>
        </div>

        <div className="border-t border-border -mx-5 px-5 pt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            For framework-specific guides (Next.js, WordPress, Shopify) and troubleshooting, see the <strong>Setup</strong> tab.
          </span>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Pull the human-readable `message` out of a NestJS BadRequest payload. */
function parseSaveError(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.message) return Array.isArray(parsed.message) ? parsed.message.join(', ') : String(parsed.message);
  } catch {
    // not JSON — return as-is
  }
  return raw;
}

/**
 * Sanitize a user-typed key to match the backend regex `^[a-z0-9_-]+$`.
 * Lowercases, replaces every other character with `-`, collapses runs.
 */
function sanitizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Normalize a single origin entry — URL, wildcard like *.example.com, or * for all. */
function normalizeOriginEntry(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return '';
  if (trimmed === '*') return '*';
  const wildcardMatch = trimmed.match(/^(?:https?:\/\/)?\*\.([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i);
  if (wildcardMatch) return `*.${wildcardMatch[1].toLowerCase()}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  return `https://${trimmed.replace(/\/+$/, '')}`;
}

/** Normalize a comma-separated (or newline-separated) list of origins/wildcards. */
function normalizeOriginInput(input: string): string {
  return input
    .split(/[\n,]+/)
    .map(normalizeOriginEntry)
    .filter(Boolean)
    .join(',');
}

function SiteFormModal({ site, onClose, onSave, error }: { site: Partial<Site>; onClose: () => void; onSave: (s: Partial<Site>) => void; error?: string | null }) {
  const [draft, setDraft] = useState<Partial<Site>>(site);
  const [section, setSection] = useState<'identity' | 'persona' | 'transcript' | 'advanced'>('identity');

  const isCreate = !site.id;
  // Live-derived key from the label, until the user explicitly types in the
  // key field — makes "type label, hit save" the happy path.
  const [keyTouched, setKeyTouched] = useState(!!site.key);
  useEffect(() => {
    if (isCreate && !keyTouched && draft.label) {
      setDraft((d) => ({ ...d, key: sanitizeKey(d.label ?? '') }));
    }
  }, [draft.label, keyTouched, isCreate]);

  const handleSave = () => {
    onSave({
      ...draft,
      key: draft.key ? sanitizeKey(draft.key) : draft.key,
      origin: draft.origin ? normalizeOriginInput(draft.origin) : draft.origin,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-xl max-h-[90vh] overflow-auto p-5 space-y-3">
        <h3 className="font-semibold">{site.id ? 'Edit site' : 'Add site'}</h3>
        <div className="flex gap-1 border-b border-border -mx-5 px-5">
          {(['identity', 'persona', 'transcript', 'advanced'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`text-sm px-3 py-2 border-b-2 capitalize ${
                section === s ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-xs bg-red-500/10 text-red-500 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {section === 'identity' && (
          <div className="space-y-2.5">
            <Field label="Label" hint="Display name used in the chat header.">
              <Input value={draft.label ?? ''} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Bytesed" />
            </Field>
            <Field label="Key" hint="Internal identifier. Auto-derived from label. Lowercase letters, digits, - or _ only — no dots or dashes-in-domains.">
              <Input
                value={draft.key ?? ''}
                disabled={!!site.id}
                onChange={(e) => {
                  setKeyTouched(true);
                  setDraft({ ...draft, key: e.target.value });
                }}
                onBlur={(e) => setDraft({ ...draft, key: sanitizeKey(e.target.value) })}
                placeholder="bytesed"
              />
            </Field>
            <Field label="Origin" hint="One origin per line (or comma-separated). Use *.example.com for all subdomains, or * to allow any domain. https:// added automatically.">
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                rows={3}
                value={(draft.origin ?? '').replace(/,/g, '\n')}
                onChange={(e) => setDraft({ ...draft, origin: e.target.value.replace(/\n/g, ',') })}
                onBlur={(e) => setDraft({ ...draft, origin: normalizeOriginInput(e.target.value) })}
                placeholder={'https://example.com\n*.example.com'}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.enabled ?? true} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.trackBots ?? false} onChange={(e) => setDraft({ ...draft, trackBots: e.target.checked })} />
                Track bots
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.requireEmail ?? false} onChange={(e) => setDraft({ ...draft, requireEmail: e.target.checked })} />
                Require email
              </label>
            </div>
            {draft.requireEmail && (
              <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md px-3 py-2">
                Visitors must enter their email before sending a message. The gate appears when the panel opens.
              </p>
            )}
          </div>
        )}

        {section === 'persona' && (
          <div className="space-y-2.5">
            <Field label="Bot name" hint="Shown in chat header. Defaults to site label.">
              <Input value={draft.botName ?? ''} onChange={(e) => setDraft({ ...draft, botName: e.target.value })} placeholder="Bytes Bot" />
            </Field>
            <Field label="Bot subtitle" hint="Small line under the bot name.">
              <Input value={draft.botSubtitle ?? ''} onChange={(e) => setDraft({ ...draft, botSubtitle: e.target.value })} placeholder="We typically reply in a few seconds." />
            </Field>
            <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md px-3 py-2">
              The operator shown in the chat header and on human replies is managed in the <strong>Operators</strong> tab.
            </div>
            <Field label="Welcome message" hint="First message shown when the visitor opens the chat.">
              <textarea
                value={draft.welcomeMessage ?? ''}
                onChange={(e) => setDraft({ ...draft, welcomeMessage: e.target.value })}
                className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 min-h-[60px]"
                placeholder="Hi! I'm here to help — ask me anything about Bytesed."
              />
            </Field>
            <Field
              label="Quick reply suggestions"
              hint="Tappable chips shown under the welcome message. One per line, max 6, max 60 chars each. Tapping a chip sends that text as the visitor's first message."
            >
              <textarea
                value={(draft.welcomeQuickReplies ?? []).join('\n')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    welcomeQuickReplies: e.target.value
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 min-h-[80px] font-mono"
                placeholder={'Pricing\nHow does it work?\nTalk to a human'}
              />
            </Field>
            <Field label="Product context" hint="Short description used in the AI's system prompt">
              <textarea
                value={draft.productContext ?? ''}
                onChange={(e) => setDraft({ ...draft, productContext: e.target.value })}
                className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 min-h-[60px]"
                placeholder="Bytesed builds…"
              />
            </Field>
            <Field label="Reply tone">
              <Input value={draft.replyTone ?? ''} onChange={(e) => setDraft({ ...draft, replyTone: e.target.value })} placeholder="friendly, concise" />
            </Field>
            <Field label="Topic handling instructions" hint="Tell the bot how to handle specific topics: support tickets, pricing questions, custom requests, etc. One instruction per line.">
              <textarea
                value={draft.topicHandlingRules ?? ''}
                onChange={(e) => setDraft({ ...draft, topicHandlingRules: e.target.value })}
                className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 min-h-[90px]"
                placeholder={"For support tickets: ask visitor to email support@yourcompany.com\nFor custom development: say we offer Enterprise plans, direct to /pricing\nFor refund requests: ask them to email billing@yourcompany.com"}
              />
            </Field>
            <div className="border border-border rounded-md p-3 bg-muted/30">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={draft.autoApprove ?? true}
                  onChange={(e) => setDraft({ ...draft, autoApprove: e.target.checked })}
                />
                Auto-send AI replies
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                On (default) — the AI's reply goes straight to the visitor. This is the point of live chat: full automation. Turn off only if this site needs every AI reply reviewed before it's sent. When off, drafts queue in <strong>Conversations</strong> with <strong>Approve / Edit / Reject</strong> buttons.
              </p>
            </div>
            <div className="flex items-end gap-3">
              <Field
                label="Brand color"
                hint={
                  draft.brandColor && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(draft.brandColor.trim())
                    ? 'Invalid hex — use #RRGGBB or #RGB. Will be ignored on save.'
                    : 'Bubble + visitor message background'
                }
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={
                      draft.brandColor && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(draft.brandColor.trim())
                        ? draft.brandColor
                        : '#2563eb'
                    }
                    onChange={(e) => setDraft({ ...draft, brandColor: e.target.value })}
                    className="w-10 h-9 border border-border rounded cursor-pointer bg-transparent"
                  />
                  <Input
                    value={draft.brandColor ?? ''}
                    onChange={(e) => setDraft({ ...draft, brandColor: e.target.value })}
                    placeholder="#2563eb"
                    className={`font-mono text-xs ${
                      draft.brandColor && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(draft.brandColor.trim())
                        ? 'border-red-500/50'
                        : ''
                    }`}
                  />
                </div>
              </Field>
              <Field label="Position">
                <select
                  value={draft.position ?? 'bottom-right'}
                  onChange={(e) => setDraft({ ...draft, position: e.target.value as 'bottom-right' | 'bottom-left' })}
                  className="text-sm bg-background border border-border rounded-md px-3 py-2"
                >
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        {section === 'transcript' && (
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground">
              When a session closes, the visitor's email gets a copy of the conversation. Requires AWS SES configured in Settings.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.transcriptEnabled ?? false}
                onChange={(e) => setDraft({ ...draft, transcriptEnabled: e.target.checked })}
              />
              Email transcript on close
            </label>
            <Field label="From address" hint="e.g. support@bytesed.com — must be verified in SES. Leaves blank to use platform default.">
              <Input
                value={draft.transcriptFrom ?? ''}
                onChange={(e) => setDraft({ ...draft, transcriptFrom: e.target.value })}
                placeholder="support@bytesed.com"
              />
            </Field>
            <Field label="BCC ops emails" hint="Comma-separated. Each address gets a hidden copy of every transcript.">
              <Input
                value={draft.transcriptBcc ?? ''}
                onChange={(e) => setDraft({ ...draft, transcriptBcc: e.target.value })}
                placeholder="ops@taskip.net, support@bytesed.com"
              />
            </Field>
            <Field label="Human alert email" hint="If a visitor requests human help and no operator joins within 3 minutes, an alert is sent here. Leave blank to use the platform default from address.">
              <Input
                value={draft.humanAlertEmail ?? ''}
                onChange={(e) => setDraft({ ...draft, humanAlertEmail: e.target.value || null })}
                placeholder="admin@example.com"
              />
            </Field>
          </div>
        )}

        {section === 'advanced' && (
          <div className="space-y-2.5">
            <Field label="LLM provider" hint="Per-site override. Leave blank to use the agent default.">
              <select
                value={draft.llmProvider ?? ''}
                onChange={(e) => setDraft({ ...draft, llmProvider: e.target.value || null })}
                className="w-full text-sm bg-background border border-border rounded-md px-3 py-2"
              >
                <option value="">— use agent default —</option>
                <option value="auto">auto (router fallback)</option>
                <option value="openai">openai</option>
                <option value="gemini">gemini</option>
                <option value="deepseek">deepseek</option>
              </select>
            </Field>
            <Field label="LLM model" hint="e.g. gpt-4o-mini, gemini-2.0-flash. Provider-specific.">
              <Input value={draft.llmModel ?? ''} onChange={(e) => setDraft({ ...draft, llmModel: e.target.value })} placeholder="gpt-4o-mini" />
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border -mx-5 px-5 pb-0 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversations tab — Crisp-style 3-column layout
// ─────────────────────────────────────────────────────────────────────────────

interface ChatToast {
  id: string;
  sessionId: string;
  visitorName: string;
  snippet: string;
  reason: 'needs_human' | 'new_message';
}

interface InboxFilter {
  key: string;
  label: string;
  status?: string;
  hasPendingDrafts?: boolean;
}

const STATUS_FILTERS: InboxFilter[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'needs_review', label: 'Needs review', hasPendingDrafts: true },
  { key: 'open', label: 'Open', status: 'open' },
  { key: 'needs_human', label: 'Needs human', status: 'needs_human' },
  { key: 'human_taken_over', label: 'Taken over', status: 'human_taken_over' },
  { key: 'closed', label: 'Closed', status: 'closed' },
];

// T4 chip set — shown inline; 'needs_reply' is client-side only.
const CHIP_FILTERS: InboxFilter[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'needs_review', label: 'Review', hasPendingDrafts: true },
  { key: 'open', label: 'Open', status: 'open' },
  { key: 'closed', label: 'Closed', status: 'closed' },
];

function needsReply(s: SessionRow): boolean {
  return s.lastMessage?.role === 'visitor' && s.status !== 'closed';
}

function waitMinutes(s: SessionRow): number | null {
  if (!needsReply(s) || !s.lastMessage?.createdAt) return null;
  return Math.floor((Date.now() - new Date(s.lastMessage.createdAt).getTime()) / 60_000);
}

interface LiveVisitor {
  visitorPk: string;
  visitorId: string;
  siteId: string;
  siteKey: string | null;
  siteLabel: string | null;
  ipCountry: string | null;
  ipCity: string | null;
  browserName: string | null;
  osName: string | null;
  deviceType: string | null;
  lastSeenAt: string;
  sessionId: string | null;
  sessionStatus: string | null;
  currentPageUrl: string | null;
  currentPageTitle: string | null;
  visitorEmail: string | null;
  visitorName: string | null;
}

function ConversationsTab() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const [filterKey, setFilterKey] = useState('all');
  const [filterSite, setFilterSite] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [advFilterOpen, setAdvFilterOpen] = useState(false);
  // Open the session named in ?session= on first render — set by the "Join the
  // chat" email button and the push-notification click handler, both of which
  // point the PWA at /livechat?session=<id>.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('session')),
  );
  const [showVisitors, setShowVisitors] = useState(true);
  const [toasts, setToasts] = useState<ChatToast[]>([]);
  const prevSessionsRef = useRef<Map<string, { status: string; lastMsgAt: string | null }>>(new Map());
  const isInitializedRef = useRef(false);
  const pendingDiffRef = useRef(false);
  const [bulkCloseConfirm, setBulkCloseConfirm] = useState(false);

  // Deep-link: react to navigation into a specific chat after first render —
  // browser back/forward, and the service worker's postMessage fallback when
  // the PWA window is already open and a notification is clicked.
  useEffect(() => {
    const applyFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get('session');
      if (id) setSelectedId(id);
    };
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') {
        const id = new URLSearchParams(e.data.url.split('?')[1] ?? '').get('session');
        if (id) setSelectedId(id);
      }
    };
    window.addEventListener('popstate', applyFromUrl);
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      window.removeEventListener('popstate', applyFromUrl);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, []);

  const filter = STATUS_FILTERS.find((f) => f.key === filterKey)!;

  // Sites for the filter dropdown.
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['livechat-sites'],
    queryFn: () => apiFetch(token, '/agents/livechat/sites'),
    staleTime: 60_000,
  });

  const sessionsKey = ['livechat-sessions', filter.status ?? 'all', filter.hasPendingDrafts ? 'pending' : 'any', filterSite ?? 'all'] as const;
  const { data: sessions = [], refetch: refetchList } = useQuery<SessionRow[]>({
    queryKey: sessionsKey,
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filter.status) qs.set('status', filter.status);
      if (filter.hasPendingDrafts) qs.set('hasPendingDrafts', 'true');
      if (filterSite) qs.set('siteKey', filterSite);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiFetch(token, `/agents/livechat/sessions${suffix}`);
    },
    refetchInterval: 60_000,
    staleTime: 5_000,
  });

  // T2/T3: stats derived from the loaded sessions array.
  const statsActive = useMemo(() => sessions.filter((s) => s.status !== 'closed').length, [sessions]);
  const statsNeedsReply = useMemo(() => sessions.filter(needsReply).length, [sessions]);
  const statsPendingReview = useMemo(() => sessions.filter((s) => (s.pendingDrafts ?? 0) > 0).length, [sessions]);

  // T4: client-side 'needs_reply' layer on top of server results.
  const baseFiltered = filterKey === 'needs_reply' ? sessions.filter(needsReply) : sessions;

  // Client-side text search across visitor name / email / last message.
  const searchedSessions = search.trim()
    ? baseFiltered.filter((s) => {
        const q = search.trim().toLowerCase();
        return (
          (s.visitorName ?? '').toLowerCase().includes(q) ||
          (s.visitorEmail ?? '').toLowerCase().includes(q) ||
          (s.lastMessage?.content ?? '').toLowerCase().includes(q) ||
          (s.currentPageTitle ?? '').toLowerCase().includes(q)
        );
      })
    : baseFiltered;

  // Pending review count for the filter chip badge.
  const pendingCountKey = ['livechat-pending-count'] as const;
  const { data: pendingCount } = useQuery<{ sessions: number; drafts: number }>({
    queryKey: pendingCountKey,
    queryFn: () => apiFetch(token, '/agents/livechat/sessions/pending-count'),
    refetchInterval: 60_000,
    staleTime: 5_000,
  });

  const bulkCloseMut = useMutation({
    mutationFn: (body: { siteKey?: string; status?: string }) =>
      apiFetch(token, '/agents/livechat/sessions/bulk-close', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['livechat-sessions'] });
      qc.invalidateQueries({ queryKey: ['livechat-pending-count'] });
      setBulkCloseConfirm(false);
    },
  });

  const liveKey = ['livechat-live-visitors'] as const;
  const { data: liveVisitors = [] } = useQuery<LiveVisitor[]>({
    queryKey: liveKey,
    queryFn: () => apiFetch(token, '/agents/livechat/visitors/live'),
    // Re-pull every 30s so visitors who closed their tab quietly drop off.
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  // Unfiltered sessions — used only for toast diff detection.
  const notifKey = ['livechat-sessions-notif'] as const;
  const { data: allForNotif = [] } = useQuery<SessionRow[]>({
    queryKey: notifKey,
    queryFn: () => apiFetch(token, '/agents/livechat/sessions'),
    staleTime: Infinity,
    refetchInterval: false,
  });

  // Operator socket: subscribes to session_upserted + visitor_activity events to
  // surgically refresh the inbox & live list without polling.
  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
    const url = apiBase || window.location.origin;
    const sock: Socket = io(url, {
      path: '/livechat-ws',
      auth: { operatorToken: token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    sock.on('livechat:operator', (event: { type: string }) => {
      if (event.type === 'session_upserted' || event.type === 'inbox_dirty') {
        qc.invalidateQueries({ queryKey: ['livechat-sessions'] });
        qc.invalidateQueries({ queryKey: pendingCountKey });
        if (event.type === 'session_upserted') {
          pendingDiffRef.current = true;
          qc.invalidateQueries({ queryKey: notifKey });
        }
      }
      if (event.type === 'new_visitor_message') {
        playNotificationSound();
      }
      if (event.type === 'visitor_activity' || event.type === 'visitor_offline') {
        qc.invalidateQueries({ queryKey: liveKey });
      }
    });
    return () => {
      sock.disconnect();
    };
  }, [token, qc]);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    const prev = prevSessionsRef.current;
    if (!isInitializedRef.current) {
      for (const s of allForNotif) {
        prev.set(s.id, { status: s.status, lastMsgAt: s.lastMessage?.createdAt ?? null });
      }
      isInitializedRef.current = true;
      return;
    }
    if (!pendingDiffRef.current) return;
    pendingDiffRef.current = false;

    const toAdd: ChatToast[] = [];
    for (const s of allForNotif) {
      const p = prev.get(s.id);
      const lastMsgAt = s.lastMessage?.createdAt ?? null;
      const name = s.visitorName ?? s.visitorEmail ?? 'Visitor';

      if (!p) {
        if (s.status === 'needs_human') {
          toAdd.push({ id: `${s.id}-h-${Date.now()}`, sessionId: s.id, visitorName: name, snippet: s.lastMessage?.content.slice(0, 70) ?? 'Needs human attention', reason: 'needs_human' });
        } else if (s.lastMessage?.role === 'visitor' && s.status !== 'closed') {
          toAdd.push({ id: `${s.id}-m-${Date.now()}`, sessionId: s.id, visitorName: name, snippet: s.lastMessage.content.slice(0, 70), reason: 'new_message' });
        }
      } else {
        if (s.status === 'needs_human' && p.status !== 'needs_human') {
          toAdd.push({ id: `${s.id}-h-${Date.now()}`, sessionId: s.id, visitorName: name, snippet: s.lastMessage?.content.slice(0, 70) ?? 'Needs human attention', reason: 'needs_human' });
        } else if (s.lastMessage?.role === 'visitor' && lastMsgAt !== null && lastMsgAt !== p.lastMsgAt && s.status !== 'closed') {
          toAdd.push({ id: `${s.id}-m-${Date.now()}`, sessionId: s.id, visitorName: name, snippet: s.lastMessage.content.slice(0, 70), reason: 'new_message' });
        }
      }
      prev.set(s.id, { status: s.status, lastMsgAt });
    }

    if (toAdd.length > 0) {
      setToasts((cur) => [...cur, ...toAdd].slice(-4));
      for (const t of toAdd) {
        setTimeout(() => dismissToast(t.id), 6_000);
      }
    }
  }, [allForNotif]);

  // On mobile (<md), show one column at a time: inbox by default, session pane
  // when a session is selected (with a back button to return to the inbox).
  const showInboxOnMobile = !selectedId;

  return (
    <div className="h-full flex bg-background">
      {/* LEFT — Inbox list. Full width on mobile when no session selected; hidden when a session is open. */}
      <aside
        className={`${showInboxOnMobile ? 'flex' : 'hidden'} md:flex w-full md:w-[340px] shrink-0 border-r border-border flex-col`}
      >
        {/* T4: Quick filter chips */}
        <div className="px-3 py-2 border-b border-border relative">
          <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {CHIP_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterKey(f.key)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterKey === f.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {f.label}
                {f.key === 'needs_review' && (pendingCount?.drafts ?? 0) > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center bg-amber-500 text-white text-[9px] w-4 h-4 rounded-full font-semibold">
                    {pendingCount?.drafts}
                  </span>
                )}
                {f.key === 'needs_reply' && statsNeedsReply > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center bg-amber-500 text-white text-[9px] w-4 h-4 rounded-full font-semibold">
                    {statsNeedsReply}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setAdvFilterOpen((v) => !v)}
              className={`ml-auto shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded ${
                filterSite || search ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Search &amp; site filter"
            >
              <Filter className="w-3.5 h-3.5" />
              {(filterSite || search) && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          </div>

          {advFilterOpen && (
            <div className="absolute right-3 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-30 p-3 w-[300px] space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Search</label>
                <Input
                  placeholder="Name, email, message…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mt-1 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Site</label>
                <select
                  value={filterSite ?? ''}
                  onChange={(e) => setFilterSite(e.target.value || null)}
                  className="mt-1 w-full text-sm bg-background border border-border rounded-md px-2 py-1.5"
                >
                  <option value="">All sites</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.key}>
                      {s.label} ({s.key})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border">
                <button
                  onClick={() => {
                    setSearch('');
                    setFilterSite(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  disabled={!search && !filterSite}
                >
                  Clear all
                </button>
                <button onClick={() => setAdvFilterOpen(false)} className="text-xs text-primary hover:underline">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* T1: Header stats bar */}
        {sessions.length > 0 && (
          <div className="px-3 py-1.5 border-b border-border flex items-center gap-3 text-xs text-muted-foreground bg-muted/20">
            <span>{statsActive} active</span>
            {statsNeedsReply > 0 && (
              <span className="text-amber-600 font-medium">{statsNeedsReply} need reply</span>
            )}
            {statsPendingReview > 0 && (
              <span className="text-amber-600 font-medium">{statsPendingReview} pending review</span>
            )}
            {statsActive > 0 && filterKey !== 'closed' && (
              <div className="ml-auto flex items-center gap-1">
                {bulkCloseConfirm ? (
                  <>
                    <span className="text-destructive font-medium">Close {filterSite ? 'site' : 'all'}?</span>
                    <button
                      onClick={() => bulkCloseMut.mutate({ siteKey: filterSite ?? undefined, status: filter.status })}
                      disabled={bulkCloseMut.isPending}
                      className="text-destructive hover:text-destructive/80 font-medium px-1"
                    >
                      {bulkCloseMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                    </button>
                    <button onClick={() => setBulkCloseConfirm(false)} className="hover:text-foreground px-1">No</button>
                  </>
                ) : (
                  <button
                    onClick={() => setBulkCloseConfirm(true)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
                    title="Close all visible sessions"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Close all
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Inline search + site filter */}
        <div className="px-3 py-2 border-b border-border space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, email, message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-md pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {sites.length > 0 && (
            <select
              value={filterSite ?? ''}
              onChange={(e) => setFilterSite(e.target.value || null)}
              className={`w-full text-xs bg-muted/40 border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                filterSite ? 'border-primary text-foreground' : 'border-border text-muted-foreground'
              }`}
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.key}>
                  {s.label} ({s.key})
                </option>
              ))}
            </select>
          )}
        </div>

        <LiveVisitorsPanel
          visitors={liveVisitors}
          collapsed={!showVisitors}
          onToggle={() => setShowVisitors((v) => !v)}
          selectedSessionId={selectedId}
          onSelectSession={(id) => setSelectedId(id)}
        />

        <div className="flex-1 overflow-auto">
          {searchedSessions.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground p-6">
              {search || filterSite ? 'No matches.' : 'No sessions.'}
            </div>
          ) : (
            searchedSessions.map((s) => (
              <InboxRow
                key={s.id}
                session={s}
                selected={selectedId === s.id}
                onClick={() => setSelectedId(s.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* CENTER — Conversation pane. Hidden on mobile when no session selected. */}
      <section className={`${showInboxOnMobile ? 'hidden' : 'flex'} md:flex flex-1 min-w-0`}>
        {selectedId ? (
          <SessionPane
            sessionId={selectedId}
            onAfterMutation={() => refetchList()}
            onSelectSession={(id) => setSelectedId(id)}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground w-full">
            Select a session to view the conversation.
          </div>
        )}
      </section>

      {/* RIGHT panel renders inside SessionPane to share data */}

      {/* Chat attention toasts — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg cursor-pointer transition-all ${
              t.reason === 'needs_human'
                ? 'bg-orange-500/10 border-orange-500/30'
                : 'bg-primary/10 border-primary/30'
            }`}
            onClick={() => {
              setSelectedId(t.sessionId);
              setFilterKey('all');
              dismissToast(t.id);
            }}
          >
            <div
              className={`mt-1 shrink-0 w-2 h-2 rounded-full ${
                t.reason === 'needs_human' ? 'bg-orange-500' : 'bg-primary'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{t.visitorName}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.snippet}</p>
              {t.reason === 'needs_human' && (
                <p className="text-xs text-orange-500 font-medium mt-1">Needs human attention</p>
              )}
            </div>
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5"
              onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveVisitorsPanel({
  visitors,
  collapsed,
  onToggle,
  selectedSessionId,
  onSelectSession,
}: {
  visitors: LiveVisitor[];
  collapsed: boolean;
  onToggle: () => void;
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
}) {
  const total = visitors.length;
  const inChat = visitors.filter((v) => v.sessionId).length;

  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/30 transition-colors"
      >
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-emerald-500" />
          {total > 0 && (
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
          )}
        </span>
        <span className="font-medium">{total} online</span>
        {inChat > 0 && (
          <span className="text-xs text-muted-foreground">· {inChat} in chat</span>
        )}
        <ChevronDown className={`ml-auto w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>
      {!collapsed && (
        <div className="max-h-[200px] overflow-auto bg-muted/20 border-t border-border">
          {visitors.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-3">
              No visitors right now.
            </div>
          ) : (
            visitors.map((v) => {
              const name = v.visitorName || v.visitorEmail || `visitor${v.visitorId.slice(-5)}`;
              const isSelected = v.sessionId && v.sessionId === selectedSessionId;
              return (
                <button
                  key={v.visitorPk}
                  onClick={() => v.sessionId && onSelectSession(v.sessionId)}
                  disabled={!v.sessionId}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs transition-colors ${
                    isSelected ? 'bg-accent' : v.sessionId ? 'hover:bg-accent/40' : 'cursor-default opacity-80'
                  }`}
                  title={v.sessionId ? 'Click to open session' : 'Visitor has not started a chat yet'}
                >
                  <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {v.ipCountry && <span>{flagFor(v.ipCountry)}</span>}
                  <span className="truncate font-medium">{name}</span>
                  {(v.siteLabel ?? v.siteKey) && (
                    <span className="shrink-0 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded truncate max-w-[80px]">
                      {v.siteLabel ?? v.siteKey}
                    </span>
                  )}
                  {v.sessionId && <span className="text-[10px] bg-blue-500/15 text-blue-500 px-1 rounded shrink-0">in chat</span>}
                  <span className="ml-auto truncate text-muted-foreground">
                    {v.currentPageTitle ?? pathFromUrlMaybe(v.currentPageUrl) ?? '—'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function pathFromUrlMaybe(u: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
}

function shortVisitorName(session: { visitorName?: string | null; visitorEmail?: string | null; visitorId: string }): string {
  if (session.visitorName?.trim()) return session.visitorName.trim();
  const email = session.visitorEmail?.trim();
  if (email) {
    const local = email.split('@')[0];
    // Replace dots / underscores / hyphens with spaces, title-case the words.
    return local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase() + p.slice(1))
      .join(' ') || local;
  }
  return `Visitor ${session.visitorId.slice(-5)}`;
}

function isVisitorOnline(lastSeenAt: string | undefined, status: string | undefined): boolean {
  if (!lastSeenAt || status === 'closed') return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 90_000;
}

function InboxRow({ session, selected, onClick }: { session: SessionRow; selected: boolean; onClick: () => void }) {
  const name = shortVisitorName(session);
  const lastTime = session.lastMessage?.createdAt ?? session.lastSeenAt;
  const online = isVisitorOnline(session.lastSeenAt, session.status);
  // Country flag comes from MaxMind GeoLite2 IP lookup only — never from the
  // Accept-Language header. The header reflects the visitor's UI language
  // (en-US, en-GB) which is misleading for travellers / VPN users; better
  // to show no flag than the wrong flag.
  const country = session.ipCountry ?? null;
  // T2/T3: needs-reply signal and wait time.
  const isNeedsReply = needsReply(session);
  const waitMins = waitMinutes(session);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-border transition-colors ${
        selected ? 'bg-accent' : 'hover:bg-accent/30'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={name} country={country} online={online} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${selected ? 'font-semibold' : 'font-medium'}`} title={session.visitorEmail ?? undefined}>{name}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* T2: amber dot when visitor is waiting for reply */}
              {isNeedsReply && (
                <span className="w-2 h-2 rounded-full bg-amber-500" title="Visitor waiting for reply" />
              )}
              <span className="text-[10px] text-muted-foreground">{relativeTime(lastTime)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
            <CornerDownRight className="w-3 h-3 shrink-0" />
            <span className="truncate">{session.lastMessage?.content ?? 'New conversation'}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {/* Needs-human attention badge — flags chats waiting for a human agent */}
            {session.status === 'needs_human' && (
              <div className="inline-flex items-center gap-1 text-[10px] text-white bg-orange-500 px-1.5 py-0.5 rounded font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Needs human
              </div>
            )}
            {/* T3: wait time badge */}
            {waitMins !== null && waitMins >= 2 && (
              <div className="inline-flex items-center text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                waiting {waitMins < 60 ? `${waitMins}m` : `${Math.floor(waitMins / 60)}h ${waitMins % 60}m`}
              </div>
            )}
            {(session.pendingDrafts ?? 0) > 0 && (
              <div className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {session.pendingDrafts} pending review
              </div>
            )}
            {(session.siteLabel || session.siteKey) && (
              <div className="inline-flex items-center text-[10px] text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded font-medium">
                {session.siteLabel || session.siteKey}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function Avatar({ name, country, online, size = 'md' }: { name: string; country?: string | null; online?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'w-7 h-7 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-base' };
  const dotSizeMap = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' };
  const flagSizeMap = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' };
  const bg = colorForName(name);
  // Initials from short visitor name (already without the "visitor" prefix
  // for email-derived names). Take first letters of up to two words.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'V';
  return (
    <div title={name} className={`relative shrink-0 ${sizeMap[size]} rounded-full ${bg} flex items-center justify-center font-semibold text-white`}>
      <span>{initials}</span>
      {country && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${flagSizeMap[size]} bg-card rounded-full border-2 border-card leading-none`}
          style={{ lineHeight: 1 }}
        >
          {flagFor(country)}
        </span>
      )}
      {/* Status dot — green when online, gray when not. Always shown so
          the operator gets a clear active/inactive signal at a glance. */}
      <span
        className={`absolute top-0 right-0 ${dotSizeMap[size]} rounded-full border-2 border-card ${
          online ? 'bg-emerald-500' : 'bg-gray-400'
        }`}
      />
    </div>
  );
}

function SessionPane({
  sessionId,
  onAfterMutation,
  onSelectSession,
  onBack,
}: {
  sessionId: string;
  onAfterMutation: () => void;
  onSelectSession?: (id: string) => void;
  onBack?: () => void;
}) {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [visitorSidebarOpen, setVisitorSidebarOpen] = useState(false);
  // Operator can collapse the right-hand visitor sidebar to a thin strip on
  // desktop. Preference persists in localStorage so it survives reloads.
  const [sidebarCollapsedDesktop, setSidebarCollapsedDesktop] = useState<boolean>(() => {
    try { return localStorage.getItem('lc-visitor-sidebar-collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('lc-visitor-sidebar-collapsed', sidebarCollapsedDesktop ? '1' : '0'); } catch { /* ignore */ }
  }, [sidebarCollapsedDesktop]);

  // Ephemeral error banner — surfaces failed mutations + auto-dismisses
  // after 6s. Better than alert() for a flow operators do dozens of times.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 6000);
  };
  const handleMutationError = (label: string) => (err: Error) => {
    const detail = parseSaveError(err.message) ?? err.message;
    showError(`${label}: ${detail}`);
  };

  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [composerTab, setComposerTab] = useState<'reply' | 'note' | 'shortcuts' | 'kb'>('reply');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  const [autoTranslate, setAutoTranslate] = useState(false);

  const translateMessage = async (msgId: string, text: string, targetLang: string) => {
    if (translations[msgId] || translating.has(msgId)) return;
    setTranslating((s) => new Set(s).add(msgId));
    try {
      const res = await apiFetch(token, '/agents/livechat/translate', {
        method: 'POST',
        body: JSON.stringify({ text, targetLang: 'English', sourceLang: targetLang }),
      }) as { translated: string };
      setTranslations((prev) => ({ ...prev, [msgId]: res.translated }));
    } catch { /* ignore */ } finally {
      setTranslating((s) => { const n = new Set(s); n.delete(msgId); return n; });
    }
  };
  const [showEmoji, setShowEmoji] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [kbQuery, setKbQuery] = useState('');
  const [debouncedKbQuery, setDebouncedKbQuery] = useState('');
  const kbDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: detail, refetch, isError, isLoading } = useQuery<SessionDetail>({
    queryKey: ['livechat-session', sessionId],
    queryFn: () => apiFetch(token, `/agents/livechat/sessions/${sessionId}`),
  });

  const { data: allOperators = [] } = useQuery<Operator[]>({
    queryKey: ['livechat-operators'],
    queryFn: () => apiFetch(token, '/agents/livechat/operators'),
  });

  // Shortcuts pulled from the KB writing-samples store, filtered by livechat
  // agent. Operators can use the existing KB UI to add new ones — they show
  // up here as 1-tap canned replies.
  const { data: shortcuts = [] } = useQuery<{ id: string; context: string; sampleText: string }[]>({
    queryKey: ['kb-shortcuts'],
    queryFn: () => apiFetch(token, '/knowledge-base/samples?agentKey=livechat'),
  });

  // KB search results — only fetches when the operator is on the KB tab and
  // has typed something, to avoid hammering the endpoint while idle.
  const { data: kbResults = [] } = useQuery<{ rows: { id: string; title: string; content: string }[] }>({
    queryKey: ['kb-composer-search', debouncedKbQuery],
    queryFn: () => apiFetch(token, `/knowledge-base/entries?agentKey=livechat&q=${encodeURIComponent(debouncedKbQuery)}&limit=10`),
    enabled: composerTab === 'kb' && debouncedKbQuery.length > 1,
    select: (r: any) => r?.rows ?? [],
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['livechat-sites'],
    queryFn: () => apiFetch(token, '/agents/livechat/sites'),
    staleTime: 60_000,
  });

  const [liveMessages, setLiveMessages] = useState<MessageRow[]>([]);
  const [liveCurrentPage, setLiveCurrentPage] = useState<{ url: string; title: string | null } | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const sockRef = useRef<Socket | null>(null);
  const visitorTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operatorTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLiveMessages([]);
    setLiveCurrentPage(null);
    setLiveStatus(null);
    setVisitorTyping(false);
    const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
    const url = apiBase || window.location.origin;
    const sock: Socket = io(url, {
      path: '/livechat-ws',
      auth: { operatorToken: token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    sockRef.current = sock;
    sock.on('connect', () => sock.emit('livechat:join', { sessionId }));
    sock.on('livechat:event', (event: any) => {
      if (event?.sessionId !== sessionId) return;
      if (event.type === 'message') {
        setLiveMessages((prev) => [
          ...prev,
          {
            id: event.messageId,
            sessionId: event.sessionId,
            role: event.role,
            content: event.content,
            createdAt: event.createdAt,
            attachments: event.attachments,
            pendingApproval: event.pendingApproval ?? false,
          },
        ]);
        if (event.role === 'visitor') { setVisitorTyping(false); playNotificationSound(); }
      } else if (event.type === 'message_removed') {
        setLiveMessages((prev) => prev.filter((m) => m.id !== event.messageId));
      } else if (event.type === 'pageview') {
        setLiveCurrentPage({ url: event.url, title: event.title });
        // Refresh the "Last browsed pages" list so it updates in real time.
        if (detail?.session?.visitorPk) {
          qc.invalidateQueries({ queryKey: ['livechat-pageviews', detail.session.visitorPk] });
        }
      } else if (event.type === 'session_status') {
        setLiveStatus(event.status);
      } else if (event.type === 'typing' && event.from === 'visitor') {
        setVisitorTyping(!!event.on);
        // Safety auto-clear in case the off-event is dropped.
        if (visitorTypingTimerRef.current) clearTimeout(visitorTypingTimerRef.current);
        if (event.on) {
          visitorTypingTimerRef.current = setTimeout(() => setVisitorTyping(false), 5000);
        }
      } else if (event.type === 'agent_stream_start' && event.draftId) {
        // Mirror the widget: render a placeholder bubble keyed by draftId,
        // accumulate deltas into it, and finalize on stream_end.
        setLiveMessages((prev) =>
          prev.some((m) => m.id === event.draftId)
            ? prev
            : [...prev, {
                id: event.draftId,
                sessionId: event.sessionId,
                role: 'agent',
                content: '',
                createdAt: event.createdAt ?? new Date().toISOString(),
                attachments: [],
                pendingApproval: false,
              }],
        );
      } else if (event.type === 'agent_stream_delta' && event.draftId && event.delta) {
        setLiveMessages((prev) => prev.map((m) => m.id === event.draftId ? { ...m, content: m.content + event.delta } : m));
      } else if (event.type === 'agent_stream_end' && event.draftId && event.messageId) {
        setLiveMessages((prev) => prev.map((m) => m.id === event.draftId ? { ...m, id: event.messageId, content: event.content ?? m.content } : m));
      } else if (event.type === 'messages_seen' && Array.isArray(event.messageIds) && event.seenAt) {
        const ids = new Set<string>(event.messageIds);
        setLiveMessages((prev) => prev.map((m) => ids.has(m.id) ? { ...m, seenAt: event.seenAt } : m));
      }
    });
    return () => {
      if (visitorTypingTimerRef.current) clearTimeout(visitorTypingTimerRef.current);
      sockRef.current = null;
      sock.disconnect();
    };
  }, [sessionId, token]);

  const allMessages = useMemo<MessageRow[]>(() => {
    const baseline = detail?.messages ?? [];
    const seen = new Set(baseline.map((m) => m.id));
    const fromLive = liveMessages.filter((m) => !seen.has(m.id));
    return [...baseline, ...fromLive];
  }, [detail?.messages, liveMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  const status = liveStatus ?? detail?.session?.status;
  const currentPageUrl = liveCurrentPage?.url ?? detail?.session?.currentPageUrl ?? null;
  const currentPageTitle = liveCurrentPage?.title ?? detail?.session?.currentPageTitle ?? null;

  const takeoverMut = useMutation({
    mutationFn: () => apiFetch(token, `/agents/livechat/sessions/${sessionId}/takeover`, { method: 'POST' }),
    onSuccess: () => {
      refetch();
      onAfterMutation();
    },
    onError: handleMutationError('Take over failed'),
  });
  const releaseMut = useMutation({
    mutationFn: () => apiFetch(token, `/agents/livechat/sessions/${sessionId}/release`, { method: 'POST' }),
    onSuccess: () => {
      refetch();
      onAfterMutation();
    },
    onError: handleMutationError('Release failed'),
  });
  const closeMut = useMutation({
    mutationFn: () => apiFetch(token, `/agents/livechat/sessions/${sessionId}/close`, { method: 'POST' }),
    onSuccess: () => {
      refetch();
      onAfterMutation();
    },
    onError: handleMutationError('Close failed'),
  });
  const transcriptMut = useMutation({
    mutationFn: () =>
      apiFetch(token, `/agents/livechat/sessions/${sessionId}/send-transcript`, { method: 'POST' }),
    onSuccess: (res: { ok: boolean; reason?: string; to?: string; error?: string }) => {
      if (res.ok) alert(`Transcript sent to ${res.to}`);
      else if (res.reason === 'no_visitor_email') alert('No visitor email on file — capture one first.');
      else if (res.reason === 'no_messages') alert('No messages to send.');
      else if (res.reason === 'site_disabled') alert('Transcript emails are disabled for this site.');
      else if (res.reason === 'send_failed') alert(`Send failed: ${res.error ?? 'unknown error'}`);
      else alert(`Skipped: ${res.reason ?? 'unknown'}`);
    },
    onError: (err: Error) => alert(`Failed: ${err.message}`),
  });

  const approveMut = useMutation({
    mutationFn: (messageId: string) =>
      apiFetch(token, `/agents/livechat/messages/${messageId}/approve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['livechat-session', sessionId] }),
    onError: handleMutationError('Approve failed'),
  });
  const rejectMut = useMutation({
    mutationFn: (messageId: string) =>
      apiFetch(token, `/agents/livechat/messages/${messageId}/reject`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['livechat-session', sessionId] }),
    onError: handleMutationError('Reject failed'),
  });
  const editApproveMut = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      apiFetch(token, `/agents/livechat/messages/${messageId}/edit-and-approve`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['livechat-session', sessionId] }),
    onError: handleMutationError('Edit & approve failed'),
  });
  const flagMut = useMutation({
    mutationFn: ({ messageId, correction }: { messageId: string; correction: string }) =>
      apiFetch(token, `/agents/livechat/messages/${messageId}/flag`, {
        method: 'POST',
        body: JSON.stringify({ correction }),
      }),
    onError: handleMutationError('Flag failed'),
  });
  const deleteMsgMut = useMutation({
    mutationFn: (messageId: string) =>
      apiFetch(token, `/agents/livechat/messages/${messageId}`, { method: 'DELETE' }),
    onSuccess: (_data, messageId) => {
      setLiveMessages((prev) => prev.filter((m) => m.id !== messageId));
      qc.invalidateQueries({ queryKey: ['livechat-session', sessionId] });
    },
    onError: handleMutationError('Delete failed'),
  });

  const [pendingAttachments, setPendingAttachments] = useState<AttachmentSummary[]>([]);
  const [uploadingPreviews, setUploadingPreviews] = useState<{ id: string; name: string; objectUrl: string; mimeType: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMut = useMutation({
    mutationFn: async ({ file }: { file: File; previewId: string }) => {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch(`/agents/livechat/sessions/${sessionId}/upload`, {
        method: 'POST',
        body: fd,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Upload failed'));
      return (await res.json()) as AttachmentSummary;
    },
    onSuccess: (att, { previewId }) => {
      setUploadingPreviews((prev) => {
        const p = prev.find((x) => x.id === previewId);
        if (p) URL.revokeObjectURL(p.objectUrl);
        return prev.filter((x) => x.id !== previewId);
      });
      setPendingAttachments((prev) => [...prev, att]);
    },
    onError: (err: Error, { previewId }) => {
      setUploadingPreviews((prev) => {
        const p = prev.find((x) => x.id === previewId);
        if (p) URL.revokeObjectURL(p.objectUrl);
        return prev.filter((x) => x.id !== previewId);
      });
      handleMutationError('Upload failed')(err);
    },
  });

  const [replyTo, setReplyTo] = useState<{ id: string; content: string; role: string } | null>(null);
  useEffect(() => { setReplyTo(null); }, [sessionId]);

  const sendMut = useMutation({
    mutationFn: (payload: { content: string; attachmentIds: string[]; operatorId?: string; internal?: boolean; replyToId?: string; replyToContent?: string }) =>
      apiFetch(token, `/agents/livechat/sessions/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify({
          content: payload.content,
          attachmentIds: payload.attachmentIds.length ? payload.attachmentIds : undefined,
          operatorId: payload.operatorId || undefined,
          internal: payload.internal === true,
          replyToId: payload.replyToId || undefined,
          replyToContent: payload.replyToContent || undefined,
        }),
      }),
    onSuccess: () => {
      if (composerRef.current) composerRef.current.value = '';
      setPendingAttachments([]);
      setUploadingPreviews((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.objectUrl)); return []; });
      setReplyTo(null);
      sockRef.current?.emit('livechat:typing', { sessionId, on: false });
      if (operatorTypingTimerRef.current) clearTimeout(operatorTypingTimerRef.current);
      qc.invalidateQueries({ queryKey: ['livechat-session', sessionId] });
      onAfterMutation();
    },
    onError: handleMutationError('Send failed'),
  });

  // Identify (set / update visitor email) — operator can capture email
  // mid-conversation to enable transcript-on-close.
  const identifyMut = useMutation({
    mutationFn: (email: string) =>
      apiFetch(token, `/agents/livechat/sessions/${sessionId}/identify`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['livechat-session', sessionId] });
      onAfterMutation();
    },
    onError: handleMutationError('Set email failed'),
  });

  const submitOperator = async () => {
    let content = composerRef.current?.value?.trim() ?? '';
    if (!content && pendingAttachments.length === 0) return;
    if (uploadingPreviews.length > 0) {
      showError('Wait for uploads to finish before sending');
      return;
    }
    const isNote = composerTab === 'note';
    if (!isNote && autoTranslate && language && !language.startsWith('en')) {
      try {
        const res = await apiFetch(token, '/agents/livechat/translate', {
          method: 'POST',
          body: JSON.stringify({ text: content, targetLang: language }),
        }) as { translated: string };
        if (res.translated) content = res.translated;
      } catch { /* send in original if translation fails */ }
    }
    sendMut.mutate({
      content,
      attachmentIds: pendingAttachments.map((a) => a.id),
      operatorId: selectedOperatorId || undefined,
      internal: isNote,
      replyToId: replyTo?.id,
      replyToContent: replyTo?.content.slice(0, 200),
    });
  };

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-sm text-center space-y-2">
          <div className="text-destructive">Could not load this conversation.</div>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }
  if (isLoading || !detail) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  // Operators can also type into a closed chat — sending auto-reopens it
  // (backend flips the status to 'human_taken_over' on the operator reply).
  const composerEnabled = status === 'human_taken_over' || status === 'closed';
  const visitorName = detail.session.visitorName || detail.session.visitorEmail || `visitor${detail.session.visitorId.slice(-5)}`;
  const language = detail.visitor?.language ?? null;
  const messagesByDay = groupMessagesByDay(allMessages);

  const sessionSiteKey = sites.find((s) => s.id === detail?.session?.siteId)?.key ?? '';
  const availableOperators = allOperators.filter(
    (op) => !op.siteKeys || op.siteKeys.length === 0 || (sessionSiteKey && op.siteKeys.includes(sessionSiteKey))
  );

  return (
    <div className="h-full flex min-w-0 overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* TOP BAR */}
        <div className="h-14 border-b border-border px-2 sm:px-4 flex items-center gap-1">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
              title="Back to inbox"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {/* T9: site tag in conversation header for quick context */}
          {detail && (detail.session.siteLabel || detail.session.siteKey) && (
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium hidden sm:inline">
              {detail.session.siteLabel || detail.session.siteKey}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setVisitorSidebarOpen(true)}
              className="lg:hidden w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
              title="Visitor info"
            >
              <UserIcon className="w-4 h-4" />
            </button>
            {sidebarCollapsedDesktop && (
              <button
                onClick={() => setSidebarCollapsedDesktop(false)}
                className="hidden lg:flex w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent items-center justify-center transition-colors"
                title="Show visitor info"
              >
                <UserIcon className="w-4 h-4" />
              </button>
            )}
            {status === 'human_taken_over' ? (
              <button
                onClick={() => releaseMut.mutate()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-md flex items-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                Release to AI
              </button>
            ) : status === 'closed' ? (
              <span className="bg-muted text-muted-foreground text-sm font-medium px-4 py-2 rounded-md">Closed</span>
            ) : (
              <button
                onClick={() => takeoverMut.mutate()}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-md flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                {status === 'needs_human' ? 'Needs human' : 'Take over'}
              </button>
            )}
            <ToolbarButton
              title={transcriptMut.isPending ? 'Sending…' : 'Send transcript to visitor email'}
              onClick={() => transcriptMut.mutate()}
            >
              <Mail className="w-4 h-4" />
            </ToolbarButton>
            {status !== 'closed' && (
              <button
                onClick={() => {
                  if (confirm('Mark this conversation as resolved? You can reopen by sending a new message.')) {
                    closeMut.mutate();
                  }
                }}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent px-2.5 py-1.5 rounded-md transition-colors"
                title="Mark as resolved"
              >
                <CheckIcon className="w-4 h-4" />
                <span className="hidden md:inline">Resolve</span>
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-500 text-xs flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-600 shrink-0">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MESSAGES */}
        <div className="flex-1 overflow-auto px-3 sm:px-6 py-4 sm:py-5">
          {language && (
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full text-xs">
                {detail.visitor?.ipCountry && <span>{flagFor(detail.visitor.ipCountry)}</span>}
                {prettyLanguage(language)}
              </span>
            </div>
          )}

          {messagesByDay.map(({ day, items }) => (
            <div key={day}>
              <div className="flex justify-center my-3">
                <span className="text-xs text-muted-foreground bg-background px-2">{day}</span>
              </div>
              <div className="space-y-2.5">
                {items.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    visitorName={visitorName}
                    country={detail.visitor?.ipCountry ?? null}
                    siteKey={sessionSiteKey}
                    onApprove={() => approveMut.mutate(m.id)}
                    onReject={() => rejectMut.mutate(m.id)}
                    onEditApprove={(content) => editApproveMut.mutate({ messageId: m.id, content })}
                    onFlag={(correction) => flagMut.mutate({ messageId: m.id, correction })}
                    onDelete={() => deleteMsgMut.mutate(m.id)}
                    busy={approveMut.isPending || rejectMut.isPending || editApproveMut.isPending}
                    onReply={(msg) => { setReplyTo({ id: msg.id, content: msg.content, role: msg.role }); setComposerTab('reply'); composerRef.current?.focus(); }}
                    sessionLanguage={language}
                    translation={translations[m.id]}
                    translating={translating.has(m.id)}
                    onTranslate={() => translateMessage(m.id, m.content, language ?? 'auto')}
                  />
                ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {visitorTyping && (
          <div className="px-6 pb-2 -mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </span>
            <span>{visitorName} is typing…</span>
          </div>
        )}

        {/* COMPOSER */}
        <div className="border-t border-border bg-card">
          <div className="flex items-center px-4 pt-2 gap-1 text-sm border-b border-border">
            <ComposerTab active={composerTab === 'reply'} onClick={() => setComposerTab('reply')}>Reply</ComposerTab>
            <ComposerTab active={composerTab === 'note'} onClick={() => setComposerTab('note')}>Note</ComposerTab>
            <ComposerTab active={composerTab === 'shortcuts'} onClick={() => setComposerTab('shortcuts')}>Shortcuts</ComposerTab>
            <ComposerTab active={composerTab === 'kb'} onClick={() => setComposerTab('kb')}>Knowledge Base</ComposerTab>
          </div>

          {composerTab === 'shortcuts' && (
            <div className="max-h-48 overflow-auto p-2 border-b border-border">
              {shortcuts.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No shortcuts yet. Add writing samples in Knowledge Base → Samples (agent: livechat) and they show up here.
                </p>
              ) : (
                shortcuts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const ta = composerRef.current;
                      if (ta) {
                        const insert = (s.sampleText ?? '').trim();
                        ta.value = ta.value ? `${ta.value} ${insert}` : insert;
                        ta.focus();
                        ta.setSelectionRange(ta.value.length, ta.value.length);
                      }
                      setComposerTab('reply');
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-accent/40 text-sm"
                  >
                    <div className="text-xs text-muted-foreground mb-0.5">/{s.context}</div>
                    <div className="text-foreground/90 truncate">{s.sampleText}</div>
                  </button>
                ))
              )}
            </div>
          )}

          {composerTab === 'kb' && (
            <div className="border-b border-border">
              <input
                value={kbQuery}
                onChange={(e) => {
                  setKbQuery(e.target.value);
                  clearTimeout(kbDebounceRef.current);
                  kbDebounceRef.current = setTimeout(() => setDebouncedKbQuery(e.target.value), 300);
                }}
                placeholder="Search knowledge base…"
                className="w-full text-sm bg-background px-4 py-2 border-b border-border focus:outline-none placeholder:text-muted-foreground"
              />
              <div className="max-h-48 overflow-auto p-2">
                {!debouncedKbQuery ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">Type to search KB entries.</p>
                ) : (kbResults as any).length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">No matches.</p>
                ) : (
                  ((kbResults as unknown) as { id: string; title: string; content: string }[]).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        const ta = composerRef.current;
                        if (ta) {
                          const insert = r.content.trim();
                          ta.value = ta.value ? `${ta.value} ${insert}` : insert;
                          ta.focus();
                          ta.setSelectionRange(ta.value.length, ta.value.length);
                        }
                        setComposerTab('reply');
                        setKbQuery('');
                        setDebouncedKbQuery('');
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-accent/40 text-sm"
                    >
                      <div className="text-xs font-medium text-foreground mb-0.5">{r.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{r.content}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          {composerEnabled && (
            <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border bg-muted/30 flex-wrap">
              {availableOperators.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground shrink-0">Speaking as:</span>
                  <select
                    value={selectedOperatorId}
                    onChange={(e) => setSelectedOperatorId(e.target.value)}
                    className="text-xs bg-transparent border-0 outline-none text-foreground font-medium cursor-pointer"
                  >
                    <option value="">Default</option>
                    {availableOperators.map((op) => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </>
              )}
              {language && !language.startsWith('en') && composerTab === 'reply' && (
                <label className="flex items-center gap-1.5 ml-auto cursor-pointer" title={`Auto-translate your English reply to ${prettyLanguage(language)}`}>
                  <div
                    onClick={() => setAutoTranslate((v) => !v)}
                    className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${autoTranslate ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${autoTranslate ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">Auto-translate to {prettyLanguage(language)}</span>
                </label>
              )}
            </div>
          )}
          {replyTo && (
            <div className="flex items-start gap-2 px-4 py-2 bg-muted/40 border-b border-border overflow-hidden">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">Replying to {replyTo.role}</div>
                <div className="text-xs text-foreground/70 truncate">{replyTo.content}</div>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground p-0.5 shrink-0 mt-0.5">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <textarea
            ref={composerRef}
            disabled={!composerEnabled && composerTab !== 'note'}
            placeholder={
              composerTab === 'note'
                ? 'Internal note — only visible to operators. Not sent to the visitor.'
                : status === 'closed'
                  ? `Send a message to reopen this chat with ${visitorName}…`
                  : composerEnabled
                    ? `Send your message to ${visitorName} in chat…`
                    : 'Click "Take over" to reply'
            }
            className={`w-full text-sm px-4 py-3 resize-none min-h-[80px] focus:outline-none disabled:opacity-50 placeholder:text-muted-foreground ${
              composerTab === 'note' ? 'bg-yellow-500/10 border-l-2 border-yellow-500/50' : 'bg-card'
            }`}
            onInput={() => {
              // Live emoji-shortcut substitution mirrors the visitor widget
              // so :D / :) / <3 / etc. expand inline.
              const ta = composerRef.current;
              if (ta) {
                const before = ta.value;
                const after = applyOperatorEmojiShortcuts(before);
                if (after !== before) {
                  const caretShift = after.length - before.length;
                  const pos = (ta.selectionStart ?? before.length) + caretShift;
                  ta.value = after;
                  ta.setSelectionRange(pos, pos);
                }
              }
              const sock = sockRef.current;
              if (!sock || !composerEnabled) return;
              const hasText = !!composerRef.current?.value.trim();
              sock.emit('livechat:typing', { sessionId, on: hasText });
              if (operatorTypingTimerRef.current) clearTimeout(operatorTypingTimerRef.current);
              if (hasText) {
                operatorTypingTimerRef.current = setTimeout(() => {
                  sockRef.current?.emit('livechat:typing', { sessionId, on: false });
                }, 1500);
              }
            }}
            onBlur={() => {
              sockRef.current?.emit('livechat:typing', { sessionId, on: false });
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter inserts a newline. Cmd/Ctrl+Enter
              // also sends as a power-user shortcut.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitOperator();
              }
            }}
            onPaste={(e) => {
              // Two paths because browsers vary: most populate `items` for
              // pasted screenshots; some populate `files` directly.
              const files: File[] = [];
              const items = e.clipboardData?.items;
              if (items) {
                for (const item of items) {
                  if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const f = item.getAsFile();
                    if (f) files.push(f);
                  }
                }
              }
              if (!files.length && e.clipboardData?.files) {
                for (const f of e.clipboardData.files) {
                  if (f.type.startsWith('image/')) files.push(f);
                }
              }
              if (!files.length) return;
              e.preventDefault();
              for (const f of files) {
                if (f.size > 10 * 1024 * 1024) {
                  showError('Pasted image too large (max 10 MB)');
                  continue;
                }
                if (pendingAttachments.length >= 5) {
                  showError('Up to 5 attachments per message');
                  break;
                }
                const named = f.name ? f : new File([f], `pasted-${Date.now()}.png`, { type: f.type });
                const previewId = `upl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const objectUrl = URL.createObjectURL(named);
                setUploadingPreviews((prev) => [...prev, { id: previewId, name: named.name, objectUrl, mimeType: named.type }]);
                uploadMut.mutate({ file: named, previewId });
              }
            }}
          />
          {(pendingAttachments.length > 0 || uploadingPreviews.length > 0) && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {uploadingPreviews.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 bg-muted/50 text-xs rounded-full px-3 py-1 text-muted-foreground">
                  {p.mimeType.startsWith('image/') ? (
                    <img src={p.objectUrl} className="w-4 h-4 rounded-sm object-cover flex-shrink-0" alt="" />
                  ) : (
                    <FileText className="w-3 h-3 flex-shrink-0" />
                  )}
                  <span className="max-w-[120px] truncate">{p.name}</span>
                  <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                </span>
              ))}
              {pendingAttachments.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 bg-muted text-xs rounded-full px-3 py-1">
                  {a.mimeType.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  <span className="max-w-[160px] truncate">{a.originalFilename}</span>
                  <button
                    onClick={() => setPendingAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-1 text-muted-foreground">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    alert('File too large (max 10 MB)');
                    return;
                  }
                  if (pendingAttachments.length >= 5) {
                    alert('Up to 5 files per message');
                    return;
                  }
                  const previewId = `upl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                  const objectUrl = URL.createObjectURL(file);
                  setUploadingPreviews((prev) => [...prev, { id: previewId, name: file.name, objectUrl, mimeType: file.type }]);
                  uploadMut.mutate({ file, previewId });
                }}
              />
              <ToolbarButton title="Attach file" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="w-4 h-4" />
              </ToolbarButton>
              <div className="relative">
                <ToolbarButton
                  title="Format"
                  onClick={() => { setShowFormat((v) => !v); setShowEmoji(false); }}
                >
                  <Type className="w-4 h-4" />
                </ToolbarButton>
                {showFormat && (
                  <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-xl p-1 flex gap-0.5 z-20">
                    <button
                      onClick={() => { wrapSelection(composerRef.current, '**', '**'); setShowFormat(false); }}
                      className="px-2 py-1 rounded hover:bg-accent/40 text-sm font-bold"
                      title="Bold"
                    >B</button>
                    <button
                      onClick={() => { wrapSelection(composerRef.current, '*', '*'); setShowFormat(false); }}
                      className="px-2 py-1 rounded hover:bg-accent/40 text-sm italic"
                      title="Italic"
                    >I</button>
                    <button
                      onClick={() => { wrapSelection(composerRef.current, '`', '`'); setShowFormat(false); }}
                      className="px-2 py-1 rounded hover:bg-accent/40 text-sm font-mono"
                      title="Code"
                    >&lt;/&gt;</button>
                    <button
                      onClick={() => { wrapSelection(composerRef.current, '[', '](https://)'); setShowFormat(false); }}
                      className="px-2 py-1 rounded hover:bg-accent/40 text-sm"
                      title="Link"
                    >🔗</button>
                  </div>
                )}
              </div>
              <div className="relative">
                <ToolbarButton
                  title="Emoji"
                  onClick={() => { setShowEmoji((v) => !v); setShowFormat(false); }}
                >
                  <Smile className="w-4 h-4" />
                </ToolbarButton>
                {showEmoji && (
                  <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-xl p-2 z-20 w-72 max-h-64 overflow-auto grid grid-cols-8 gap-1">
                    {OPERATOR_EMOJI_PICKER.map((e) => (
                      <button
                        key={e}
                        onClick={() => {
                          insertAtCursor(composerRef.current, e);
                          setShowEmoji(false);
                        }}
                        className="text-xl rounded hover:bg-accent/40 w-8 h-8 flex items-center justify-center"
                      >{e}</button>
                    ))}
                  </div>
                )}
              </div>
              <ToolbarButton title="More">
                <MoreHorizontal className="w-4 h-4" />
              </ToolbarButton>
            </div>
            <button
              disabled={!composerEnabled || sendMut.isPending}
              onClick={submitOperator}
              className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white flex items-center justify-center"
              title="Enter to send (Shift+Enter for newline)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT — Visitor sidebar (pinned on lg+, drawer on smaller screens).
          When collapsed, the aside is hidden entirely so the chat pane gets
          the freed-up space. Expand from the top-bar UserIcon. */}
      <aside className={`${sidebarCollapsedDesktop ? 'hidden' : 'hidden lg:block'} w-[320px] shrink-0 border-l border-border overflow-auto relative`}>
        <button
          onClick={() => setSidebarCollapsedDesktop(true)}
          className="absolute top-2 right-2 z-10 text-muted-foreground hover:text-foreground p-1 rounded hidden lg:inline-flex"
          title="Collapse visitor info"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <VisitorSidebar
          visitor={detail.visitor}
          session={detail.session}
          currentPageUrl={currentPageUrl}
          currentPageTitle={currentPageTitle}
          onSelectSession={onSelectSession}
          onSetEmail={(email) => identifyMut.mutate(email)}
          identifyBusy={identifyMut.isPending}
          token={token}
        />
      </aside>

      {/* Mobile/tablet drawer for the visitor sidebar */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity ${
          visitorSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setVisitorSidebarOpen(false)}
      />
      <aside
        className={`lg:hidden fixed top-0 right-0 z-50 h-[100dvh] w-[88vw] max-w-[360px] border-l border-border bg-background overflow-auto transform transition-transform ${
          visitorSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">Visitor info</span>
          <button
            onClick={() => setVisitorSidebarOpen(false)}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <VisitorSidebar
          visitor={detail.visitor}
          session={detail.session}
          currentPageUrl={currentPageUrl}
          currentPageTitle={currentPageTitle}
          onSelectSession={(id) => {
            setVisitorSidebarOpen(false);
            onSelectSession?.(id);
          }}
          token={token}
        />
      </aside>
    </div>
  );
}

function ToolbarButton({ children, title, onClick }: { children: React.ReactNode; title?: string; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  );
}

function ComposerTab({ active, disabled, onClick, children }: { active?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-t-md border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-500 font-medium bg-blue-500/5'
          : disabled
          ? 'border-transparent text-muted-foreground/60 cursor-not-allowed'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function KbSourcesPanel({
  sources,
  sessionId,
  messageId,
  siteKey,
}: {
  sources: KbSource[];
  sessionId: string;
  messageId: string;
  siteKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const { token } = useAuthStore();

  const entryColor = (t: string) => {
    if (t === 'product' || t === 'service' || t === 'offer') return 'text-cyan-400';
    if (t === 'fact') return 'text-purple-400';
    return 'text-blue-400';
  };

  const flag = (entryId: string) => {
    if (flagged.has(entryId) || !token) return;
    setFlagged((prev) => new Set([...prev, entryId]));
    void apiFetch(token, '/api/agents/livechat/kb-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kbEntryId: entryId, sessionId, messageId, siteKey }),
    }).catch(() => undefined);
  };

  return (
    <div className="mt-1 text-right">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        title="KB sources used for this reply"
      >
        {open ? 'hide kb sources' : `kb: ${sources.length} source${sources.length === 1 ? '' : 's'}`}
      </button>
      {open && (
        <div className="mt-1 rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-left space-y-1.5">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 text-[11px]">
              <span className={`shrink-0 font-medium ${entryColor(s.entryType)}`}>[{s.entryType}]</span>
              <span className="text-muted-foreground truncate flex-1">{s.title}</span>
              <button
                onClick={() => flag(s.id)}
                title={flagged.has(s.id) ? 'Flagged' : 'Flag as inaccurate'}
                className={`shrink-0 p-0.5 rounded transition-colors ${flagged.has(s.id) ? 'text-orange-400' : 'text-muted-foreground/40 hover:text-orange-400'}`}
              >
                <Flag size={10} />
              </button>
              <a
                href={`/knowledge-base?edit=${s.id}`}
                target="_blank"
                rel="noreferrer"
                title="Improve this entry"
                className="shrink-0 text-[10px] text-muted-foreground/40 hover:text-primary transition-colors"
              >
                edit
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  visitorName,
  country,
  siteKey,
  onApprove,
  onReject,
  onEditApprove,
  onFlag,
  onDelete,
  onReply,
  onTranslate,
  translation,
  translating: isTranslating,
  sessionLanguage,
  busy,
}: {
  message: MessageRow;
  visitorName: string;
  country: string | null;
  siteKey?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onEditApprove?: (content: string) => void;
  onFlag?: (correction: string) => void;
  onDelete?: () => void;
  onReply?: (msg: MessageRow) => void;
  onTranslate?: () => void;
  translation?: string;
  translating?: boolean;
  sessionLanguage?: string | null;
  busy?: boolean;
}) {
  const isVisitor = message.role === 'visitor';
  const isOperator = message.role === 'operator';
  const isOperatorView = !!onDelete;
  const isPending = !!message.pendingApproval && message.role === 'agent';
  const isAi = message.role === 'agent' && !isPending;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [flagging, setFlagging] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState('');
  const [flagSubmitted, setFlagSubmitted] = useState(false);
  if (message.role === 'system') {
    return (
      <div className="text-center text-xs text-muted-foreground py-1">{message.content}</div>
    );
  }
  if (message.role === 'note') {
    // Internal note — shown to operators as a yellow sticky-style block,
    // never broadcast to the visitor.
    return (
      <div className="flex justify-center my-1">
        <div className="max-w-[80%] bg-yellow-500/10 border-l-4 border-yellow-500/60 rounded-r-md px-3 py-2 text-xs text-yellow-900 dark:text-yellow-200">
          <div className="font-medium uppercase tracking-wide text-[10px] text-yellow-600 mb-0.5">Internal note</div>
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  const attachmentBlock = message.attachments && message.attachments.length > 0 && (
    <div className={`mt-1 flex flex-col gap-1 ${isVisitor ? 'items-start' : 'items-end'}`}>
      {message.attachments.map((a) => (
        <AttachmentView key={a.id} attachment={a} dark={!isVisitor} />
      ))}
    </div>
  );

  const isNonEnglish = sessionLanguage && !sessionLanguage.startsWith('en');

  if (isVisitor) {
    return (
      <div className="flex items-end gap-2 min-w-0 group">
        <Avatar name={visitorName} country={country} size="sm" />
        <div className="max-w-[85%] sm:max-w-[70%] min-w-0">
          {message.replyToContent && (
            <div className="text-[11px] text-muted-foreground bg-muted/40 border-l-2 border-muted-foreground/30 px-2 py-1 mb-1 rounded truncate">
              {message.replyToContent}
            </div>
          )}
          {message.content && (
            <div className="bg-muted/60 text-foreground text-sm rounded-2xl rounded-bl-sm px-3.5 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]">
              <Linkified text={message.content} dark={false} />
            </div>
          )}
          {translation && (
            <div className="mt-1 text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-lg px-2.5 py-1.5 italic">
              <span className="not-italic text-[10px] font-medium uppercase tracking-wide text-blue-400 mr-1">EN</span>
              {translation}
            </div>
          )}
          {attachmentBlock}
          <div className="text-[10px] text-muted-foreground mt-0.5 pl-1 flex items-center gap-1">
            {formatMessageTime(message.createdAt)}
            {!translation && onTranslate && (
              <button
                onClick={onTranslate}
                disabled={isTranslating}
                className="ml-1 hover:text-blue-400 disabled:opacity-50"
                title="Translate to English"
              >
                {isTranslating ? <span className="text-[9px]">…</span> : <Languages className="w-3 h-3" />}
              </button>
            )}
            {onReply && (
              <button onClick={() => onReply(message)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground" title="Reply">
                <CornerUpLeft className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Agent or operator
  return (
    <div className="flex items-end justify-end gap-2 group min-w-0">
      <div className="max-w-[85%] sm:max-w-[70%] min-w-0">
        {isPending && (
          <div className="text-[11px] text-amber-600 mb-1 text-right flex items-center justify-end gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
            Awaiting your approval — visitor has not seen this yet
          </div>
        )}
        {message.replyToContent && (
          <div className="text-[11px] text-muted-foreground bg-muted/40 border-l-2 border-muted-foreground/30 px-2 py-1 mb-1 rounded truncate text-right">
            {message.replyToContent}
          </div>
        )}
        {message.content && !editing && (
          <div
            className={`text-sm rounded-2xl rounded-br-sm px-3.5 py-2 whitespace-pre-wrap [overflow-wrap:anywhere] ${
              isPending ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-blue-500 text-white'
            }`}
          >
            <Linkified text={message.content} dark={!isPending} />
          </div>
        )}
        {editing && (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full text-sm rounded-2xl rounded-br-sm px-3.5 py-2 bg-amber-50 text-amber-900 border border-amber-200 resize-none min-h-[60px] focus:outline-none"
          />
        )}
        {attachmentBlock}
        {translation && (
          <div className="mt-1 text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-lg px-2.5 py-1.5 italic text-right">
            <span className="not-italic text-[10px] font-medium uppercase tracking-wide text-blue-400 mr-1">EN</span>
            {translation}
          </div>
        )}
        {!isPending && (
          <div className="flex items-center justify-end gap-1 mt-0.5 pr-1">
            <span className="text-[10px] text-muted-foreground">{formatMessageTime(message.createdAt)}</span>
            {message.metadata?.sentViaEmail && (
              <Mail className="w-3 h-3 text-blue-400 shrink-0" title="Delivered via email" />
            )}
            {message.seenAt
              ? <CheckCheck className="w-3.5 h-3.5 text-green-500 shrink-0" title={message.metadata?.sentViaEmail ? 'Email opened' : 'Seen'} />
              : <Check className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            }
            {!translation && onTranslate && (
              <button
                onClick={onTranslate}
                disabled={isTranslating}
                className="hover:text-blue-400 disabled:opacity-50"
                title="Translate to English"
              >
                {isTranslating ? <span className="text-[9px]">…</span> : <Languages className="w-3 h-3" />}
              </button>
            )}
            {onReply && (
              <button onClick={() => onReply(message)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-foreground" title="Reply">
                <CornerUpLeft className="w-3 h-3" />
              </button>
            )}
            {isOperatorView && onDelete && (
              <button
                onClick={() => { if (window.confirm('Delete this message?')) onDelete(); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-red-400"
                title="Delete message"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            {isAi && !flagSubmitted && (
              <button
                onClick={() => { setFlagging((v) => !v); setCorrectionDraft(''); }}
                title="Flag wrong AI response"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-red-400"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            )}
            {isAi && flagSubmitted && (
              <span className="text-[10px] text-emerald-500">Correction sent</span>
            )}
          </div>
        )}
        {isAi && flagging && (
          <div className="mt-1.5 rounded-lg border border-red-400/30 bg-red-500/5 p-2.5 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">What should the AI have said?</p>
            <textarea
              autoFocus
              value={correctionDraft}
              onChange={(e) => setCorrectionDraft(e.target.value)}
              placeholder="Type the correct information..."
              rows={3}
              className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-1.5 justify-end">
              <button
                onClick={() => { setFlagging(false); setCorrectionDraft(''); }}
                className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent/50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!correctionDraft.trim()}
                onClick={() => {
                  onFlag?.(correctionDraft.trim());
                  setFlagging(false);
                  setCorrectionDraft('');
                  setFlagSubmitted(true);
                }}
                className="text-xs px-2.5 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors"
              >
                Submit correction
              </button>
            </div>
          </div>
        )}
        {isAi && message.metadata?.kbSources && message.metadata.kbSources.length > 0 && (
          <KbSourcesPanel
            sources={message.metadata.kbSources}
            sessionId={message.sessionId}
            messageId={message.id}
            siteKey={siteKey ?? ''}
          />
        )}
        {isPending && (
          <div className="flex items-center justify-end gap-1.5 mt-1.5 text-xs">
            {!editing ? (
              <>
                <button
                  disabled={busy}
                  onClick={onApprove}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                >
                  <CheckIcon className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted hover:bg-accent text-foreground disabled:opacity-50"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  disabled={busy}
                  onClick={onReject}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={busy || !draft.trim()}
                  onClick={() => {
                    onEditApprove?.(draft);
                    setEditing(false);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                >
                  <CheckIcon className="w-3.5 h-3.5" /> Save & send
                </button>
                <button
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted hover:bg-accent text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs shrink-0">
        {isOperator ? <UserIcon className="w-4 h-4" /> : 'AI'}
      </div>
    </div>
  );
}

type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'url'; url: string; tail: string };

function tokenize(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|(https?:\/\/[^\s<]+))/gs;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', value: text.slice(last, m.index) });
    if (m[2] !== undefined) {
      tokens.push({ kind: 'bold', value: m[2] });
    } else if (m[3] !== undefined) {
      tokens.push({ kind: 'italic', value: m[3] });
    } else if (m[4] !== undefined) {
      tokens.push({ kind: 'code', value: m[4] });
    } else if (m[5] !== undefined) {
      const url = m[5];
      const trailMatch = url.match(/[.,;:!?)]+$/);
      const tail = trailMatch ? trailMatch[0] : '';
      tokens.push({ kind: 'url', url: tail ? url.slice(0, -tail.length) : url, tail });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) });
  return tokens;
}

function Linkified({ text, dark }: { text: string; dark: boolean }) {
  const tokens = tokenize(text);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.kind === 'bold') return <strong key={i}>{t.value}</strong>;
        if (t.kind === 'italic') return <em key={i}>{t.value}</em>;
        if (t.kind === 'code') return <code key={i} className="rounded px-1 py-0.5 text-[0.8em] bg-black/20 font-mono">{t.value}</code>;
        if (t.kind === 'url') return (
          <span key={i}>
            <a href={t.url} target="_blank" rel="noopener noreferrer nofollow" className={`underline ${dark ? 'text-white' : 'text-blue-600'}`}>{t.url}</a>
            {t.tail}
          </span>
        );
        return <span key={i}>{t.value}</span>;
      })}
    </>
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-4 right-4 text-xs text-white/60 hover:text-white underline"
        onClick={(e) => e.stopPropagation()}
      >
        open original
      </a>
    </div>
  );
}

function AttachmentView({ attachment, dark }: { attachment: AttachmentSummary; dark: boolean }) {
  const [lightbox, setLightbox] = useState(false);
  if (attachment.mimeType.startsWith('image/') && attachment.url) {
    return (
      <>
        <img
          src={attachment.url}
          alt={attachment.originalFilename}
          className="max-w-[280px] max-h-[260px] rounded-xl border border-border cursor-zoom-in"
          onClick={() => setLightbox(true)}
        />
        {lightbox && (
          <ImageLightbox
            src={attachment.url}
            alt={attachment.originalFilename}
            onClose={() => setLightbox(false)}
          />
        )}
      </>
    );
  }
  return (
    <a
      href={attachment.url || '#'}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl max-w-[260px] ${
        dark ? 'bg-blue-500/85 text-white hover:bg-blue-500' : 'bg-muted/60 text-foreground hover:bg-muted'
      }`}
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1">{attachment.originalFilename}</span>
      <span className={`shrink-0 ${dark ? 'opacity-80' : 'text-muted-foreground'}`}>{formatBytes(attachment.sizeBytes)}</span>
    </a>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// License verification section
// ─────────────────────────────────────────────────────────────────────────────

interface LicenseResult {
  action: string;
  summary: string;
  supportIsActive: boolean;
  supportDaysRemaining: number;
  canExtend: boolean;
  buyerUsername: string | null;
  licenseKey: string | null;
}

const ACTION_STYLES: Record<string, { badge: string; icon: React.ReactNode }> = {
  grant_support:                  { badge: 'bg-emerald-500/15 text-emerald-300', icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> },
  offer_support_renewal:          { badge: 'bg-yellow-500/15 text-yellow-300',  icon: <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" /> },
  support_extension_unavailable:  { badge: 'bg-orange-500/15 text-orange-300',  icon: <ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> },
  reject_buyer_mismatch:          { badge: 'bg-red-500/15 text-red-300',        icon: <ShieldX className="w-3.5 h-3.5 text-red-400" /> },
  reject_invalid_code:            { badge: 'bg-red-500/15 text-red-300',        icon: <ShieldX className="w-3.5 h-3.5 text-red-400" /> },
};

function LicenseVerifySection({ sessionId, token }: { sessionId: string; token: string }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<LicenseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (purchaseCode: string) => {
      const res = await fetch(`/agents/livechat/sessions/${sessionId}/verify-license`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
      return data as LicenseResult;
    },
    onSuccess: (data) => { setResult(data); setError(null); },
    onError: (err) => { setError((err as Error).message); setResult(null); },
  });

  const style = result ? (ACTION_STYLES[result.action] ?? { badge: 'bg-slate-500/15 text-slate-400', icon: <ShieldAlert className="w-3.5 h-3.5 text-slate-400" /> }) : null;

  return (
    <Section title="License">
      <div className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); const trimmed = code.trim(); if (trimmed) mutation.mutate(trimmed); }}
        >
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setResult(null); setError(null); }}
            placeholder="Purchase code or XGENIOUS-..."
            className="flex-1 min-w-0 text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
          <button
            type="submit"
            disabled={!code.trim() || mutation.isPending}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
            {mutation.isPending ? 'Checking...' : 'Verify'}
          </button>
        </form>

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5 shrink-0" />{error}</p>
        )}

        {result && style && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              {style.icon}
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
                {result.action.replace(/_/g, ' ')}
              </span>
            </div>
            {result.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
            )}
            <div className="space-y-1">
              {result.buyerUsername && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Buyer</span>
                  <span className="font-medium">{result.buyerUsername}</span>
                </div>
              )}
              {result.licenseKey && (
                <div className="flex justify-between text-xs gap-2">
                  <span className="text-muted-foreground shrink-0">License key</span>
                  <span className="font-mono text-[10px] truncate">{result.licenseKey}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Support</span>
                <span className={result.supportIsActive ? 'text-emerald-400' : 'text-orange-400'}>
                  {result.supportIsActive ? `Active · ${result.supportDaysRemaining}d left` : 'Expired'}
                  {!result.supportIsActive && result.canExtend && ' · renewable'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right sidebar — Visitor card with collapsible sections
// ─────────────────────────────────────────────────────────────────────────────

function VisitorSidebar({
  visitor,
  session,
  currentPageUrl,
  currentPageTitle,
  onSelectSession,
  onSetEmail,
  identifyBusy,
  token,
}: {
  visitor: Visitor | null;
  session: SessionRow;
  currentPageUrl: string | null;
  currentPageTitle: string | null;
  onSelectSession?: (id: string) => void;
  onSetEmail?: (email: string) => void;
  identifyBusy?: boolean;
  token: string;
}) {
  const [revealIp, setRevealIp] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(session.visitorEmail ?? '');
  useEffect(() => {
    setEmailDraft(session.visitorEmail ?? '');
    setEditingEmail(false);
  }, [session.id, session.visitorEmail]);
  const visitorName = shortVisitorName(session);
  const submitEmail = () => {
    const trimmed = emailDraft.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    onSetEmail?.(trimmed);
    setEditingEmail(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="px-4 py-5 border-b border-border flex flex-col items-center text-center">
        <Avatar name={visitorName} country={visitor?.ipCountry ?? null} online={isVisitorOnline(session.lastSeenAt, session.status)} size="lg" />
        <div className="mt-3 font-semibold">{visitorName}</div>
        {editingEmail ? (
          <div className="mt-1 flex items-center gap-1">
            <input
              type="email"
              autoFocus
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitEmail();
                if (e.key === 'Escape') {
                  setEmailDraft(session.visitorEmail ?? '');
                  setEditingEmail(false);
                }
              }}
              placeholder="visitor@example.com"
              className="text-xs bg-background border border-border rounded px-2 py-1 w-44"
              disabled={identifyBusy}
            />
            <button
              onClick={submitEmail}
              disabled={identifyBusy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDraft.trim())}
              className="text-xs text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        ) : session.visitorEmail ? (
          <div className="inline-flex items-center gap-1.5 mt-0.5">
            <CopyButton value={session.visitorEmail} className="text-xs text-muted-foreground hover:text-foreground" copyOnClick>
              {session.visitorEmail}
            </CopyButton>
            {onSetEmail && (
              <button
                onClick={() => setEditingEmail(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="Edit email"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onSetEmail && setEditingEmail(true)}
            className="text-xs text-muted-foreground hover:text-foreground mt-0.5"
            disabled={!onSetEmail}
          >
            set email
          </button>
        )}
        {visitor?.ipCity || visitor?.ipCountryName ? (
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            {visitor?.ipCountry && <span>{flagFor(visitor.ipCountry)}</span>}
            {[visitor?.ipCity, visitor?.ipCountryName].filter(Boolean).join(', ')}
          </div>
        ) : null}
        {/* T9: site tag below visitor location */}
        {(session.siteLabel || session.siteKey) && (
          <span className="mt-2 text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium">
            {session.siteLabel || session.siteKey}
          </span>
        )}
      </div>

      {/* Currently on */}
      {currentPageUrl && (
        <Section title="Currently on" defaultOpen>
          <div className="text-sm">
            <div className="font-medium truncate">{currentPageTitle ?? currentPageUrl}</div>
            <a
              href={currentPageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 overflow-hidden"
            >
              <span className="truncate">{currentPageUrl}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </Section>
      )}

      {/* Traffic source */}
      {(() => {
        const src = classifyTrafficSource(session.pageContext);
        if (!src) return null;
        const ctx = session.pageContext;
        return (
          <Section title="Traffic source" defaultOpen>
            <div className="text-sm space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${SOURCE_BADGE[src.type ?? 'direct']}`}>
                  {SOURCE_TAG[src.type ?? 'direct']}
                </span>
                <span className="font-medium">{src.label}</span>
              </div>
              {src.detail && <div className="text-xs text-muted-foreground truncate">{src.detail}</div>}
              {ctx?.referrerDomain && src.type !== 'direct' && (
                <Row label="Referred by"><span className="truncate">{String(ctx.referrerDomain)}</span></Row>
              )}
              {ctx?.utmCampaign && <Row label="Campaign"><span className="truncate">{String(ctx.utmCampaign)}</span></Row>}
              {ctx?.utmMedium && <Row label="Medium">{String(ctx.utmMedium)}</Row>}
              {ctx?.utmTerm && <Row label="Keyword"><span className="truncate">{String(ctx.utmTerm)}</span></Row>}
            </div>
          </Section>
        );
      })()}

      {/* Visitor device */}
      <Section title="Visitor device" defaultOpen>
        <div className="text-sm space-y-1.5">
          <Row label="Browser">
            {visitor?.browserName ? (
              <span>
                {visitor.browserName} {visitor.browserVersion}
              </span>
            ) : (
              '—'
            )}
          </Row>
          <Row label="OS">
            {visitor?.osName ? (
              <span>
                {visitor.osName} {visitor.osVersion}
              </span>
            ) : (
              '—'
            )}
          </Row>
          <Row label="Language">{visitor?.language ?? '—'}</Row>
          <Row label="Local time">{visitor?.ipTimezone ? localTimeIn(visitor.ipTimezone) : '—'}</Row>
          <Row label="IP">
            {visitor?.ip ? (
              <span className="inline-flex items-center gap-1.5">
                <button onClick={() => setRevealIp(!revealIp)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  <span className="font-mono text-xs">{revealIp ? visitor.ip : maskIp(visitor.ip)}</span>
                  {revealIp ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <CopyButton value={visitor.ip} />
              </span>
            ) : (
              '—'
            )}
          </Row>
        </div>
      </Section>

      {/* Counters */}
      <Section title="Activity" defaultOpen>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Counter label="Visits" value={visitor?.totalSessions ?? 0} />
          <Counter label="Messages" value={visitor?.totalMessages ?? 0} />
          <Counter label="Pageviews" value={visitor?.totalPageviews ?? 0} />
        </div>
      </Section>

      {/* License verification */}
      <LicenseVerifySection sessionId={session.id} token={token} />

      {/* Last browsed pages */}
      <PageJourneySection visitorPk={session.visitorPk} />

      {/* Past conversations across all sessions */}
      <PastConversationsSection visitorPk={session.visitorPk} currentSessionId={session.id} onSelect={onSelectSession} />
    </div>
  );
}

interface VisitorSession {
  id: string;
  siteId: string;
  siteKey: string | null;
  siteLabel: string | null;
  status: string;
  visitorEmail: string | null;
  visitorName: string | null;
  currentPageUrl: string | null;
  currentPageTitle: string | null;
  lastSeenAt: string;
  createdAt: string;
  messageCount: number;
}

function PastConversationsSection({ visitorPk, currentSessionId, onSelect }: { visitorPk: string; currentSessionId: string; onSelect?: (id: string) => void }) {
  const token = useAuthStore((s) => s.token)!;
  const { data: sessions = [] } = useQuery<VisitorSession[]>({
    queryKey: ['livechat-visitor-sessions', visitorPk],
    queryFn: () => apiFetch(token, `/agents/livechat/visitors/${visitorPk}/sessions?limit=20`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const past = sessions.filter((s) => s.id !== currentSessionId);

  return (
    <Section title={`Past conversations${past.length ? ` (${past.length})` : ''}`}>
      {past.length === 0 ? (
        <p className="text-xs text-muted-foreground">First time visiting — no prior sessions.</p>
      ) : (
        <ol className="space-y-2">
          {past.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onSelect?.(s.id)}
                disabled={!onSelect}
                className="w-full text-left text-xs hover:bg-accent/40 rounded p-1.5 -m-1.5 transition-colors disabled:cursor-default"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{s.siteLabel ?? s.siteKey ?? '—'}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase shrink-0 ${
                      s.status === 'closed'
                        ? 'bg-muted text-muted-foreground'
                        : s.status === 'needs_human'
                        ? 'bg-amber-500/15 text-amber-600'
                        : s.status === 'human_taken_over'
                        ? 'bg-blue-500/15 text-blue-500'
                        : 'bg-emerald-500/15 text-emerald-600'
                    }`}
                  >
                    {s.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-muted-foreground flex justify-between gap-2 mt-0.5">
                  <span>{s.messageCount} message{s.messageCount === 1 ? '' : 's'}</span>
                  <span className="shrink-0">{new Date(s.lastSeenAt).toLocaleDateString()}</span>
                </div>
                {s.currentPageTitle && (
                  <div className="text-muted-foreground truncate mt-0.5">last page: {s.currentPageTitle}</div>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium hover:bg-accent/30 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-base font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right truncate text-foreground">{children}</span>
    </div>
  );
}

/**
 * Copy a string to the clipboard with a tiny check-mark confirmation. Two modes:
 *   - icon-only (no children): renders a Copy/Check icon button.
 *   - with children + copyOnClick: wraps the text and copies on click.
 */
function CopyButton({
  value,
  className,
  copyOnClick,
  children,
}: {
  value: string;
  className?: string;
  copyOnClick?: boolean;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* ignore — older browsers */ }
  };
  if (children && copyOnClick) {
    return (
      <button
        onClick={copy}
        className={`inline-flex items-center gap-1 ${className ?? ''}`}
        title={copied ? 'Copied!' : 'Click to copy'}
      >
        <span className="truncate">{children}</span>
        {copied ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <Copy className="w-3 h-3 opacity-60 shrink-0" />}
      </button>
    );
  }
  return (
    <button
      onClick={copy}
      className={`text-muted-foreground hover:text-foreground p-0.5 ${className ?? ''}`}
      title={copied ? 'Copied!' : 'Copy'}
      aria-label={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function faviconForUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return null;
  }
}

function PageJourneySection({ visitorPk }: { visitorPk: string }) {
  const token = useAuthStore((s) => s.token)!;
  const { data: pageviews = [] } = useQuery<{ id: string; url: string; path: string | null; title: string | null; arrivedAt: string; durationMs: number | null }[]>({
    queryKey: ['livechat-pageviews', visitorPk],
    queryFn: () => apiFetch(token, `/agents/livechat/visitors/${visitorPk}/pageviews?limit=20`),
    refetchInterval: 10_000,
    staleTime: 3_000,
  });

  return (
    <Section title="Last browsed pages">
      {pageviews.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pageviews recorded.</p>
      ) : (
        <ol className="divide-y divide-border -mx-1">
          {pageviews.map((p) => {
            const favicon = faviconForUrl(p.url);
            return (
              <li key={p.id} className="py-2 px-1 hover:bg-accent/30 rounded transition-colors">
                <div className="flex items-center gap-2">
                  {favicon ? (
                    <img
                      src={favicon}
                      alt=""
                      width={16}
                      height={16}
                      loading="lazy"
                      className="shrink-0 rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-4 h-4 shrink-0 rounded-sm bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.title ?? p.path ?? p.url}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(p.arrivedAt).toLocaleTimeString()}
                      {p.durationMs != null && ` · ${formatDuration(p.durationMs)}`}
                    </div>
                  </div>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    title={p.url}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent/50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Operators tab
// ─────────────────────────────────────────────────────────────────────────────

interface OperatorDraft {
  name: string;
  avatarUrl: string;
  isDefault: boolean;
  siteKeys: string[];
}

function OperatorAvatarPicker({
  token,
  value,
  onChange,
  onError,
}: {
  token: string;
  value: string;
  onChange: (next: string) => void;
  onError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      onError('Please pick an image file');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch('/agents/livechat/operators/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? `Upload failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      onChange(data.url);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt=""
            className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground border border-border shrink-0">
            none
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 text-xs bg-background border border-border rounded-md hover:bg-accent/50 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an https:// URL"
      />
    </div>
  );
}

function OperatorsTab() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ['livechat-operators'],
    queryFn: () => apiFetch(token, '/agents/livechat/operators'),
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['livechat-sites'],
    queryFn: () => apiFetch(token, '/agents/livechat/sites'),
  });

  const emptyDraft: OperatorDraft = { name: '', avatarUrl: '', isDefault: false, siteKeys: [] };
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OperatorDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (op: Operator) => {
    setEditingId(op.id);
    setDraft({
      name: op.name,
      avatarUrl: op.avatarUrl ?? '',
      isDefault: op.isDefault,
      siteKeys: op.siteKeys ?? [],
    });
    setFormError(null);
    setModalOpen(true);
  };

  const buildPayload = (d: OperatorDraft) => ({
    name: d.name.trim(),
    avatarUrl: d.avatarUrl.trim() || null,
    isDefault: d.isDefault,
    siteKeys: d.siteKeys,
  });

  const saveMut = useMutation({
    mutationFn: (d: OperatorDraft) => {
      const payload = buildPayload(d);
      if (editingId) {
        return apiFetch(token, `/agents/livechat/operators/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch(token, '/agents/livechat/operators', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['livechat-operators'] });
      setModalOpen(false);
    },
    onError: (err: Error) => setFormError(parseSaveError(err.message) ?? err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(token, `/agents/livechat/operators/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['livechat-operators'] }),
  });

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Operators appear as the sender in human-takeover replies. Assign operators to specific sites or leave site keys blank to make them available on all sites.
          </p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> New operator
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            ))}
          </div>
        ) : operators.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            No operators yet. Add one to assign a sender identity to human replies.
          </div>
        ) : (
          operators.map((op) => {
            const initials = op.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? '')
              .join('') || 'OP';
            return (
              <div key={op.id} className="border border-border rounded-lg p-4 flex items-center gap-4">
                <div className="shrink-0">
                  {op.avatarUrl ? (
                    <img
                      src={op.avatarUrl}
                      alt={op.name}
                      className="w-10 h-10 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                      {initials}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{op.name}</span>
                    {op.isDefault && (
                      <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">default</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!op.siteKeys || op.siteKeys.length === 0 ? (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">All sites</span>
                    ) : (
                      op.siteKeys.map((k) => (
                        <span key={k} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                          {k}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(op)}>
                    <PencilLine className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete operator "${op.name}"?`)) deleteMut.mutate(op.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-auto p-5 space-y-3">
            <h3 className="font-semibold">{editingId ? 'Edit operator' : 'New operator'}</h3>

            {formError && (
              <div className="text-xs bg-red-500/10 text-red-500 border border-red-500/30 rounded-md px-3 py-2">
                {formError}
              </div>
            )}

            <Field label="Name" hint="Required. Shown as the sender name on human-operator messages.">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Sharifur"
              />
            </Field>
            <Field label="Avatar" hint="Optional. Upload an image or paste a URL. Leave blank to use initials.">
              <OperatorAvatarPicker
                token={token}
                value={draft.avatarUrl}
                onChange={(next) => setDraft({ ...draft, avatarUrl: next })}
                onError={(msg) => setFormError(msg)}
              />
            </Field>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isDefault}
                  onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                />
                Default operator
              </label>
              <p className="text-xs text-muted-foreground pl-5">
                If checked, this operator appears as the sender in the chat header when no specific operator is selected.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sites</label>
              <div className="border border-border rounded-md divide-y divide-border max-h-44 overflow-y-auto">
                {sites.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">No sites configured yet.</p>
                ) : (
                  sites.map((s) => (
                    <label key={s.key} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/30">
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={draft.siteKeys.includes(s.key)}
                        onChange={(e) => {
                          setDraft({
                            ...draft,
                            siteKeys: e.target.checked
                              ? [...draft.siteKeys, s.key]
                              : draft.siteKeys.filter((k) => k !== s.key),
                          });
                        }}
                      />
                      <span className="text-sm">{s.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground font-mono">{s.key}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">Leave all unchecked to make this operator available on all sites.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border -mx-5 px-5 pb-0 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  saveMut.reset();
                  setModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!draft.name.trim() || saveMut.isPending}
                onClick={() => saveMut.mutate(draft)}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup tab
// ─────────────────────────────────────────────────────────────────────────────

function SetupTab() {
  const token = useAuthStore((s) => s.token)!;
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['livechat-sites'],
    queryFn: () => apiFetch(token, '/agents/livechat/sites'),
  });

  const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') || window.location.origin;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl space-y-5">
        <div className="border border-border rounded-lg p-4 bg-muted/30">
          <p className="text-sm">
            <strong>Note:</strong> the live chat module relies on these platform-wide configurations (set elsewhere): a configured LLM provider in <code>Settings</code>, the MaxMind GeoLite2 database in <code>apps/api/data/</code>, and the Knowledge Base populated for the <code>livechat</code> agent.
          </p>
        </div>

        {sites.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            Add a site in the Sites tab first, then come back here for the install snippet.
          </div>
        ) : (
          sites.map((s) => <SiteSetupCard key={s.id} site={s} apiBase={apiBase} />)
        )}
      </div>
    </div>
  );
}

function SiteSetupCard({ site, apiBase }: { site: Site; apiBase: string }) {
  const snippet = `<script src="${apiBase}/livechat.js" data-site="${site.key}" defer></script>`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{site.label}</span>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{site.key}</code>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">Install snippet</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
        <code className="block text-xs bg-muted px-3 py-2 rounded font-mono break-all">{snippet}</code>
        <p className="text-xs text-muted-foreground mt-1">Place this just before the closing &lt;/body&gt; tag on {site.origin}.</p>
      </div>

      <div>
        <div className="text-xs font-medium mb-1">Manual test checklist</div>
        <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pl-5">
          <li>Paste the snippet on a page served from <code>{site.origin}</code>.</li>
          <li>Open the page in incognito; the chat bubble should appear bottom-right.</li>
          <li>Click it, send "hi", expect an AI reply within ~5s.</li>
          <li>Open this admin tab → Conversations, verify the session appears with country + browser.</li>
          <li>Click "Take over" here, send a reply, confirm it lands in the visitor's chat.</li>
          <li>Click "Release to AI", send another visitor message, confirm AI resumes.</li>
        </ol>
      </div>

      <div>
        <div className="text-xs font-medium mb-1">Troubleshooting</div>
        <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-5">
          <li>403 on track/pageview → the page's Origin header doesn't match {site.origin}. Update the site row to the exact origin (no trailing slash).</li>
          <li>No country shown → the MaxMind .mmdb is not present on the API host. See apps/api/data/README.md.</li>
          <li>"Currently on" never updates on SPA route changes → the widget tracker patches history.pushState; confirm the snippet loaded after the SPA bootstraps.</li>
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug Tab
// ─────────────────────────────────────────────────────────────────────────────

interface IpLookupResult {
  dbLoaded: boolean;
  ip: string | null;
  country: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  lat: string | null;
  lon: string | null;
  timezone: string | null;
}

function DebugTab() {
  const token = useAuthStore((s) => s.token)!;
  const [ip, setIp] = useState('');
  const [result, setResult] = useState<IpLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // T11: GeoLite2 setup state
  const [geoLoaded, setGeoLoaded] = useState<boolean | null>(null);
  const [mmAccountId, setMmAccountId] = useState('');
  const [mmLicenseKey, setMmLicenseKey] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ chunk: 0, total: 0 });
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const mmdbFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/agents/livechat/geo/status', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setGeoLoaded(d.loaded))
      .catch(() => {});
  }, [token]);

  async function downloadDb() {
    setDownloading(true);
    setDownloadMsg(null);
    try {
      // Save credentials first if provided
      if (mmAccountId.trim()) {
        await fetch('/settings/maxmind_account_id', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: mmAccountId.trim() }),
        });
      }
      if (mmLicenseKey.trim()) {
        await fetch('/settings/maxmind_license_key', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: mmLicenseKey.trim() }),
        });
      }
      const res = await fetch('/agents/livechat/geo/download-db', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setDownloadMsg({ ok: false, text: data?.message ?? `HTTP ${res.status}` });
      } else {
        setDownloadMsg({ ok: true, text: 'GeoLite2-City.mmdb downloaded and loaded successfully.' });
        setGeoLoaded(true);
      }
    } catch (e) {
      setDownloadMsg({ ok: false, text: (e as Error).message });
    } finally {
      setDownloading(false);
    }
  }

  async function uploadDb(file: File) {
    setUploading(true);
    setUploadMsg(null);
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    setUploadProgress({ chunk: 0, total: totalChunks });
    try {
      for (let i = 0; i < totalChunks; i++) {
        setUploadProgress({ chunk: i + 1, total: totalChunks });
        const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const buf = await slice.arrayBuffer();
        const uint8 = new Uint8Array(buf);
        let binary = '';
        for (let j = 0; j < uint8.length; j++) binary += String.fromCharCode(uint8[j]);
        const base64 = btoa(binary);
        const res = await fetch('/agents/livechat/geo/upload-chunk', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, chunkIndex: i, totalChunks, data: base64 }),
        });
        const data = await res.json();
        if (!res.ok) {
          setUploadMsg({ ok: false, text: data?.message ?? `HTTP ${res.status}` });
          return;
        }
        if (i === totalChunks - 1) {
          setUploadMsg({ ok: true, text: 'GeoLite2-City.mmdb uploaded and loaded successfully.' });
          setGeoLoaded(true);
        }
      }
    } catch (e) {
      setUploadMsg({ ok: false, text: (e as Error).message });
    } finally {
      setUploading(false);
      setUploadProgress({ chunk: 0, total: 0 });
    }
  }

  async function lookup() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/agents/livechat/debug/ip-lookup?ip=${encodeURIComponent(ip.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      setGeoLoaded(data.dbLoaded);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6 overflow-auto h-full">
      {/* T11: GeoLite2 Setup card */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">GeoLite2 Country Detection</h2>
          {geoLoaded === null ? null : geoLoaded ? (
            <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">Enabled</span>
          ) : (
            <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-medium">Not loaded</span>
          )}
        </div>
        {geoLoaded === false && (
          <>
            <p className="text-xs text-muted-foreground">
              Register a free account at <strong>maxmind.com</strong>, then go to <strong>Manage License Keys</strong> to create a key. Enter your Account ID and License Key below to download the GeoLite2-City database directly to the server.
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Account ID</label>
                <input
                  type="text"
                  value={mmAccountId}
                  onChange={(e) => setMmAccountId(e.target.value)}
                  placeholder="123456"
                  className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">License Key</label>
                <input
                  type="password"
                  value={mmLicenseKey}
                  onChange={(e) => setMmLicenseKey(e.target.value)}
                  placeholder="Your MaxMind license key"
                  className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={downloadDb}
                disabled={downloading}
                className="w-full text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
              >
                {downloading ? 'Downloading… (this may take 30–60 seconds)' : 'Download & Enable GeoLite2-City'}
              </button>
              {downloadMsg && (
                <div className={`text-xs px-3 py-2 rounded-md ${downloadMsg.ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                  {downloadMsg.text}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground">or upload the file directly</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <input
                ref={mmdbFileRef}
                type="file"
                accept=".mmdb"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadDb(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => mmdbFileRef.current?.click()}
                disabled={uploading}
                className="w-full text-xs px-3 py-2 rounded-md border border-border bg-background hover:bg-accent/50 font-medium disabled:opacity-50 transition-colors"
              >
                {uploading ? `Uploading chunk ${uploadProgress.chunk} of ${uploadProgress.total}…` : 'Upload GeoLite2-City.mmdb from your computer'}
              </button>
              {uploading && uploadProgress.total > 0 && (
                <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((uploadProgress.chunk / uploadProgress.total) * 100)}%` }}
                  />
                </div>
              )}
              {uploadMsg && (
                <div className={`text-xs px-3 py-2 rounded-md ${uploadMsg.ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                  {uploadMsg.text}
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Credentials are saved to Settings. The .mmdb file is placed at <code>apps/api/data/GeoLite2-City.mmdb</code> on the server and loaded immediately without a restart. Set <code>MAXMIND_DB_PATH</code> env var to override the path.
            </p>
          </>
        )}
        {geoLoaded && (
          <p className="text-xs text-muted-foreground">Country and city data is being detected from visitor IPs. Use the tester below to verify a specific IP.</p>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold mb-1">IP Geolocation Tester</h2>
        <p className="text-xs text-muted-foreground">Enter an IP address to verify the MaxMind GeoLite2 database is installed and returning correct country data.</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }}
          placeholder="e.g. 8.8.8.8 or 2a00:1450:4009:822::200e"
          className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={lookup}
          disabled={loading || !ip.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Looking up…' : 'Lookup'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border text-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-muted-foreground">GeoLite2 DB</span>
            <span className={result.dbLoaded ? 'text-green-500 font-medium' : 'text-destructive font-medium'}>
              {result.dbLoaded ? 'Loaded' : 'NOT loaded — country detection is disabled'}
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-muted-foreground">IP</span>
            <span className="font-mono">{result.ip ?? '—'}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-muted-foreground">Country</span>
            <span>
              {result.country
                ? `${flagFor(result.country)} ${result.countryName ?? ''} (${result.country})`
                : '—'}
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-muted-foreground">Region</span>
            <span>{result.region ?? '—'}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-muted-foreground">City</span>
            <span>{result.city ?? '—'}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-muted-foreground">Timezone</span>
            <span>{result.timezone ?? '—'}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-muted-foreground">Coordinates</span>
            <span>{result.lat && result.lon ? `${result.lat}, ${result.lon}` : '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function flagFor(country: string): string {
  if (!country || country.length !== 2) return '';
  const codePoints = country.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function maskIp(ip: string): string {
  if (ip.includes(':')) return ip.split(':').slice(0, 2).join(':') + ':****';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  return '****';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + time;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function colorForName(name: string): string {
  const palette = [
    'bg-rose-400',
    'bg-orange-400',
    'bg-amber-400',
    'bg-lime-400',
    'bg-emerald-400',
    'bg-teal-400',
    'bg-sky-400',
    'bg-indigo-400',
    'bg-violet-400',
    'bg-fuchsia-400',
    'bg-pink-400',
    'bg-stone-400',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function localTimeIn(tz: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function prettyLanguage(lang: string): string {
  try {
    const [base, region] = lang.split('-');
    const names = new Intl.DisplayNames(['en'], { type: 'language' });
    const langName = names.of(base) ?? base;
    return region ? `${langName} (${region.toUpperCase()})` : langName;
  } catch {
    return lang;
  }
}

/** Wrap the textarea's current selection (or insert at caret) with `before` + `after`. */
function wrapSelection(ta: HTMLTextAreaElement | null, before: string, after: string) {
  if (!ta) return;
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? start;
  const selected = ta.value.slice(start, end);
  ta.value = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
  const pos = end + before.length + after.length;
  ta.focus();
  ta.setSelectionRange(start + before.length, pos - after.length);
}

/** Insert text at the caret. */
function insertAtCursor(ta: HTMLTextAreaElement | null, text: string) {
  if (!ta) return;
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? start;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  const pos = start + text.length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
}

/** Compact emoji set for the operator-side picker — broader than the visitor widget. */
const OPERATOR_EMOJI_PICKER = [
  '👍','👎','👌','✌️','🤞','🙏','💪','👏','🙌','🤝',
  '🙂','😊','😄','😅','😂','🤣','😉','😍','🥰','😘',
  '🤔','😐','😬','😕','🙃','😴','😵','🤯','😱','😢',
  '🔥','✨','⭐','🎉','🎊','💯','✅','❌','⚠️','💡',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕',
];

// Same shortcuts as the visitor widget (apps/web/widget/emoji.ts) — duplicated
// here so the operator UI doesn't have to import from the embedded widget bundle.
const OPERATOR_EMOJI_SHORTCUTS: Array<[string, string]> = [
  [':)', '🙂'], [':-)', '🙂'], [':D', '😄'], [':-D', '😄'], ['xD', '😆'], ['XD', '😆'],
  [':P', '😛'], [':p', '😋'], [':-P', '😛'],
  [":'(", '😢'], [':(', '🙁'], [':-(', '🙁'],
  [';)', '😉'], [';-)', '😉'],
  [':O', '😮'], [':o', '😮'], [':-O', '😮'], [':oO', '😳'],
  [':|', '😐'], [':-|', '😐'], [':/', '😕'], [':-/', '😕'],
  ['<3', '❤️'], ['</3', '💔'], [':*', '😘'], ['B)', '😎'],
];
function applyOperatorEmojiShortcuts(input: string): string {
  let out = input;
  for (const [token, emoji] of OPERATOR_EMOJI_SHORTCUTS) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|\\s)${escaped}(?=\\s|$|[.,!?])`, 'g');
    out = out.replace(re, `$1${emoji}`);
  }
  return out;
}

function groupMessagesByDay(messages: MessageRow[]): { day: string; items: MessageRow[] }[] {
  const groups: { day: string; items: MessageRow[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const ds = d.toDateString();
    let label: string;
    if (ds === today) label = 'Today';
    else if (ds === yesterday) label = 'Yesterday';
    else label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const last = groups[groups.length - 1];
    if (last && last.day === label) last.items.push(m);
    else groups.push({ day: label, items: [m] });
  }
  return groups;
}
