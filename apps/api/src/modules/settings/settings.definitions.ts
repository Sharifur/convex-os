export interface SettingDefinition {
  label: string;
  description?: string;
  isSecret: boolean;
  group: 'general' | 'llm' | 'telegram' | 'ses' | 'gmail' | 'whatsapp' | 'linkedin' | 'reddit' | 'license' | 'storage' | 'insight' | 'safety' | 'hr' | 'geoip' | 'support' | 'image' | 'canva' | 'unipile' | 'listing';
  defaultValue?: string;
  provider?: 'openai' | 'gemini' | 'deepseek' | 'stability' | 'general';
  options?: Array<{ value: string; label: string; desc?: string }>;
}

export const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  // GeoIP — MaxMind GeoLite2
  maxmind_account_id: {
    label: 'MaxMind Account ID',
    description: 'Numeric account ID from maxmind.com. Required to download the GeoLite2-City database for visitor country/city detection.',
    isSecret: false,
    group: 'geoip',
  },
  maxmind_license_key: {
    label: 'MaxMind License Key',
    description: 'License key from maxmind.com → My License Key. Required to download GeoLite2-City.',
    isSecret: true,
    group: 'geoip',
  },

  // General — platform-wide
  timezone: {
    label: 'Timezone',
    description: 'IANA timezone used for scheduling, daily reminders, business-hours checks, and Telegram timestamps.',
    isSecret: false,
    group: 'general',
    defaultValue: 'UTC',
  },
  app_base_url: {
    label: 'Operator Console URL',
    description: 'Public URL of this operator console (e.g. https://cortex.xgenious.com), no trailing slash. Used to build deep links in alert emails so "Join the chat" opens the exact conversation.',
    isSecret: false,
    group: 'general',
    defaultValue: 'https://cortex.xgenious.com',
  },

  // LLM — general
  llm_default_provider: {
    label: 'Default Provider',
    description: 'Which LLM provider to use by default. "auto" walks the fallback chain.',
    isSecret: false,
    group: 'llm',
    defaultValue: 'auto',
    provider: 'general',
  },
  llm_fallback_order: {
    label: 'Fallback Chain Order',
    description: 'Comma-separated provider order used when "auto" is selected. Disabled providers are skipped.',
    isSecret: false,
    group: 'llm',
    defaultValue: 'openai,deepseek,gemini',
    provider: 'general',
  },

  // LLM — OpenAI
  openai_enabled: {
    label: 'Provider Enabled',
    description: 'When off, OpenAI is skipped in the auto fallback chain.',
    isSecret: false,
    group: 'llm',
    defaultValue: 'true',
    provider: 'openai',
  },
  openai_api_key: {
    label: 'OpenAI API Key',
    description: 'Used for GPT models. Starts with sk-',
    isSecret: true,
    group: 'llm',
    provider: 'openai',
  },
  openai_default_model: {
    label: 'Default Model',
    description: 'Model used for text generation tasks',
    isSecret: false,
    group: 'llm',
    defaultValue: 'gpt-4o-mini',
    provider: 'openai',
  },
  openai_embedding_model: {
    label: 'Embedding Model',
    description: 'Model used for vector embeddings in the knowledge base',
    isSecret: false,
    group: 'llm',
    defaultValue: 'text-embedding-3-small',
    provider: 'openai',
  },

  // LLM — Gemini
  gemini_enabled: {
    label: 'Provider Enabled',
    description: 'When off, Gemini is skipped in the auto fallback chain.',
    isSecret: false,
    group: 'llm',
    defaultValue: 'false',
    provider: 'gemini',
  },
  gemini_api_key: {
    label: 'Gemini API Key',
    description: 'Google AI Studio API key',
    isSecret: true,
    group: 'llm',
    provider: 'gemini',
  },
  gemini_default_model: {
    label: 'Default Model',
    description: 'e.g. gemini-1.5-flash, gemini-1.5-pro',
    isSecret: false,
    group: 'llm',
    defaultValue: 'gemini-1.5-flash',
    provider: 'gemini',
  },

  // LLM — DeepSeek
  deepseek_enabled: {
    label: 'Provider Enabled',
    description: 'When off, DeepSeek is skipped in the auto fallback chain.',
    isSecret: false,
    group: 'llm',
    defaultValue: 'true',
    provider: 'deepseek',
  },
  deepseek_api_key: {
    label: 'DeepSeek API Key',
    description: 'DeepSeek API key',
    isSecret: true,
    group: 'llm',
    provider: 'deepseek',
  },
  deepseek_default_model: {
    label: 'Default Model',
    description: 'e.g. deepseek-chat, deepseek-reasoner',
    isSecret: false,
    group: 'llm',
    defaultValue: 'deepseek-chat',
    provider: 'deepseek',
  },

  // Telegram
  telegram_bot_token: {
    label: 'Telegram Bot Token',
    description: 'From @BotFather',
    isSecret: true,
    group: 'telegram',
  },
  telegram_owner_chat_id: {
    label: 'Telegram Owner Chat ID',
    description: 'Your personal Telegram chat ID',
    isSecret: false,
    group: 'telegram',
  },

  // SES — AWS credentials
  aws_access_key_id: {
    label: 'AWS Access Key ID',
    description: 'IAM user with ses:SendEmail permission',
    isSecret: true,
    group: 'ses',
  },
  aws_secret_access_key: {
    label: 'AWS Secret Access Key',
    isSecret: true,
    group: 'ses',
  },
  aws_region: {
    label: 'AWS Region',
    description: 'SES-enabled region, e.g. ap-south-1',
    isSecret: false,
    group: 'ses',
    defaultValue: 'ap-south-1',
  },
  ses_from_address: {
    label: 'From Address',
    description: 'e.g. Sharifur <sharifur@taskip.net>',
    isSecret: false,
    group: 'ses',
  },
  ses_webhook_token: {
    label: 'Webhook URL Token',
    description: 'Random secret appended to the SNS subscription URL (e.g. /ses/webhook?t=…). Required to accept any SNS notification.',
    isSecret: true,
    group: 'ses',
  },
  ses_configuration_set: {
    label: 'Configuration Set',
    isSecret: false,
    group: 'ses',
    defaultValue: 'ses-monitoring',
  },
  livechat_alert_email: {
    label: 'Live Chat Alert Email',
    description: 'Email address that receives admin alerts when a visitor is waiting for a human agent. Falls back to the From Address if not set.',
    isSecret: false,
    group: 'ses',
  },

  // Gmail — accounts are managed at /gmail/accounts (multi-account, IMAP + SMTP
  // App Password). No settings keys here; the Integrations → Gmail tab renders
  // the account list directly.

  // WhatsApp Business Cloud API
  whatsapp_api_token: {
    label: 'API Token (Bearer)',
    description: 'Permanent system user token from Meta Business Suite → System Users',
    isSecret: true,
    group: 'whatsapp',
  },
  whatsapp_phone_number_id: {
    label: 'Phone Number ID',
    description: 'Found in Meta for Developers → WhatsApp → API Setup',
    isSecret: false,
    group: 'whatsapp',
  },
  whatsapp_verify_token: {
    label: 'Webhook Verify Token',
    description: 'Any random string you choose — must match the value in Meta webhook config',
    isSecret: true,
    group: 'whatsapp',
    defaultValue: 'cortex-whatsapp-verify',
  },
  whatsapp_app_secret: {
    label: 'App Secret',
    description: 'From Meta for Developers → App Settings → Basic → App Secret. Used to verify X-Hub-Signature-256 on inbound webhooks.',
    isSecret: true,
    group: 'whatsapp',
  },

  // LinkedIn — Unipile (preferred) or direct OAuth2
  unipile_api_key: {
    label: 'Unipile API Key',
    description: 'From app.unipile.com → Settings → API Keys',
    isSecret: true,
    group: 'unipile',
  },
  unipile_dsn: {
    label: 'Unipile DSN',
    description: 'Your account DSN from the Unipile dashboard (e.g. api4.unipile.com:13444)',
    isSecret: false,
    group: 'unipile',
  },
  linkedin_access_token: {
    label: 'LinkedIn Access Token (fallback)',
    description: 'Direct OAuth2 access token — only used if Unipile is not configured',
    isSecret: true,
    group: 'linkedin',
  },

  // Reddit — script app OAuth2
  reddit_client_id: {
    label: 'Client ID',
    description: 'From reddit.com/prefs/apps → script app → client ID (below app name)',
    isSecret: false,
    group: 'reddit',
  },
  reddit_client_secret: {
    label: 'Client Secret',
    isSecret: true,
    group: 'reddit',
  },
  reddit_username: {
    label: 'Reddit Username',
    description: 'The account that will post comments',
    isSecret: false,
    group: 'reddit',
  },
  reddit_password: {
    label: 'Reddit Password',
    isSecret: true,
    group: 'reddit',
  },

  // License Server
  license_server_url: {
    label: 'License Server URL',
    description: 'Base URL of the Xgenious license server, e.g. https://license.xgenious.com',
    isSecret: false,
    group: 'license',
  },
  license_server_signature: {
    label: 'API Signature',
    description: 'X-Signature token from Dashboard → Public API → Create (starts with xs_)',
    isSecret: true,
    group: 'license',
  },
  license_account_type: {
    label: 'Default Envato Account',
    description: 'Envato account slug to try first, e.g. xgenious or bytesed',
    isSecret: false,
    group: 'license',
    defaultValue: 'xgenious',
  },

  // Storage — Cloudflare R2 (S3-compatible)
  storage_endpoint: {
    label: 'Endpoint',
    description: '<account-id>.r2.cloudflarestorage.com — find Account ID in Cloudflare Dashboard → R2',
    isSecret: false,
    group: 'storage',
  },
  storage_access_key: {
    label: 'Access Key ID',
    description: 'R2 API token Access Key ID',
    isSecret: true,
    group: 'storage',
  },
  storage_secret_key: {
    label: 'Secret Access Key',
    description: 'R2 API token Secret Access Key',
    isSecret: true,
    group: 'storage',
  },
  storage_bucket: {
    label: 'Bucket Name',
    description: 'e.g. cortex',
    isSecret: false,
    group: 'storage',
    defaultValue: 'cortex',
  },
  storage_port: {
    label: 'Port',
    description: '443 for R2/HTTPS, 9000 for local MinIO',
    isSecret: false,
    group: 'storage',
    defaultValue: '443',
  },
  storage_use_ssl: {
    label: 'Use SSL',
    description: 'true for R2 / any HTTPS endpoint, false for local dev',
    isSecret: false,
    group: 'storage',
    defaultValue: 'true',
  },
  storage_public_base: {
    label: 'Public CDN Base URL',
    description: 'Optional. e.g. https://files.taskip.net (R2 custom domain). When set, attachment URLs use this prefix; otherwise a 24h presigned URL is returned.',
    isSecret: false,
    group: 'storage',
  },

  // Live chat — email-to-thread (visitor replies to transcript continue the conversation)
  livechat_reply_domain: {
    label: 'Reply Domain',
    description: 'Subdomain configured for SES inbound (MX records). e.g. reply.taskip.net. Transcript Reply-To becomes transcript+{token}@<domain>.',
    isSecret: false,
    group: 'ses',
  },
  livechat_reply_secret: {
    label: 'Reply HMAC Secret',
    description: 'Random 32+ char string used to sign session IDs in reply addresses, so an attacker cannot forge a reply address for someone else\'s session.',
    isSecret: true,
    group: 'ses',
  },
  livechat_inbound_token: {
    label: 'Inbound Webhook Token',
    description: 'Random secret appended as ?t= on the SES → SNS → cortex inbound webhook URL. Used to reject calls that aren\'t from your SNS topic.',
    isSecret: true,
    group: 'ses',
  },

  // Web Push (PWA notifications) — operator gets notified when a visitor
  // sends a message and no operator is currently looking at the inbox.
  push_vapid_public_key: {
    label: 'VAPID Public Key',
    description: 'Generated once with web-push: `npx web-push generate-vapid-keys`. Exposed to the browser to subscribe to pushes.',
    isSecret: false,
    group: 'general',
  },
  push_vapid_private_key: {
    label: 'VAPID Private Key',
    description: 'Generated alongside the public key. Used to sign push messages — keep secret.',
    isSecret: true,
    group: 'general',
  },
  push_vapid_subject: {
    label: 'VAPID Subject (mailto:)',
    description: 'Contact email like `mailto:ops@taskip.net` — required by the Web Push spec.',
    isSecret: false,
    group: 'general',
  },

  // Live Chat — abuse / cost caps
  livechat_per_session_msg_cap: {
    label: 'Live Chat — Visitor messages per session',
    description: 'Silently capped at this many visitor messages per session. Real conversations top out around 30; anything higher is abuse. Default 100.',
    isSecret: false,
    group: 'general',
    defaultValue: '100',
  },
  livechat_daily_agent_reply_cap: {
    label: 'Live Chat — Agent replies per site per day',
    description: 'Once a site\'s AI replies hit this number in a day, the agent pauses and visitors get the human-handoff fallback. Bounds LLM cost from a runaway attack. Default 500.',
    isSecret: false,
    group: 'general',
    defaultValue: '500',
  },
  livechat_business_hours: {
    label: 'Live Chat — Business Hours',
    description: 'JSON: { enabled, timezone, start ("HH:MM"), end ("HH:MM"), days ([0-6], 0=Sun), message }. When enabled and a visitor\'s first message in a session lands outside these hours, the chat gets a one-time note that a human reply may be delayed. The AI still answers normally.',
    isSecret: false,
    group: 'general',
    defaultValue: '{"enabled":false,"timezone":"UTC","start":"09:00","end":"17:00","days":[1,2,3,4,5],"message":""}',
  },

  // Taskip Internal — read-only DB connection (shared with taskip_trial agent)
  taskip_db_url_readonly: {
    label: 'Taskip DB — Read-only URL',
    description: 'Postgres connection string for the Taskip production database (read-only replica). Used by Taskip Internal and Taskip Trial agents to look up users, subscriptions, and invoices.',
    isSecret: true,
    group: 'general',
  },

  // Taskip Insight API
  insight_base_url: {
    label: 'Base URL',
    description: 'e.g. https://taskip.net/api/internal/insight',
    isSecret: false,
    group: 'insight',
  },
  insight_agent_key_primary: {
    label: 'Agent Key — Primary',
    description: 'Sent in X-Insight-Agent-Key header',
    isSecret: true,
    group: 'insight',
  },
  insight_agent_key_secondary: {
    label: 'Agent Key — Secondary (rotation)',
    description: 'Optional. Used as fallback during zero-downtime key rotation',
    isSecret: true,
    group: 'insight',
  },

  // Safety — global kill switches for agent write actions
  kill_extend_trial: {
    label: 'Block extend_trial',
    description: 'When true, the taskip_internal agent cannot extend trials even if approved',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
  kill_mark_refund: {
    label: 'Block mark_refund',
    description: 'When true, blocks the refund-marking action',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
  kill_send_email: {
    label: 'Block send_email',
    description: 'When true, blocks the Gmail outbound action across agents',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
  kill_marketing_suggestion: {
    label: 'Block insight_submit_marketing_suggestion',
    description: 'When true, blocks marketing-suggestion writeback to Taskip',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
  kill_lifecycle_message: {
    label: 'Block insight_submit_message',
    description: 'When true, blocks lifecycle messaging (email + in-app) submitted via the Insight API',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },

  // HR Manager Agent
  hrm_api_base_url: {
    label: 'HRM API Base URL',
    description: 'Base URL of the XGHRM AI-agent API, e.g. https://xghrm.yourdomain.com/api/ai-agent',
    isSecret: false,
    group: 'hr',
    defaultValue: '',
  },
  hrm_api_secret: {
    label: 'HRM API Secret',
    description: '64-character hex secret from XGHRM Admin → AI Applications. Sent as X-Signature on every request.',
    isSecret: true,
    group: 'hr',
  },
  hrm_payslip_day: {
    label: 'Monthly Payslip Day',
    description: 'Day of the month the agent generates and sends payslips for approval (1–28).',
    isSecret: false,
    group: 'hr',
    defaultValue: '25',
  },

  // Support Ticket Manager Agent
  support_crm_base_url: {
    label: 'CRM Base URL',
    description: 'Base URL of crm.xgenious.com, e.g. https://crm.xgenious.com',
    isSecret: false,
    group: 'support',
    defaultValue: '',
  },
  support_crm_api_key: {
    label: 'CRM API Key',
    description: 'X-Secret-Key header value for the Taskip public API.',
    isSecret: true,
    group: 'support',
  },
  support_webhook_secret: {
    label: 'Webhook Secret',
    description: 'Shared secret crm.xgenious.com sends as X-Webhook-Secret on each ticket webhook.',
    isSecret: true,
    group: 'support',
  },
  support_agent_id: {
    label: 'Agent ID',
    description: 'Numeric agent/operator ID from crm.xgenious.com. Required — replies will fail without this.',
    isSecret: false,
    group: 'support',
    defaultValue: '',
  },

  // Image Generation — general
  image_gen_provider: {
    label: 'Default Provider',
    description: 'Provider for slide AI image backgrounds. auto = openai → stability → gemini → solid color.',
    isSecret: false,
    group: 'image',
    defaultValue: 'auto',
    provider: 'general',
    options: [
      { value: 'auto', label: 'Auto', desc: 'openai → stability → gemini cascade' },
      { value: 'openai', label: 'OpenAI', desc: 'gpt-image-1 / dall-e-3' },
      { value: 'stability', label: 'Stability AI', desc: 'SDXL / Stable Image Core' },
      { value: 'gemini', label: 'Gemini', desc: 'Imagen via gemini-2.0-flash-exp' },
    ],
  },

  // Image Generation — OpenAI
  image_gen_openai_model: {
    label: 'OpenAI Image Model',
    description: 'gpt-image-1 ~$0.19/img  |  gpt-image-2 ~$0.211/img  |  dall-e-3-hd ~$0.08/img  |  dall-e-3 ~$0.04/img  |  dall-e-2 ~$0.018/img. Uses the same API key as the LLM OpenAI setting.',
    isSecret: false,
    group: 'image',
    defaultValue: 'gpt-image-1',
    provider: 'openai',
    options: [
      { value: 'gpt-image-1', label: 'gpt-image-1', desc: '~$0.19/img' },
      { value: 'gpt-image-2', label: 'gpt-image-2', desc: '~$0.211/img' },
      { value: 'dall-e-3-hd', label: 'DALL-E 3 HD', desc: '~$0.08/img' },
      { value: 'dall-e-3', label: 'DALL-E 3', desc: '~$0.04/img' },
      { value: 'dall-e-2', label: 'DALL-E 2', desc: '~$0.018/img — lowest cost' },
    ],
  },

  // Image Generation — Stability AI
  stability_api_key: {
    label: 'Stability AI API Key',
    description: 'Get from platform.stability.ai → API Keys. Format: sk-... Credits: $10 = 1,000 credits.',
    isSecret: true,
    group: 'image',
    provider: 'stability',
  },
  image_gen_stability_model: {
    label: 'Stability AI Model',
    description: 'stable-image-core ~$0.003/img (0.3 cr)  |  SDXL ~$0.002/img (0.2 cr)  |  stable-image-ultra ~$0.008/img (0.8 cr).',
    isSecret: false,
    group: 'image',
    defaultValue: 'stable-image-core',
    provider: 'stability',
    options: [
      { value: 'stable-image-core', label: 'Stable Image Core', desc: '~$0.003/img — recommended' },
      { value: 'stable-diffusion-xl-1024-v1-0', label: 'SDXL 1.0', desc: '~$0.002/img — cheapest' },
      { value: 'stable-image-ultra', label: 'Stable Image Ultra', desc: '~$0.008/img — best quality' },
    ],
  },

  // Listing Outreach Agent
  brave_search_api_key: {
    label: 'Brave Search API Key',
    description: 'API key from api.search.brave.com. Costs $5 per 1 000 requests but includes $5 free credit monthly — roughly 1 000 free requests/month. This agent uses ~120/month so credit covers it fully.',
    isSecret: true,
    group: 'listing',
  },
  open_page_rank_api_key: {
    label: 'Open PageRank API Key',
    description: 'Free key from openpagerank.com. Improves quality scoring by adding domain authority (0-10) to each discovered site.',
    isSecret: true,
    group: 'listing',
  },
  listing_outreach_monthly_limit: {
    label: 'Monthly Outreach Limit',
    description: 'Max number of listing sites to contact per calendar month.',
    isSecret: false,
    group: 'listing',
    defaultValue: '20',
  },
  listing_outreach_per_run_limit: {
    label: 'Per Run Limit',
    description: 'Max new prospects to process per weekly run.',
    isSecret: false,
    group: 'listing',
    defaultValue: '10',
  },
  listing_outreach_min_score: {
    label: 'Minimum Quality Score',
    description: 'Sites scoring below this threshold (0-100) are recorded but not actioned.',
    isSecret: false,
    group: 'listing',
    defaultValue: '30',
  },
  // Canva Agent
  canva_dna_max_tokens: {
    label: 'Design DNA Max Tokens',
    description: 'Maximum tokens the vision LLM may return when extracting design DNA from a sample image. Increase if you see "invalid JSON for design DNA" errors on complex designs.',
    isSecret: false,
    group: 'canva',
    defaultValue: '10000',
  },
};
