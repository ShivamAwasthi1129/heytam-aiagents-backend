/**
 * Heytam AI Tool Catalog — All 30 AI Slave Tools
 * Each tool has metadata, pricing, category, and a configuration schema
 * describing what credentials/settings are needed per provider.
 */

export type ToolCategory =
  | 'Communications AI'
  | 'Sales & Growth AI'
  | 'Billing AI'
  | 'Marketing AI'
  | 'Automation AI'
  | 'Clinical AI';

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'url' | 'email' | 'toggle';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  helpText?: string;
  dependsOn?: { field: string; value: string }; // show only when another field has a value
}

export interface ToolConfigSection {
  sectionKey: string;
  sectionLabel: string;
  providerField?: string; // if present, sections below depend on provider selection
  fields: ConfigField[];
}

export interface ToolMeta {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;           // emoji or icon key
  color: string;          // hex accent color
  priceMonthly: number;   // individual price
  bundleIds?: string[];   // which bundles include this
  capabilities: string[];
  connectsTo: string[];
  configSections: ToolConfigSection[];
}

// ─── COMMUNICATIONS AI ─────────────────────────────────────────────────────────

const callingProviderField: ConfigField = {
  key: 'provider',
  label: 'Voice Provider',
  type: 'select',
  required: true,
  options: [
    { value: 'twilio', label: 'Twilio' },
    { value: 'plivo', label: 'Plivo' },
    { value: 'telnyx', label: 'Telnyx' },
    { value: 'vonage', label: 'Vonage' },
  ],
  helpText: 'Select your VoIP / calling service provider.',
};

const smsProviderField: ConfigField = {
  key: 'provider',
  label: 'SMS Provider',
  type: 'select',
  required: true,
  options: [
    { value: 'twilio', label: 'Twilio' },
    { value: 'plivo', label: 'Plivo' },
    { value: 'telnyx', label: 'Telnyx' },
    { value: 'messagebird', label: 'MessageBird' },
  ],
};

const twilioFields: ConfigField[] = [
  { key: 'twilioAccountSid', label: 'Twilio Account SID', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, dependsOn: { field: 'provider', value: 'twilio' } },
  { key: 'twilioAuthToken', label: 'Twilio Auth Token', type: 'password', placeholder: 'Your auth token', required: true, dependsOn: { field: 'provider', value: 'twilio' } },
  { key: 'twilioFromPhone', label: 'Twilio Phone Number', type: 'text', placeholder: '+15551234567', required: true, dependsOn: { field: 'provider', value: 'twilio' } },
];

const plivoFields: ConfigField[] = [
  { key: 'plivoAuthId', label: 'Plivo Auth ID', type: 'text', placeholder: 'Your Plivo Auth ID', required: true, dependsOn: { field: 'provider', value: 'plivo' } },
  { key: 'plivoAuthToken', label: 'Plivo Auth Token', type: 'password', placeholder: 'Your Plivo Auth Token', required: true, dependsOn: { field: 'provider', value: 'plivo' } },
  { key: 'plivoFromNumber', label: 'Plivo Phone Number', type: 'text', placeholder: '+15551234567', required: true, dependsOn: { field: 'provider', value: 'plivo' } },
];

const telnyxFields: ConfigField[] = [
  { key: 'telnyxApiKey', label: 'Telnyx API Key', type: 'password', placeholder: 'KEY0...', required: true, dependsOn: { field: 'provider', value: 'telnyx' } },
  { key: 'telnyxPhoneNumber', label: 'Telnyx Phone Number', type: 'text', placeholder: '+15551234567', required: true, dependsOn: { field: 'provider', value: 'telnyx' } },
];

const vonageFields: ConfigField[] = [
  { key: 'vonageApiKey', label: 'Vonage API Key', type: 'text', placeholder: 'Your Vonage API Key', required: true, dependsOn: { field: 'provider', value: 'vonage' } },
  { key: 'vonageApiSecret', label: 'Vonage API Secret', type: 'password', placeholder: 'Your Vonage API Secret', required: true, dependsOn: { field: 'provider', value: 'vonage' } },
  { key: 'vonageFromNumber', label: 'Vonage Phone Number', type: 'text', placeholder: '+15551234567', required: true, dependsOn: { field: 'provider', value: 'vonage' } },
];

const callingCommonFields: ConfigField[] = [
  { key: 'webhookCallbackUrl', label: 'Webhook Callback URL (optional)', type: 'url', placeholder: 'https://your-server.com/webhook/calls', helpText: 'Receives call status updates.' },
  { key: 'businessHoursStart', label: 'Business Hours Start', type: 'text', placeholder: '09:00', helpText: 'e.g., 09:00 (24h format)' },
  { key: 'businessHoursEnd', label: 'Business Hours End', type: 'text', placeholder: '18:00' },
  { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'America/New_York' },
];

const callingConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'provider_creds',
    sectionLabel: 'Provider & Credentials',
    fields: [callingProviderField, ...twilioFields, ...plivoFields, ...telnyxFields, ...vonageFields],
  },
  {
    sectionKey: 'calling_settings',
    sectionLabel: 'Calling Settings',
    fields: callingCommonFields,
  },
];

const smsConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'provider_creds',
    sectionLabel: 'SMS Provider & Credentials',
    fields: [
      smsProviderField,
      ...twilioFields,
      ...plivoFields,
      ...telnyxFields,
      { key: 'messagebirdApiKey', label: 'MessageBird API Key', type: 'password', placeholder: 'Your MessageBird API Key', dependsOn: { field: 'provider', value: 'messagebird' } },
      { key: 'messagebirdFromNumber', label: 'MessageBird From Number', type: 'text', placeholder: '+15551234567', dependsOn: { field: 'provider', value: 'messagebird' } },
    ],
  },
  {
    sectionKey: 'sms_settings',
    sectionLabel: 'SMS Settings',
    fields: [
      { key: 'optOutKeyword', label: 'Opt-Out Keyword', type: 'text', placeholder: 'STOP', helpText: 'Keyword recipients can text to unsubscribe.' },
    ],
  },
];

const whatsappConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'wa_provider',
    sectionLabel: 'WhatsApp Provider',
    fields: [
      {
        key: 'provider',
        label: 'WhatsApp Provider',
        type: 'select',
        required: true,
        options: [
          { value: 'twilio', label: 'Twilio WhatsApp' },
          { value: 'meta_cloud_api', label: 'Meta WhatsApp Cloud API' },
        ],
      },
      ...twilioFields.map(f => ({ ...f, dependsOn: { field: 'provider', value: 'twilio' } })),
      { key: 'metaPhoneNumberId', label: 'Meta Phone Number ID', type: 'text', placeholder: 'Your Meta Phone Number ID', dependsOn: { field: 'provider', value: 'meta_cloud_api' } },
      { key: 'metaAccessToken', label: 'Meta Access Token', type: 'password', placeholder: 'EAAxx...', dependsOn: { field: 'provider', value: 'meta_cloud_api' } },
      { key: 'metaWebhookVerifyToken', label: 'Webhook Verify Token', type: 'text', placeholder: 'A secret string you define', dependsOn: { field: 'provider', value: 'meta_cloud_api' } },
    ],
  },
];

const emailConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'email_provider',
    sectionLabel: 'Email Provider',
    fields: [
      {
        key: 'provider',
        label: 'Email Provider',
        type: 'select',
        required: true,
        options: [
          { value: 'smtp', label: 'SMTP (Gmail, Outlook, etc.)' },
          { value: 'sendgrid', label: 'SendGrid' },
          { value: 'mailgun', label: 'Mailgun' },
          { value: 'ses', label: 'Amazon SES' },
        ],
      },
      { key: 'smtpHost', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com', dependsOn: { field: 'provider', value: 'smtp' } },
      { key: 'smtpPort', label: 'SMTP Port', type: 'number', placeholder: '587', dependsOn: { field: 'provider', value: 'smtp' } },
      { key: 'smtpUser', label: 'SMTP Username / Email', type: 'email', placeholder: 'you@example.com', dependsOn: { field: 'provider', value: 'smtp' } },
      { key: 'smtpPass', label: 'SMTP Password / App Password', type: 'password', placeholder: 'App password or SMTP password', dependsOn: { field: 'provider', value: 'smtp' } },
      { key: 'smtpFrom', label: 'From Name / Email', type: 'text', placeholder: '"Clinic Name" <hello@clinic.com>', dependsOn: { field: 'provider', value: 'smtp' } },
      { key: 'sendgridApiKey', label: 'SendGrid API Key', type: 'password', placeholder: 'SG.xxx...', dependsOn: { field: 'provider', value: 'sendgrid' } },
      { key: 'sendgridFromEmail', label: 'Verified Sender Email', type: 'email', placeholder: 'hello@clinic.com', dependsOn: { field: 'provider', value: 'sendgrid' } },
      { key: 'mailgunApiKey', label: 'Mailgun API Key', type: 'password', placeholder: 'key-xxx...', dependsOn: { field: 'provider', value: 'mailgun' } },
      { key: 'mailgunDomain', label: 'Mailgun Domain', type: 'text', placeholder: 'mg.yourdomain.com', dependsOn: { field: 'provider', value: 'mailgun' } },
      { key: 'sesRegion', label: 'AWS Region', type: 'text', placeholder: 'us-east-1', dependsOn: { field: 'provider', value: 'ses' } },
      { key: 'sesAccessKeyId', label: 'AWS Access Key ID', type: 'text', placeholder: 'AKIA...', dependsOn: { field: 'provider', value: 'ses' } },
      { key: 'sesSecretAccessKey', label: 'AWS Secret Access Key', type: 'password', placeholder: 'Your secret access key', dependsOn: { field: 'provider', value: 'ses' } },
      { key: 'sesFromEmail', label: 'Verified From Email', type: 'email', placeholder: 'hello@clinic.com', dependsOn: { field: 'provider', value: 'ses' } },
    ],
  },
];

const calendarConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'calendar_provider',
    sectionLabel: 'Calendar Provider',
    fields: [
      {
        key: 'provider',
        label: 'Calendar / Scheduling Provider',
        type: 'select',
        required: true,
        options: [
          { value: 'google_calendar', label: 'Google Calendar' },
          { value: 'calendly', label: 'Calendly' },
          { value: 'ghl_calendar', label: 'GoHighLevel Calendar' },
          { value: 'acuity', label: 'Acuity Scheduling' },
        ],
      },
      { key: 'googleCalendarId', label: 'Google Calendar ID', type: 'email', placeholder: 'appointments@yourclinic.com', dependsOn: { field: 'provider', value: 'google_calendar' } },
      { key: 'googleServiceAccountKey', label: 'Google Service Account JSON Key', type: 'password', placeholder: 'Paste the full JSON key here', helpText: 'Download from Google Cloud Console → IAM → Service Accounts', dependsOn: { field: 'provider', value: 'google_calendar' } },
      { key: 'calendlyApiKey', label: 'Calendly API Key', type: 'password', placeholder: 'Your Calendly Personal Access Token', dependsOn: { field: 'provider', value: 'calendly' } },
      { key: 'calendlyEventUrl', label: 'Calendly Event URL', type: 'url', placeholder: 'https://calendly.com/yourname/consultation', dependsOn: { field: 'provider', value: 'calendly' } },
      { key: 'ghlApiKey', label: 'GoHighLevel API Key', type: 'password', placeholder: 'Your GHL API Key', dependsOn: { field: 'provider', value: 'ghl_calendar' } },
      { key: 'ghlCalendarId', label: 'GHL Calendar ID', type: 'text', placeholder: 'Your GHL Calendar ID', dependsOn: { field: 'provider', value: 'ghl_calendar' } },
      { key: 'acuityUserId', label: 'Acuity User ID', type: 'text', placeholder: 'Your Acuity User ID', dependsOn: { field: 'provider', value: 'acuity' } },
      { key: 'acuityApiKey', label: 'Acuity API Key', type: 'password', placeholder: 'Your Acuity API Key', dependsOn: { field: 'provider', value: 'acuity' } },
      { key: 'bookingWebhookUrl', label: 'Booking Webhook URL (optional)', type: 'url', placeholder: 'https://your-crm.com/webhook/bookings', helpText: 'Receives new booking notifications.' },
    ],
  },
];

const crmConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'crm_provider',
    sectionLabel: 'CRM Provider',
    fields: [
      {
        key: 'provider',
        label: 'CRM / Pipeline Provider',
        type: 'select',
        required: true,
        options: [
          { value: 'gohighlevel', label: 'GoHighLevel' },
          { value: 'hubspot', label: 'HubSpot' },
          { value: 'salesforce', label: 'Salesforce' },
          { value: 'zoho', label: 'Zoho CRM' },
          { value: 'webhook', label: 'Custom Webhook' },
        ],
      },
      { key: 'ghlApiKey', label: 'GHL API Key', type: 'password', placeholder: 'Your GoHighLevel API Key', dependsOn: { field: 'provider', value: 'gohighlevel' } },
      { key: 'ghlLocationId', label: 'GHL Location ID', type: 'text', placeholder: 'Your GHL Location / Sub-Account ID', dependsOn: { field: 'provider', value: 'gohighlevel' } },
      { key: 'hubspotApiKey', label: 'HubSpot Private App Token', type: 'password', placeholder: 'pat-na1-xxx...', dependsOn: { field: 'provider', value: 'hubspot' } },
      { key: 'salesforceInstanceUrl', label: 'Salesforce Instance URL', type: 'url', placeholder: 'https://myinstance.salesforce.com', dependsOn: { field: 'provider', value: 'salesforce' } },
      { key: 'salesforceClientId', label: 'Salesforce Client ID', type: 'text', placeholder: 'Connected App Consumer Key', dependsOn: { field: 'provider', value: 'salesforce' } },
      { key: 'salesforceClientSecret', label: 'Salesforce Client Secret', type: 'password', placeholder: 'Connected App Consumer Secret', dependsOn: { field: 'provider', value: 'salesforce' } },
      { key: 'zohoClientId', label: 'Zoho Client ID', type: 'text', placeholder: 'Your Zoho CRM Client ID', dependsOn: { field: 'provider', value: 'zoho' } },
      { key: 'zohoClientSecret', label: 'Zoho Client Secret', type: 'password', dependsOn: { field: 'provider', value: 'zoho' } },
      { key: 'webhookUrl', label: 'Custom Webhook URL', type: 'url', placeholder: 'https://your-crm.com/api/contacts', dependsOn: { field: 'provider', value: 'webhook' } },
      { key: 'urgentNotificationWebhook', label: 'Urgent Notification Webhook (optional)', type: 'url', placeholder: 'https://hooks.slack.com/services/...' },
      { key: 'leadScoreThreshold', label: 'Lead Score Threshold (0-100)', type: 'number', placeholder: '75', helpText: 'Leads above this score trigger urgent escalation.' },
    ],
  },
];

const billingConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'billing',
    sectionLabel: 'Payment Provider (Mock)',
    fields: [
      { key: 'stripeSecretKey', label: 'Stripe Secret Key (Test)', type: 'password', placeholder: 'sk_test_xxx...', helpText: 'Use test key for now — live payments coming soon.' },
      { key: 'stripeWebhookSecret', label: 'Stripe Webhook Secret', type: 'password', placeholder: 'whsec_xxx...' },
      { key: 'currency', label: 'Currency', type: 'text', placeholder: 'usd' },
    ],
  },
];

const reviewConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'reviews',
    sectionLabel: 'Google Reviews Configuration',
    fields: [
      { key: 'googleReviewUrl', label: 'Google Review URL', type: 'url', placeholder: 'https://g.page/r/your-business/review', required: true, helpText: 'Your direct Google Business review link.' },
      { key: 'googlePlacesApiKey', label: 'Google Places API Key (optional)', type: 'password', placeholder: 'AIzaSy...', helpText: 'For reading & responding to existing reviews.' },
      { key: 'serviceRecoveryWebhookUrl', label: 'Service Recovery Webhook URL', type: 'url', placeholder: 'https://your-crm.com/webhook/complaints', helpText: 'Where to send unhappy patient alerts.' },
    ],
  },
];

const emrConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'emr',
    sectionLabel: 'EMR / EHR Integration',
    fields: [
      {
        key: 'provider',
        label: 'EMR / EHR System',
        type: 'select',
        required: true,
        options: [
          { value: 'drchrono', label: 'DrChrono' },
          { value: 'jane_app', label: 'Jane App' },
          { value: 'nookal', label: 'Nookal' },
          { value: 'mindbody', label: 'MINDBODY' },
          { value: 'custom_webhook', label: 'Custom API / Webhook' },
        ],
      },
      { key: 'apiKey', label: 'API Key / Token', type: 'password', placeholder: 'Your EMR API key' },
      { key: 'baseUrl', label: 'Base API URL (for custom)', type: 'url', placeholder: 'https://api.your-emr.com/v1', dependsOn: { field: 'provider', value: 'custom_webhook' } },
      { key: 'webhookUrl', label: 'Event Webhook URL (optional)', type: 'url', placeholder: 'https://your-server.com/webhook/emr' },
    ],
  },
];

const webChatConfigSections: ToolConfigSection[] = [
  {
    sectionKey: 'webchat',
    sectionLabel: 'Web Chat Widget',
    fields: [
      { key: 'widgetTitle', label: 'Widget Title', type: 'text', placeholder: 'Chat with us', required: true },
      { key: 'widgetColor', label: 'Widget Accent Color', type: 'text', placeholder: '#2563eb' },
      { key: 'greetingMessage', label: 'Opening Greeting', type: 'text', placeholder: "Hi! I'm your AI assistant. How can I help?" },
      { key: 'allowedDomains', label: 'Allowed Domains', type: 'text', placeholder: 'yourclinic.com, www.yourclinic.com', helpText: 'Comma-separated domains where the widget is embedded.' },
    ],
  },
];

// ─── THE FULL 30-TOOL CATALOG ──────────────────────────────────────────────────

export const TOOL_CATALOG: ToolMeta[] = [
  {
    id: 'lead-concierge',
    name: 'AI Lead Concierge',
    description: 'Instant multi-channel lead engagement within seconds via SMS/WhatsApp/Email with intent capture.',
    category: 'Communications AI',
    icon: '💬',
    color: '#06b6d4',
    priceMonthly: 299,
    capabilities: ['Sub-15s first contact', 'SMS & WhatsApp outreach', 'Intent capture', 'CRM sync'],
    connectsTo: ['Phone / SMS', 'WhatsApp', 'CRM'],
    configSections: [
      { sectionKey: 'sms_config', sectionLabel: 'SMS Configuration', fields: [smsProviderField, ...twilioFields, ...plivoFields, ...telnyxFields] },
      { sectionKey: 'crm_config', sectionLabel: 'CRM Sync (optional)', fields: crmConfigSections[0].fields },
    ],
  },
  {
    id: 'lead-qualifier',
    name: 'AI Lead Qualifier',
    description: 'Scores leads on treatment fit, timeline, budget viability, and buying urgency automatically.',
    category: 'Sales & Growth AI',
    icon: '✅',
    color: '#6366f1',
    priceMonthly: 249,
    capabilities: ['Budget scoring', 'Intent analysis', 'Lead scoring 0-100', 'Hot lead escalation'],
    connectsTo: ['CRM', 'Slack / Webhook'],
    configSections: crmConfigSections,
  },
  {
    id: 'voice-agent',
    name: 'AI Voice Agent (Inbound)',
    description: 'Answers inbound calls 24/7, handles inquiries, books appointments, and routes to human staff.',
    category: 'Communications AI',
    icon: '🎙️',
    color: '#8b5cf6',
    priceMonthly: 399,
    capabilities: ['24/7 inbound call handling', 'Intent detection', 'Appointment booking via voice', 'Human handoff'],
    connectsTo: ['Phone / VoIP', 'Scheduling', 'CRM'],
    configSections: callingConfigSections,
  },
  {
    id: 'outbound-calling-agent',
    name: 'AI Outbound Calling Agent',
    description: 'Makes proactive outbound calls for follow-ups, appointment reminders, and lead recovery.',
    category: 'Communications AI',
    icon: '📞',
    color: '#0ea5e9',
    priceMonthly: 449,
    capabilities: ['Automated outbound calls', 'TTS voice delivery', 'Call outcome tracking', 'Voicemail detection'],
    connectsTo: ['Phone / VoIP', 'CRM'],
    configSections: callingConfigSections,
  },
  {
    id: 'receptionist-agent',
    name: 'AI Receptionist',
    description: 'Handles front-desk call transcripts, routes inquiries, and manages call overflow seamlessly.',
    category: 'Communications AI',
    icon: '🏥',
    color: '#10b981',
    priceMonthly: 349,
    capabilities: ['Call transcript processing', 'Front-desk routing', 'Call overflow management', 'Calendar integration'],
    connectsTo: ['Phone / VoIP', 'Scheduling'],
    configSections: [...callingConfigSections, ...calendarConfigSections],
  },
  {
    id: 'sms-concierge',
    name: 'AI SMS Concierge',
    description: 'Manages inbound and outbound SMS conversations, automated responses, and nurture sequences.',
    category: 'Communications AI',
    icon: '📱',
    color: '#f59e0b',
    priceMonthly: 199,
    capabilities: ['Inbound SMS handling', 'Outbound nurture sequences', 'Two-way SMS conversations', 'Opt-out management'],
    connectsTo: ['SMS', 'CRM'],
    configSections: smsConfigSections,
  },
  {
    id: 'whatsapp-concierge',
    name: 'AI WhatsApp Concierge',
    description: 'Engages leads and patients on WhatsApp with personalized messages and conversational AI.',
    category: 'Communications AI',
    icon: '💚',
    color: '#25d366',
    priceMonthly: 249,
    capabilities: ['WhatsApp Business messaging', 'Media sharing', 'Conversation history', 'Appointment links'],
    connectsTo: ['WhatsApp', 'CRM'],
    configSections: whatsappConfigSections,
  },
  {
    id: 'web-concierge',
    name: 'AI Web Chat Concierge',
    description: 'Embeddable AI chat widget for your website — converts visitors into leads and appointments.',
    category: 'Communications AI',
    icon: '🌐',
    color: '#3b82f6',
    priceMonthly: 199,
    capabilities: ['Website chat widget', 'Lead capture forms', '24/7 automated responses', 'Handoff to SMS/WhatsApp'],
    connectsTo: ['Website', 'SMS', 'CRM'],
    configSections: webChatConfigSections,
  },
  {
    id: 'booking-agent',
    name: 'AI Booking Agent',
    description: 'Proposes available consultation slots, generates appointment confirmations, and handles rescheduling.',
    category: 'Sales & Growth AI',
    icon: '📅',
    color: '#10b981',
    priceMonthly: 349,
    capabilities: ['Real-time availability check', 'Instant confirmations', 'Rescheduling & cancellations', 'Calendar sync'],
    connectsTo: ['Scheduling', 'SMS', 'Email'],
    configSections: calendarConfigSections,
  },
  {
    id: 'follow-up-agent',
    name: 'AI Follow-Up Agent',
    description: 'Deploys 14-30 day coordinated multi-touch recovery sequences for leads who went cold.',
    category: 'Marketing AI',
    icon: '🔔',
    color: '#f59e0b',
    priceMonthly: 199,
    capabilities: ['Multi-touch sequences', 'SMS + email drips', 'Cold lead reactivation', 'n8n/Make webhooks'],
    connectsTo: ['SMS', 'Email', 'Webhook'],
    configSections: [...smsConfigSections, ...emailConfigSections],
  },
  {
    id: 'upsell-agent',
    name: 'AI Upsell Agent',
    description: 'Identifies upsell opportunities post-visit and automatically promotes additional treatments.',
    category: 'Sales & Growth AI',
    icon: '📈',
    color: '#06b6d4',
    priceMonthly: 249,
    capabilities: ['Post-visit upsell sequences', 'Treatment recommendations', 'Personalized offers', 'Revenue tracking'],
    connectsTo: ['SMS', 'Email', 'CRM'],
    configSections: [...smsConfigSections, ...emailConfigSections],
  },
  {
    id: 'membership-agent',
    name: 'AI Membership Agent',
    description: 'Manages membership enrollment, renewals, payment reminders, and retention campaigns.',
    category: 'Billing AI',
    icon: '🏆',
    color: '#f59e0b',
    priceMonthly: 299,
    capabilities: ['Membership enrollment', 'Renewal reminders', 'Payment failure recovery', 'Retention sequences'],
    connectsTo: ['Stripe / Billing', 'SMS', 'Email'],
    configSections: [...billingConfigSections, ...smsConfigSections],
  },
  {
    id: 'revenue-recovery-agent',
    name: 'AI Revenue Recovery Agent',
    description: 'Chases overdue invoices, failed payments, and lapsing memberships with automated sequences.',
    category: 'Billing AI',
    icon: '💰',
    color: '#ef4444',
    priceMonthly: 299,
    capabilities: ['Failed payment recovery', 'Overdue invoice follow-ups', 'Lapsing membership alerts', 'Dispute flagging'],
    connectsTo: ['Stripe / Billing', 'SMS', 'Email'],
    configSections: [...billingConfigSections, ...smsConfigSections],
  },
  {
    id: 'campaign-agent',
    name: 'AI Campaign Agent',
    description: 'Plans and executes targeted SMS/email marketing campaigns based on patient segments.',
    category: 'Marketing AI',
    icon: '📣',
    color: '#8b5cf6',
    priceMonthly: 349,
    capabilities: ['Targeted campaigns', 'Patient segmentation', 'SMS & email blasts', 'Campaign analytics'],
    connectsTo: ['SMS', 'Email', 'CRM'],
    configSections: [...smsConfigSections, ...emailConfigSections],
  },
  {
    id: 'referral-agent',
    name: 'AI Referral Agent',
    description: 'Automates referral program management — requests referrals from happy patients and tracks conversions.',
    category: 'Marketing AI',
    icon: '🤝',
    color: '#10b981',
    priceMonthly: 199,
    capabilities: ['Referral request automation', 'Referral tracking', 'Reward reminders', 'Conversion attribution'],
    connectsTo: ['SMS', 'Email'],
    configSections: [...smsConfigSections, ...emailConfigSections],
  },
  {
    id: 'review-agent',
    name: 'AI Review Agent',
    description: 'Automates 5-star Google review acquisition and routes dissatisfied patients to private resolution.',
    category: 'Marketing AI',
    icon: '⭐',
    color: '#f43f5e',
    priceMonthly: 179,
    capabilities: ['5-star review requests', 'Negative review interception', 'Google Business sync', 'Reputation monitoring'],
    connectsTo: ['Google Business', 'SMS', 'Email'],
    configSections: reviewConfigSections,
  },
  {
    id: 'reactivation-agent',
    name: 'AI Reactivation Agent',
    description: 'Identifies dormant patients and deploys personalized reactivation campaigns to bring them back.',
    category: 'Marketing AI',
    icon: '🔄',
    color: '#06b6d4',
    priceMonthly: 249,
    capabilities: ['Dormant patient detection', 'Personalized win-back sequences', 'Seasonal campaigns', 'Re-engagement scoring'],
    connectsTo: ['SMS', 'Email', 'CRM'],
    configSections: [...smsConfigSections, ...emailConfigSections],
  },
  {
    id: 'no-show-prevention-agent',
    name: 'AI No-Show Prevention',
    description: 'Sends smart appointment reminders and confirmation requests to reduce no-show rates.',
    category: 'Automation AI',
    icon: '⏰',
    color: '#f59e0b',
    priceMonthly: 199,
    capabilities: ['Multi-step reminders', 'Confirmation requests', 'Reschedule prompts', 'No-show rate tracking'],
    connectsTo: ['SMS', 'Calendar'],
    configSections: [...smsConfigSections, ...calendarConfigSections],
  },
  {
    id: 'cancellation-recovery-agent',
    name: 'AI Cancellation Recovery',
    description: 'When an appointment is cancelled, immediately reschedules it or fills the slot from the waitlist.',
    category: 'Automation AI',
    icon: '🔃',
    color: '#ef4444',
    priceMonthly: 249,
    capabilities: ['Instant cancellation detection', 'Waitlist promotion', 'Rescheduling offers', 'Revenue recovery'],
    connectsTo: ['Calendar', 'SMS'],
    configSections: [...calendarConfigSections, ...smsConfigSections],
  },
  {
    id: 'waitlist-agent',
    name: 'AI Waitlist Agent',
    description: 'Manages the appointment waitlist and automatically fills cancellations with waiting patients.',
    category: 'Automation AI',
    icon: '📋',
    color: '#6366f1',
    priceMonthly: 149,
    capabilities: ['Waitlist management', 'Priority ordering', 'Auto-fill on cancellation', 'Wait time estimates'],
    connectsTo: ['Calendar', 'SMS'],
    configSections: [...calendarConfigSections, ...smsConfigSections],
  },
  {
    id: 'rebooking-agent',
    name: 'AI Rebooking Agent',
    description: 'Proactively reaches out to patients due for their next visit and secures the next appointment.',
    category: 'Automation AI',
    icon: '📆',
    color: '#10b981',
    priceMonthly: 199,
    capabilities: ['Treatment cycle tracking', 'Proactive rebooking', 'Post-visit follow-ups', 'Calendar integration'],
    connectsTo: ['Calendar', 'SMS', 'Email'],
    configSections: [...calendarConfigSections, ...smsConfigSections],
  },
  {
    id: 'post-treatment-agent',
    name: 'AI Post-Treatment Agent',
    description: 'Sends after-care instructions, checks recovery progress, and gathers treatment feedback.',
    category: 'Clinical AI',
    icon: '💊',
    color: '#0ea5e9',
    priceMonthly: 199,
    capabilities: ['After-care instructions', 'Recovery check-ins', 'Symptom monitoring', 'Satisfaction surveys'],
    connectsTo: ['SMS', 'Email'],
    configSections: [...smsConfigSections, ...emailConfigSections],
  },
  {
    id: 'patient-concierge',
    name: 'AI Patient Concierge',
    description: 'Provides patients with personalized service — answers questions, shares resources, and manages requests.',
    category: 'Clinical AI',
    icon: '👤',
    color: '#6366f1',
    priceMonthly: 249,
    capabilities: ['Patient Q&A', 'Resource sharing', 'Pre-appointment prep', 'Personalized communication'],
    connectsTo: ['SMS', 'WhatsApp', 'Email'],
    configSections: [...smsConfigSections, ...emailConfigSections],
  },
  {
    id: 'emr-ehr-integration-agent',
    name: 'AI EMR/EHR Integration',
    description: 'Syncs patient data between your AI workforce and your Electronic Medical Records system.',
    category: 'Clinical AI',
    icon: '🏥',
    color: '#10b981',
    priceMonthly: 399,
    capabilities: ['EMR/EHR data sync', 'Patient record updates', 'Treatment history access', 'HIPAA-aware handling'],
    connectsTo: ['EMR / EHR'],
    configSections: emrConfigSections,
  },
  {
    id: 'crm-agent',
    name: 'AI CRM Agent',
    description: 'Automatically logs interactions, updates contact records, and manages your CRM pipeline.',
    category: 'Automation AI',
    icon: '🗃️',
    color: '#f59e0b',
    priceMonthly: 299,
    capabilities: ['Auto contact logging', 'Pipeline stage updates', 'Deal tracking', 'Activity sync'],
    connectsTo: ['CRM'],
    configSections: crmConfigSections,
  },
  {
    id: 'front-desk-copilot',
    name: 'AI Front Desk Copilot',
    description: 'Real-time AI assistant for your front desk staff — instant patient lookup, scripts, and action suggestions.',
    category: 'Automation AI',
    icon: '🖥️',
    color: '#8b5cf6',
    priceMonthly: 349,
    capabilities: ['Real-time staff assistance', 'Patient lookup', 'Script suggestions', 'Instant action triggers'],
    connectsTo: ['Calendar', 'CRM', 'Phone / VoIP'],
    configSections: [...calendarConfigSections, ...crmConfigSections],
  },
  {
    id: 'growth-analyst',
    name: 'AI Growth Analyst',
    description: 'Analyzes your business metrics, identifies growth opportunities, and generates strategic reports.',
    category: 'Sales & Growth AI',
    icon: '📊',
    color: '#06b6d4',
    priceMonthly: 399,
    capabilities: ['Revenue analytics', 'Lead funnel analysis', 'Growth opportunity detection', 'Weekly reports'],
    connectsTo: ['CRM', 'Analytics'],
    configSections: crmConfigSections,
  },
  {
    id: 'integration-guardian',
    name: 'AI Integration Guardian',
    description: 'Monitors all your integrations and webhooks, detects failures, and self-heals broken connections.',
    category: 'Automation AI',
    icon: '🛡️',
    color: '#ef4444',
    priceMonthly: 249,
    capabilities: ['Integration health monitoring', 'Failure detection & alerts', 'Auto-retry logic', 'Uptime reporting'],
    connectsTo: ['All Webhooks', 'Slack / Alerts'],
    configSections: [
      {
        sectionKey: 'guardian',
        sectionLabel: 'Monitoring Configuration',
        fields: [
          { key: 'alertWebhookUrl', label: 'Alert Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/services/...', helpText: 'Where to send failure alerts (e.g. Slack).' },
          { key: 'checkIntervalMinutes', label: 'Check Interval (minutes)', type: 'number', placeholder: '5' },
        ],
      },
    ],
  },
  {
    id: 'lead-recovery-agent',
    name: 'AI Lead Recovery Agent',
    description: 'Rescues stalled or lost leads through intelligent multi-channel re-engagement campaigns.',
    category: 'Sales & Growth AI',
    icon: '🚑',
    color: '#f43f5e',
    priceMonthly: 249,
    capabilities: ['Lost lead detection', 'Personalized re-engagement', 'Multi-channel campaigns', 'Recovery rate tracking'],
    connectsTo: ['SMS', 'Email', 'CRM'],
    configSections: [...smsConfigSections, ...emailConfigSections, ...crmConfigSections],
  },
  {
    id: 'treatment-advisor',
    name: 'AI Treatment Advisor',
    description: 'Recommends personalized treatments based on patient goals, skin type, and treatment history.',
    category: 'Sales & Growth AI',
    icon: '💡',
    color: '#a855f7',
    priceMonthly: 299,
    capabilities: ['Personalized treatment recommendations', 'Protocol matching', 'Contraindication checks', 'Upsell suggestions'],
    connectsTo: ['CRM', 'EMR / EHR'],
    configSections: emrConfigSections,
  },
];

export function getToolById(id: string): ToolMeta | undefined {
  return TOOL_CATALOG.find(t => t.id === id);
}

export function getToolsByCategory(category: ToolCategory): ToolMeta[] {
  return TOOL_CATALOG.filter(t => t.category === category);
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  'Communications AI',
  'Sales & Growth AI',
  'Billing AI',
  'Marketing AI',
  'Automation AI',
  'Clinical AI',
];

// ─── Pre-built Bundles ─────────────────────────────────────────────────────────
export const TOOL_BUNDLES = [
  {
    id: 'starter_comms',
    name: 'Communications Starter',
    description: 'Get the core communication agents to instantly engage and respond to every inbound lead.',
    price: 549,
    savings: 'Save $148/mo',
    badge: 'Most Popular',
    toolIds: ['lead-concierge', 'sms-concierge', 'follow-up-agent'],
    features: ['Instant lead response', 'SMS drip sequences', 'Multi-touch follow-up', 'CRM sync'],
  },
  {
    id: 'booking_suite',
    name: 'Booking & Conversion Suite',
    description: 'The complete lead-to-booked-appointment pipeline.',
    price: 849,
    savings: 'Save $246/mo',
    badge: 'Recommended',
    toolIds: ['lead-concierge', 'lead-qualifier', 'booking-agent', 'no-show-prevention-agent'],
    features: ['Instant engagement', 'Lead scoring', 'Automated booking', 'No-show prevention'],
  },
  {
    id: 'growth_suite',
    name: 'Full Growth Suite',
    description: 'Complete front-to-back automation: leads, bookings, reviews, and reactivations.',
    price: 1499,
    savings: 'Save $895/mo',
    badge: 'Best Value',
    toolIds: ['lead-concierge', 'lead-qualifier', 'booking-agent', 'follow-up-agent', 'review-agent', 'reactivation-agent', 'upsell-agent'],
    features: ['All core growth agents', 'Multi-channel automation', 'Review generation', 'Patient reactivation'],
  },
];
