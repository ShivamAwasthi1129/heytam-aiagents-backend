/**
 * Tool Configuration Store
 * Manages which tools a business has activated, and their per-tool credentials/settings.
 */
import { getDb } from './mongodb.js';

// ─── Business Tool Subscription ───────────────────────────────────────────────
export interface BusinessTool {
  id: string;
  businessId: string;
  toolId: string;
  toolName: string;
  category: string;
  status: 'active' | 'needs_setup' | 'paused';
  monthlyFee: number;
  activatedAt: string;
}

// ─── Tool Configuration (credentials per provider) ────────────────────────────
export interface ToolConfiguration {
  id: string;
  businessId: string;
  toolId: string;
  config: Record<string, any>;
  isConfigured: boolean;
  lastTestedAt?: string;
  testResult?: { success: boolean; message: string };
  updatedAt: string;
}

// ─── Activate Tool ─────────────────────────────────────────────────────────────
export async function activateTool(businessId: string, toolId: string, toolName: string, category: string, monthlyFee: number): Promise<BusinessTool> {
  const db = await getDb();
  const existing = await db.collection('business_tools').findOne({ businessId, toolId });
  if (existing) throw new Error(`Tool ${toolId} is already activated for this business.`);

  const tool: BusinessTool = {
    id: `bt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    businessId,
    toolId,
    toolName,
    category,
    status: 'needs_setup',
    monthlyFee,
    activatedAt: new Date().toISOString(),
  };

  await db.collection('business_tools').insertOne(tool as any);
  return tool;
}

// ─── Deactivate Tool ───────────────────────────────────────────────────────────
export async function deactivateTool(businessId: string, toolId: string): Promise<void> {
  const db = await getDb();
  await db.collection('business_tools').deleteOne({ businessId, toolId });
  await db.collection('tool_configurations').deleteOne({ businessId, toolId });
}

// ─── Get All Tools for Business ───────────────────────────────────────────────
export async function getBusinessTools(businessId: string): Promise<BusinessTool[]> {
  const db = await getDb();
  const docs = await db.collection('business_tools').find({ businessId }).toArray();
  return docs as unknown as BusinessTool[];
}

// ─── Save Tool Configuration ──────────────────────────────────────────────────
export async function saveToolConfig(businessId: string, toolId: string, config: Record<string, any>): Promise<ToolConfiguration> {
  const db = await getDb();

  const toolConfig: ToolConfiguration = {
    id: `tc_${businessId}_${toolId}`,
    businessId,
    toolId,
    config,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  };

  await db.collection('tool_configurations').updateOne(
    { businessId, toolId },
    { $set: toolConfig },
    { upsert: true }
  );

  // Mark the tool as 'active' once configured
  await db.collection('business_tools').updateOne(
    { businessId, toolId },
    { $set: { status: 'active' } }
  );

  return toolConfig;
}

// ─── Get Tool Configuration ───────────────────────────────────────────────────
export async function getToolConfig(businessId: string, toolId: string): Promise<ToolConfiguration | null> {
  const db = await getDb();
  const doc = await db.collection('tool_configurations').findOne({ businessId, toolId });
  return doc ? (doc as unknown as ToolConfiguration) : null;
}

// ─── Save Test Result ─────────────────────────────────────────────────────────
export async function saveTestResult(
  businessId: string,
  toolId: string,
  testResult: { success: boolean; message: string }
): Promise<void> {
  const db = await getDb();
  await db.collection('tool_configurations').updateOne(
    { businessId, toolId },
    {
      $set: {
        testResult,
        lastTestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  );
}

// ─── OAuth Connection Store ───────────────────────────────────────────────────
export interface OAuthConnection {
  businessId: string;
  provider: 'google' | 'twilio' | 'hubspot' | 'calendly' | 'stripe' | 'meta_whatsapp' | 'zoom' | string;
  connected: boolean;
  accountEmail?: string;
  accountId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  connectedAt: string;
}

export async function saveOAuthConnection(
  businessId: string,
  provider: string,
  data: {
    accountEmail?: string;
    accountId?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    scopes?: string[];
    extraConfig?: Record<string, any>;
  }
): Promise<OAuthConnection> {
  const db = await getDb();

  // Only store REAL tokens — never generate fake ones
  const conn: OAuthConnection = {
    businessId,
    provider,
    connected: true,
    accountEmail: data.accountEmail,
    accountId: data.accountId,
    // Only set accessToken/refreshToken if they were actually provided by the OAuth provider
    ...(data.accessToken ? { accessToken: data.accessToken } : {}),
    ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
    ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
    scopes: data.scopes || [],
    connectedAt: new Date().toISOString(),
  };

  await db.collection('oauth_connections').updateOne(
    { businessId, provider },
    { $set: conn },
    { upsert: true }
  );

  // Auto-update tool_configurations for matching slave tools
  const providerToolMap: Record<string, string[]> = {
    google: ['booking-agent', 'follow-up-agent', 'calendar-tool', 'inbox-tool', 'crm-agent'],
    google_calendar: ['booking-agent', 'calendar-tool'],
    twilio: ['voice-agent', 'outbound-calling-agent', 'sms-concierge', 'lead-concierge'],
    hubspot: ['crm-agent', 'lead-qualifier', 'booking-agent'],
    calendly: ['booking-agent', 'calendar-tool'],
    stripe: ['revenue-recovery-agent', 'membership-agent'],
    meta_whatsapp: ['whatsapp-concierge'],
  };

  const targetTools = providerToolMap[provider] || [provider];
  for (const tid of targetTools) {
    const existing = await getToolConfig(businessId, tid);
    const updatedConfig = {
      ...(existing?.config || {}),
      provider,
      oauthConnected: !!(conn.accessToken || (data.extraConfig as any)?.clientId),
      oauthProvider: provider,
      oauthEmail: conn.accountEmail,
      // Only copy real tokens, not placeholders
      ...(conn.accessToken ? { googleAccessToken: conn.accessToken } : {}),
      ...(conn.refreshToken ? { googleRefreshToken: conn.refreshToken } : {}),
      ...(conn.accountEmail ? { googleCalendarId: conn.accountEmail } : {}),
      ...(data.extraConfig || {}),
    };
    await saveToolConfig(businessId, tid, updatedConfig);
  }

  return conn;
}

export async function getOAuthConnections(businessId: string): Promise<Record<string, OAuthConnection>> {
  const db = await getDb();
  const docs = await db.collection('oauth_connections').find({ businessId }).toArray();
  const result: Record<string, OAuthConnection> = {};
  for (const doc of docs as unknown as OAuthConnection[]) {
    result[doc.provider] = doc;
  }
  return result;
}

export async function disconnectOAuthProvider(businessId: string, provider: string): Promise<void> {
  const db = await getDb();
  await db.collection('oauth_connections').deleteOne({ businessId, provider });

  // Update associated tool configs to remove oauth flag
  const providerToolMap: Record<string, string[]> = {
    google: ['booking-agent', 'follow-up-agent', 'calendar-tool', 'inbox-tool', 'crm-agent'],
    google_calendar: ['booking-agent', 'calendar-tool'],
    twilio: ['voice-agent', 'outbound-calling-agent', 'sms-concierge', 'lead-concierge'],
    hubspot: ['crm-agent', 'lead-qualifier', 'booking-agent'],
    calendly: ['booking-agent', 'calendar-tool'],
    stripe: ['revenue-recovery-agent', 'membership-agent'],
  };
  const targetTools = providerToolMap[provider] || [provider];
  for (const tid of targetTools) {
    const existing = await getToolConfig(businessId, tid);
    if (existing?.config) {
      const cfg = { ...existing.config };
      delete cfg.oauthConnected;
      delete cfg.googleAccessToken;
      delete cfg.googleRefreshToken;
      await saveToolConfig(businessId, tid, cfg);
    }
  }
}
