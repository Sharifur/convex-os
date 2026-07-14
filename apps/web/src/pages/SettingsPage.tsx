import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Trash2, Eye, EyeOff, Key, Zap, UserCircle, Loader2, Globe, BriefcaseBusiness, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';

interface SettingRow {
  key: string;
  value: string;
  isSecret: boolean;
  label: string;
  description?: string | null;
  group: string;
  provider?: string | null;
  stored: boolean;
  options?: Array<{ value: string; label: string; desc?: string }> | null;
}

const LLM_PROVIDER_TABS = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'deepseek', label: 'DeepSeek' },
];

const OPENAI_TEXT_MODELS = [
  { label: 'GPT-5.5', value: 'gpt-5.5' },
  { label: 'GPT-5.4', value: 'gpt-5.4' },
  { label: 'GPT-5.4 mini', value: 'gpt-5.4-mini' },
  { label: 'GPT-5.2', value: 'gpt-5.2' },
  { label: 'GPT-5', value: 'gpt-5' },
  { label: 'GPT-5 mini', value: 'gpt-5-mini' },
  { label: 'o3', value: 'o3' },
  { label: 'o3-pro', value: 'o3-pro' },
  { label: 'o4-mini', value: 'o4-mini' },
  { label: 'GPT-4.5', value: 'gpt-4.5' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'GPT-4.1 mini', value: 'gpt-4.1-mini' },
];

const OPENAI_EMBEDDING_MODELS = [
  { label: 'text-embedding-3-large', value: 'text-embedding-3-large' },
  { label: 'text-embedding-3-small', value: 'text-embedding-3-small' },
];

const GEMINI_TEXT_MODELS = [
  { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro' },
  { label: 'Gemini 3.1 Flash', value: 'gemini-3.1-flash' },
  { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Flash-Lite', value: 'gemini-2.5-flash-lite' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2.0 Pro', value: 'gemini-2.0-pro' },
];

const DEFAULT_PROVIDER_OPTIONS = [
  { value: 'auto', label: 'Auto (fallback chain)', desc: 'OpenAI → Gemini → DeepSeek' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
];

async function fetchSettings(token: string): Promise<SettingRow[]> {
  const res = await fetch('/settings', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

async function upsertSetting(token: string, key: string, value: string) {
  const res = await fetch(`/settings/${key}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    let msg = 'Failed to save';
    try {
      const body = await res.json();
      if (body?.message) msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {}
    throw new Error(msg);
  }
}

async function deleteSetting(token: string, key: string) {
  const res = await fetch(`/settings/${key}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete');
}

function SettingField({ setting, token }: { setting: SettingRow; token: string }) {
  const [inputValue, setInputValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () => upsertSetting(token, setting.key, inputValue),
    onSuccess: () => { setEditing(false); setInputValue(''); qc.invalidateQueries({ queryKey: ['settings'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSetting(token, setting.key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {setting.isSecret && <Key className="w-3 h-3 text-yellow-500 shrink-0" />}
            <span className="text-sm font-medium">{setting.label}</span>
            {setting.stored && (
              <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">saved</span>
            )}
          </div>
          {setting.description && (
            <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
          )}
          {editing ? (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={setting.isSecret && !showRaw ? 'password' : 'text'}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`Enter ${setting.label}`}
                    className="pr-9 text-sm"
                    autoFocus
                    disabled={saveMutation.isPending}
                  />
                  {setting.isSecret && (
                    <button type="button" onClick={() => setShowRaw((v) => !v)}
                      disabled={saveMutation.isPending}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50">
                      {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!inputValue || saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" disabled={saveMutation.isPending}
                  onClick={() => { setEditing(false); setInputValue(''); }}>Cancel</Button>
              </div>
              {saveMutation.isError && (
                <p className="text-xs text-destructive">{(saveMutation.error as Error)?.message ?? 'Failed to save'}</p>
              )}
            </div>
          ) : (
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground mt-1 inline-block">
              {setting.stored ? setting.value : (setting.value || '—')}
            </code>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-xs">
              {setting.stored ? 'Update' : 'Set'}
            </Button>
            {setting.stored && (
              <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-muted-foreground hover:text-destructive">
                {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelSelectField({
  setting,
  options,
  token,
}: {
  setting: SettingRow;
  options: { label: string; value: string }[];
  token: string;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (val: string) => upsertSetting(token, setting.key, val),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">{setting.label}</span>
            {mutation.isPending && (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
            {!mutation.isPending && mutation.isSuccess && (
              <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">saved</span>
            )}
          </div>
          {setting.description && (
            <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
          )}
          <select
            value={setting.value || ''}
            onChange={(e) => mutation.mutate(e.target.value)}
            disabled={mutation.isPending}
            className="mt-1 w-full max-w-xs bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {mutation.isError && (
            <p className="text-xs text-destructive mt-1">{(mutation.error as Error)?.message ?? 'Failed to save'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DefaultProviderSelector({ current, token }: { current: string; token: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (val: string) => upsertSetting(token, 'llm_default_provider', val),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Default Provider</span>
        {mutation.isPending && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />
        )}
        {!mutation.isPending && mutation.isSuccess && (
          <span className="text-xs text-green-500 ml-auto">Saved</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_PROVIDER_OPTIONS.map((opt) => {
          const isActiveSaving = mutation.isPending && mutation.variables === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => mutation.mutate(opt.value)}
              disabled={mutation.isPending}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
                current === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {isActiveSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              {opt.label}
              {opt.desc && current === opt.value && (
                <span className="ml-1.5 text-xs opacity-75">{opt.desc}</span>
              )}
            </button>
          );
        })}
      </div>
      {mutation.isError && (
        <p className="text-xs text-destructive mt-2">{(mutation.error as Error)?.message ?? 'Failed to save'}</p>
      )}
      {current !== 'auto' && (
        <p className="text-xs text-muted-foreground mt-2">
          Falls back to auto chain if the selected provider fails or has no API key.
        </p>
      )}
    </div>
  );
}

const DEEPSEEK_TEXT_MODELS = [
  { label: 'DeepSeek-V4-Pro', value: 'deepseek-v4-pro' },
  { label: 'DeepSeek-V4-Flash', value: 'deepseek-v4-flash' },
  { label: 'DeepSeek-V3.2', value: 'deepseek-v3.2' },
];

const MODEL_SELECT_KEYS: Record<string, { label: string; value: string }[]> = {
  openai_default_model: OPENAI_TEXT_MODELS,
  openai_embedding_model: OPENAI_EMBEDDING_MODELS,
  gemini_default_model: GEMINI_TEXT_MODELS,
  deepseek_default_model: DEEPSEEK_TEXT_MODELS,
};

function ProviderToggle({ setting, token }: { setting: SettingRow; token: string }) {
  const qc = useQueryClient();
  const isOn = (setting.value || setting.value === '') ? setting.value === 'true' : false;
  const mutation = useMutation({
    mutationFn: (next: boolean) => upsertSetting(token, setting.key, next ? 'true' : 'false'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="py-4 border-b border-border last:border-0 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium">Provider Enabled</span>
          {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <span className={`text-xs px-1.5 py-0.5 rounded ${isOn ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
            {isOn ? 'on' : 'off'}
          </span>
        </div>
        {setting.description && (
          <p className="text-xs text-muted-foreground">{setting.description}</p>
        )}
      </div>
      <button
        onClick={() => mutation.mutate(!isOn)}
        disabled={mutation.isPending}
        role="switch"
        aria-checked={isOn}
        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
          isOn ? 'bg-primary' : 'bg-muted border border-border'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
            isOn ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function FallbackOrderPanel({ setting, token, providers }: {
  setting: SettingRow;
  token: string;
  providers: { key: 'openai' | 'gemini' | 'deepseek'; label: string; enabled: boolean }[];
}) {
  const qc = useQueryClient();
  const raw = setting.value || 'openai,deepseek,gemini';
  const order = raw.split(',').map((s) => s.trim()).filter(Boolean) as Array<'openai' | 'gemini' | 'deepseek'>;

  const known: Array<'openai' | 'gemini' | 'deepseek'> = ['openai', 'gemini', 'deepseek'];
  for (const p of known) if (!order.includes(p)) order.push(p);

  const mutation = useMutation({
    mutationFn: (next: string[]) => upsertSetting(token, setting.key, next.join(',')),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    mutation.mutate(next);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold">Fallback Chain</span>
        {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        {!mutation.isPending && mutation.isSuccess && <span className="text-xs text-green-500 ml-auto">Saved</span>}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        When Default Provider is "Auto", these providers are tried in order. Disabled providers are skipped.
      </p>
      <ol className="space-y-2">
        {order.map((p, idx) => {
          const meta = providers.find((m) => m.key === p);
          return (
            <li key={p} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/20">
              <span className="text-xs font-mono text-muted-foreground w-5">#{idx + 1}</span>
              <span className="text-sm flex-1">{meta?.label ?? p}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta?.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                {meta?.enabled ? 'on' : 'off'}
              </span>
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0 || mutation.isPending}
                className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >↑</button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === order.length - 1 || mutation.isPending}
                className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >↓</button>
            </li>
          );
        })}
      </ol>
      {mutation.isError && (
        <p className="text-xs text-destructive mt-2">{(mutation.error as Error)?.message ?? 'Failed to save'}</p>
      )}
    </div>
  );
}

function getTimezones(): string[] {
  type IntlWithSupported = typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const i = Intl as IntlWithSupported;
  if (typeof i.supportedValuesOf === 'function') {
    try { return i.supportedValuesOf('timeZone'); } catch { /* fall through */ }
  }
  return ['UTC', 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles'];
}

function TimezoneField({ setting, token }: { setting: SettingRow; token: string }) {
  const qc = useQueryClient();
  const tzs = useMemo(() => getTimezones(), []);
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const mutation = useMutation({
    mutationFn: (val: string) => upsertSetting(token, setting.key, val),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const current = setting.value || 'UTC';

  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{setting.label}</span>
            {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {!mutation.isPending && mutation.isSuccess && (
              <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">saved</span>
            )}
          </div>
          {setting.description && (
            <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={current}
              onChange={(e) => mutation.mutate(e.target.value)}
              disabled={mutation.isPending}
              className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed min-w-[260px]"
            >
              {tzs.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            {browserTz && current !== browserTz && (
              <button
                onClick={() => mutation.mutate(browserTz)}
                disabled={mutation.isPending}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                Use browser timezone ({browserTz})
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Local time now: <code className="font-mono">{new Date().toLocaleString(undefined, { timeZone: current })}</code>
          </p>
          {mutation.isError && (
            <p className="text-xs text-destructive mt-1">{(mutation.error as Error)?.message ?? 'Failed to save'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface BusinessHoursConfig {
  enabled: boolean;
  timezone: string;
  start: string;
  end: string;
  days: number[];
  message?: string;
}

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  enabled: false,
  timezone: 'UTC',
  start: '09:00',
  end: '17:00',
  days: [1, 2, 3, 4, 5],
  message: '',
};

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseBusinessHours(raw: string): BusinessHoursConfig {
  try {
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed.enabled,
      timezone: parsed.timezone || 'UTC',
      start: parsed.start || '09:00',
      end: parsed.end || '17:00',
      days: Array.isArray(parsed.days) ? parsed.days : [1, 2, 3, 4, 5],
      message: parsed.message || '',
    };
  } catch {
    return DEFAULT_BUSINESS_HOURS;
  }
}

function BusinessHoursField({ setting, token }: { setting: SettingRow; token: string }) {
  const qc = useQueryClient();
  const tzs = useMemo(() => getTimezones(), []);
  const [cfg, setCfg] = useState<BusinessHoursConfig>(() => parseBusinessHours(setting.value));

  const mutation = useMutation({
    mutationFn: (next: BusinessHoursConfig) => upsertSetting(token, setting.key, JSON.stringify(next)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const save = (next: BusinessHoursConfig) => {
    setCfg(next);
    mutation.mutate(next);
  };

  const toggleDay = (d: number) => {
    const days = cfg.days.includes(d) ? cfg.days.filter((x) => x !== d) : [...cfg.days, d].sort();
    save({ ...cfg, days });
  };

  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-sm font-medium">{setting.label}</span>
        {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        {!mutation.isPending && mutation.isSuccess && (
          <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">saved</span>
        )}
      </div>
      {setting.description && <p className="text-xs text-muted-foreground mb-3">{setting.description}</p>}

      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => save({ ...cfg, enabled: e.target.checked })}
          className="rounded border-border"
        />
        <span className="text-sm">Enabled — notify visitors who message outside these hours</span>
      </label>

      <div className={cfg.enabled ? '' : 'opacity-50 pointer-events-none'}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={cfg.timezone}
            onChange={(e) => save({ ...cfg, timezone: e.target.value })}
            className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[220px]"
          >
            {tzs.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
          <input
            type="time"
            value={cfg.start}
            onChange={(e) => save({ ...cfg, start: e.target.value })}
            className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="time"
            value={cfg.end}
            onChange={(e) => save({ ...cfg, end: e.target.value })}
            className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {DOW_LABELS.map((label, d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                cfg.days.includes(d)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={cfg.message}
          onChange={(e) => setCfg({ ...cfg, message: e.target.value })}
          onBlur={() => save(cfg)}
          placeholder={`Custom after-hours message (optional) — default: "Heads up — it's outside our business hours right now, so a human reply may take a little longer. I can still help in the meantime!"`}
          rows={2}
          className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive mt-2">{(mutation.error as Error)?.message ?? 'Failed to save'}</p>
      )}
    </div>
  );
}

function GeneralTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card mb-6">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">General</span>
      </div>
      <div className="px-5">
        {rows.map((s) => (
          s.key === 'timezone'
            ? <TimezoneField key={s.key} setting={s} token={token} />
            : s.key === 'livechat_business_hours'
            ? <BusinessHoursField key={s.key} setting={s} token={token} />
            : <SettingField key={s.key} setting={s} token={token} />
        ))}
      </div>
    </div>
  );
}

function LlmTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  const [activeProvider, setActiveProvider] = useState('openai');

  const generalSettings = rows.filter((r) => r.provider === 'general');
  const defaultProviderRow = generalSettings.find((r) => r.key === 'llm_default_provider');
  const fallbackRow = generalSettings.find((r) => r.key === 'llm_fallback_order');
  const currentDefault = defaultProviderRow?.value || 'auto';

  const providerRows = rows.filter((r) => r.provider === activeProvider);

  const enabledFor = (p: string): boolean => {
    const r = rows.find((x) => x.key === `${p}_enabled`);
    if (!r) return p !== 'gemini';
    return r.value === 'true';
  };

  const providersMeta = LLM_PROVIDER_TABS.map((t) => ({
    key: t.key as 'openai' | 'gemini' | 'deepseek',
    label: t.label,
    enabled: enabledFor(t.key),
  }));

  return (
    <div>
      <DefaultProviderSelector current={currentDefault} token={token} />

      {fallbackRow && (
        <FallbackOrderPanel setting={fallbackRow} token={token} providers={providersMeta} />
      )}

      {/* Provider sub-tabs */}
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-4 bg-muted/30 w-fit">
        {LLM_PROVIDER_TABS.map((tab) => {
          const on = enabledFor(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveProvider(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                activeProvider === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-5">
          {providerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No settings for this provider.</p>
          ) : (
            providerRows.map((s) =>
              s.key.endsWith('_enabled') ? (
                <ProviderToggle key={s.key} setting={s} token={token} />
              ) : MODEL_SELECT_KEYS[s.key] ? (
                <ModelSelectField key={s.key} setting={s} options={MODEL_SELECT_KEYS[s.key]} token={token} />
              ) : (
                <SettingField key={s.key} setting={s} token={token} />
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}


function HrTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card mb-6">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <BriefcaseBusiness className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">HR Manager</span>
      </div>
      <div className="px-5">
        {rows.map((s) => <SettingField key={s.key} setting={s} token={token} />)}
      </div>
    </div>
  );
}

function CanvaTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card mb-6">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Canva Agent</span>
      </div>
      <div className="px-5">
        {rows.map((s) => <SettingField key={s.key} setting={s} token={token} />)}
      </div>
    </div>
  );
}



const IMAGE_PROVIDER_TABS = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'stability', label: 'Stability AI' },
  { key: 'gemini', label: 'Gemini' },
];

const IMAGE_PROVIDER_OPTIONS = [
  { value: 'auto', label: 'Auto', desc: 'openai → stability → gemini cascade' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'stability', label: 'Stability AI' },
  { value: 'gemini', label: 'Gemini' },
];

function ImageProviderSelector({ current, token }: { current: string; token: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (val: string) => upsertSetting(token, 'image_gen_provider', val),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Image className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Default Image Provider</span>
        {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />}
        {!mutation.isPending && mutation.isSuccess && <span className="text-xs text-green-500 ml-auto">Saved</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {IMAGE_PROVIDER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => mutation.mutate(opt.value)}
            disabled={mutation.isPending}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
              current === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {opt.label}
            {opt.desc && current === opt.value && (
              <span className="ml-1 text-xs opacity-75">{opt.desc}</span>
            )}
          </button>
        ))}
      </div>
      {mutation.isError && (
        <p className="text-xs text-destructive mt-2">{(mutation.error as Error)?.message ?? 'Failed to save'}</p>
      )}
    </div>
  );
}

function OptionsSelectField({ setting, token }: { setting: SettingRow; token: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (val: string) => upsertSetting(token, setting.key, val),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
  const opts = setting.options ?? [];

  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">{setting.label}</span>
            {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {!mutation.isPending && mutation.isSuccess && (
              <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">saved</span>
            )}
          </div>
          {setting.description && (
            <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
          )}
          <select
            value={setting.value || (opts[0]?.value ?? '')}
            onChange={(e) => mutation.mutate(e.target.value)}
            disabled={mutation.isPending}
            className="mt-1 w-full max-w-xs bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}{o.desc ? ` — ${o.desc}` : ''}
              </option>
            ))}
          </select>
          {mutation.isError && (
            <p className="text-xs text-destructive mt-1">{(mutation.error as Error)?.message ?? 'Failed to save'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageTab({ rows, token }: { rows: SettingRow[]; token: string }) {
  const [activeProvider, setActiveProvider] = useState('openai');
  if (!rows.length) return null;

  const generalRow = rows.find((r) => r.key === 'image_gen_provider');
  const currentProvider = generalRow?.value || 'auto';
  const providerRows = rows.filter((r) => r.provider === activeProvider);

  const openaiKeySet = !!rows.find((r) => r.key === 'image_gen_openai_model');

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Image className="w-4 h-4 text-primary" />
        <span className="text-base font-semibold">Image Generation</span>
        <span className="text-xs text-muted-foreground">Post Format Engine slide backgrounds</span>
      </div>

      <ImageProviderSelector current={currentProvider} token={token} />

      {/* Provider sub-tabs */}
      <div className="flex items-center gap-1 border border-border rounded-lg p-1 mb-4 bg-muted/30 w-fit">
        {IMAGE_PROVIDER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveProvider(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeProvider === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        {activeProvider === 'openai' && (
          <div className="px-5 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground">
              Uses the <strong>OpenAI API Key</strong> from the LLM settings above — no separate key needed.
            </p>
          </div>
        )}
        <div className="px-5">
          {providerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No settings for this provider.</p>
          ) : (
            providerRows.map((s) =>
              s.options?.length ? (
                <OptionsSelectField key={s.key} setting={s} token={token} />
              ) : (
                <SettingField key={s.key} setting={s} token={token} />
              )
            )
          )}
        </div>
      </div>

      {/* Cost reference table */}
      <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Cost reference (1024×1024)</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>gpt-image-1</span><span className="font-mono">~$0.19/img</span>
          <span>gpt-image-2</span><span className="font-mono">~$0.211/img</span>
          <span>DALL-E 3 HD</span><span className="font-mono">~$0.08/img</span>
          <span>DALL-E 3</span><span className="font-mono">~$0.04/img</span>
          <span>DALL-E 2</span><span className="font-mono">~$0.018/img</span>
          <span>Stable Image Core (0.3 cr)</span><span className="font-mono">~$0.003/img</span>
          <span>SDXL 1.0 (0.2 cr)</span><span className="font-mono">~$0.002/img</span>
          <span>Stable Image Ultra (0.8 cr)</span><span className="font-mono">~$0.008/img</span>
          <span>Gemini Imagen</span><span className="font-mono">~$0.02/img</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Stability AI: $10 = 1,000 credits</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const token = useAuthStore((s) => s.token)!;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchSettings(token),
    staleTime: 0,
  });

  const grouped: Record<string, SettingRow[]> = {};
  for (const row of data ?? []) {
    if (!grouped[row.group]) grouped[row.group] = [];
    grouped[row.group].push(row);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        LLM provider keys and configuration. For external service credentials, see{' '}
        <a href="/integrations" className="text-primary hover:underline">Integrations</a>.
      </p>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                  <Skeleton className="h-3.5 w-64 rounded" />
                  <Skeleton className="h-7 w-48 rounded" />
                </div>
                <Skeleton className="h-7 w-14 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}
      {isError && <p className="text-sm text-destructive">Failed to load settings.</p>}

      <p className="text-xs text-muted-foreground -mt-3 mb-6">
        Your account info has moved — see{' '}
        <a href="/profile" className="text-primary hover:underline">Profile</a> and{' '}
        <a href="/change-password" className="text-primary hover:underline">Change Password</a>.
      </p>

      {!isLoading && !isError && (
        <>
          <GeneralTab rows={grouped['general'] ?? []} token={token} />
          <LlmTab rows={grouped['llm'] ?? []} token={token} />
          <ImageTab rows={grouped['image'] ?? []} token={token} />
          <HrTab rows={grouped['hr'] ?? []} token={token} />
          <CanvaTab rows={grouped['canva'] ?? []} token={token} />
        </>
      )}
    </div>
  );
}
