/**
 * CRM Lead Signals Module — Adapted from heytam-core
 * Handles incoming CRM lead webhooks and polling.
 * Emits events that the HeyTam orchestrator picks up and delegates to agents.
 */
import { EventEmitter } from 'events';
import { crmSignalsTotal } from '../metrics/prometheus.js';

export interface CrmLead {
  id: string;
  status: 'pending_call' | 'pending_email' | 'pending_followup' | 'active' | 'converted' | 'lost';
  name: string;
  email: string;
  phone: string;
  source?: string;
  notes?: string;
  businessId?: string;
  receivedAt: string;
}

export interface CrmSignalNotification {
  kind: 'lead-pending-call' | 'lead-pending-email' | 'lead-pending-followup' | 'lead-updated';
  summary: string;
  source: string;
  payload: CrmLead;
}

class CrmLeadSignalProvider extends EventEmitter {
  readonly id = 'crm-lead-signals';
  private pollInterval?: ReturnType<typeof setInterval>;

  /**
   * Handle incoming real-time CRM webhook push events
   */
  async handleIncomingCrmWebhook(payload: Partial<CrmLead>): Promise<{ accepted: boolean; signal?: CrmSignalNotification }> {
    if (!payload?.id || !payload.status) {
      return { accepted: false };
    }

    const lead: CrmLead = {
      id: payload.id,
      status: payload.status as CrmLead['status'],
      name: payload.name || 'Unknown',
      email: payload.email || '',
      phone: payload.phone || '',
      source: payload.source || 'webhook',
      notes: payload.notes,
      businessId: payload.businessId,
      receivedAt: new Date().toISOString(),
    };

    let signalKind: CrmSignalNotification['kind'] | null = null;

    if (lead.status === 'pending_call') signalKind = 'lead-pending-call';
    else if (lead.status === 'pending_email') signalKind = 'lead-pending-email';
    else if (lead.status === 'pending_followup') signalKind = 'lead-pending-followup';
    else signalKind = 'lead-updated';

    const notification: CrmSignalNotification = {
      kind: signalKind,
      summary: `CRM lead signal: ${lead.name} (${lead.status})`,
      source: 'crm-webhook',
      payload: lead,
    };

    console.log(`[CrmLeadSignalProvider] Received webhook for lead ${lead.id} — ${lead.status}`);
    crmSignalsTotal.labels({ signal_type: signalKind, status: 'received' }).inc();

    this.emit('signal', notification);

    return { accepted: true, signal: notification };
  }

  /**
   * Start polling (simulated — in prod, replace with real CRM API call)
   */
  start(intervalMs = 30000): void {
    console.log(`[CrmLeadSignalProvider] Polling started (every ${intervalMs / 1000}s)`);
    this.pollInterval = setInterval(() => {
      this.poll().catch(console.error);
    }, intervalMs);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      console.log('[CrmLeadSignalProvider] Polling stopped');
    }
  }

  private async poll(): Promise<void> {
    console.log('[CrmLeadSignalProvider] Polling for pending leads...');
    // In production: replace with actual CRM API call (GoHighLevel, HubSpot, etc.)
    // For now, emit a no-op poll log so it's visible in observability
    crmSignalsTotal.labels({ signal_type: 'poll', status: 'ok' }).inc();
  }
}

export const crmLeadSignalProvider = new CrmLeadSignalProvider();
