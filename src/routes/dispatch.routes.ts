/**
 * Dispatch & Slave Agent Execution Routes
 *
 * HeyTam Decentralized Microservice Topology:
 * - Master Orchestrator: Hosted externally by heytam-core (Mastra AI Supervisor).
 * - Slave Agent Engine: Hosted here in heytam-agents-backend.
 *
 * REST Endpoints:
 * - POST /api/dispatch/execute                 → Direct execution compatible with heytam-core remote tools
 * - POST /api/slave/:agentId/execute           → Direct synchronous execution for any slave agent
 * - POST /api/dispatch/calling/execute         → Synchronous Calling Slave Pod execution
 * - POST /api/dispatch/mail/execute            → Synchronous Mail Slave Pod execution
 * - POST /api/dispatch/marketing/execute       → Synchronous Marketing Slave Pod execution
 * - POST /api/dispatch/calling                 → Asynchronous pipeline dispatch (frontend console)
 * - POST /api/dispatch/mail                    → Asynchronous pipeline dispatch (frontend console)
 * - POST /api/dispatch/marketing               → Asynchronous pipeline dispatch (frontend console)
 * - POST /api/dispatch/orchestrate             → Master Orchestrator forwarder / fallback
 * - GET  /api/dispatch/health                  → Topology & slave agent health status
 * - GET  /api/dispatch/backend                 → Dynamic AI model backend configuration
 * - PUT  /api/dispatch/backend                 → Switch AI backend at runtime
 */
import { Router, Request, Response } from 'express';
import { optionalAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { orchestrateWorkflow, suggestWorkflow } from '../engine/orchestrator.engine.js';
import { getModelConfig, getModelDescription, validateModelConfig } from '../engine/model-provider.js';
import { phiVault } from '../engine/phi-scrubber.js';
import { crmLeadSignalProvider, type CrmLead } from '../signals/crm-lead-signals.js';
import {
  agentRequestsTotal,
  agentRequestDuration,
  workflowExecutionsTotal,
  crmSignalsTotal,
} from '../metrics/prometheus.js';

// Import slave agent executors
import { runVoiceAgent } from '../agents/voiceAgent.js';
import { runFollowUpAgent } from '../agents/followUpAgent.js';
import { runCampaignAgent } from '../agents/campaignAgent.js';
import { runBookingAgent } from '../agents/bookingAgent.js';
import { runLeadQualifierAgent } from '../agents/leadQualifierAgent.js';
import { runNoShowPreventionAgent } from '../agents/noShowPreventionAgent.js';

const router = Router();

// ─── Direct Synchronous Slave Agent Execution Helper ──────────────────────────
// Formats responses to match what heytam-core's Mastra tools (delegateToCallingAgent, etc.) expect:
// { result: "string", ... }
async function executeSlaveDirectly(
  agentType: string,
  prompt: string,
  tenantContext: string = 'HeyTam Enterprise Client',
  tenantKeys: any = {}
) {
  const norm = agentType.toLowerCase().trim();

  if (norm.includes('calling') || norm.includes('voice')) {
    const res = await runVoiceAgent(prompt, tenantContext, tenantKeys);
    const text = typeof res.output === 'object'
      ? (res.output.messageToUser || res.output.chainOfThought)
      : String(res.output);
    return {
      result: text,
      output: res.output,
      agentName: 'Calling Agent (Voice)',
      agentId: 'outbound-calling-agent',
    };
  } else if (norm.includes('mail') || norm.includes('email') || norm.includes('follow-up')) {
    const res = await runFollowUpAgent(prompt, tenantContext, tenantKeys);
    const text = typeof res.output === 'object'
      ? (res.output.messageToUser || res.output.chainOfThought)
      : String(res.output);
    return {
      result: text,
      output: res.output,
      agentName: 'Corporate Mail Agent',
      agentId: 'follow-up-agent',
    };
  } else if (norm.includes('marketing') || norm.includes('campaign') || norm.includes('growth')) {
    const res = await runCampaignAgent(prompt, tenantContext, tenantKeys);
    const text = typeof res.output === 'object'
      ? (res.output.messageToUser || res.output.chainOfThought)
      : String(res.output);
    return {
      result: text,
      output: res.output,
      agentName: 'Marketing Optimization Agent',
      agentId: 'campaign-agent',
    };
  } else if (norm.includes('booking') || norm.includes('calendar') || norm.includes('reservation')) {
    const res = await runBookingAgent(prompt, tenantContext, tenantKeys);
    const text = typeof res.output === 'object'
      ? (res.output.messageToUser || res.output.chainOfThought)
      : String(res.output);
    return {
      result: text,
      output: res.output,
      agentName: 'AI Booking Agent',
      agentId: 'booking-agent',
    };
  } else if (norm.includes('qualif') || norm.includes('lead')) {
    const res = await runLeadQualifierAgent(prompt, tenantContext, tenantKeys);
    const text = typeof res.output === 'object'
      ? (res.output.messageToUser || res.output.chainOfThought)
      : String(res.output);
    return {
      result: text,
      output: res.output,
      agentName: 'Lead Qualifier Agent',
      agentId: 'lead-qualifier',
    };
  } else if (norm.includes('noshow') || norm.includes('no-show')) {
    const res = await runNoShowPreventionAgent(prompt, tenantContext, tenantKeys);
    const text = typeof res.output === 'object'
      ? (res.output.messageToUser || res.output.chainOfThought)
      : String(res.output);
    return {
      result: text,
      output: res.output,
      agentName: 'No-Show Prevention Agent',
      agentId: 'no-show-prevention-agent',
    };
  } else {
    const res = await runFollowUpAgent(prompt, tenantContext, tenantKeys);
    const text = typeof res.output === 'object'
      ? (res.output.messageToUser || res.output.chainOfThought)
      : String(res.output);
    return {
      result: text,
      output: res.output,
      agentName: `Slave Agent (${agentType})`,
      agentId: agentType,
    };
  }
}

// ─── Direct /execute Endpoint (for heytam-core remote tools) ───────────────────
// Compatible with CALLING_AGENT_URL, MAIL_AGENT_URL, MARKETING_AGENT_URL in heytam-core
async function handleSlaveExecute(req: Request, res: Response) {
  const agentParam = (req.params as any)?.agentId || (req.query as any)?.agent || (req.body as any)?.agent || 'calling';
  const { prompt, scrubPhi = true, tenantContext, tenantKeys } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required in request body' });
  }

  const startTime = Date.now();
  const timer = agentRequestDuration.labels({ agent_name: agentParam }).startTimer();

  try {
    let processedPrompt = prompt;
    let sessionId: string | undefined;

    if (scrubPhi) {
      const scrubResult = await phiVault.scrubAndStore(prompt);
      processedPrompt = scrubResult.scrubbedText;
      sessionId = scrubResult.sessionId;
    }

    const execution = await executeSlaveDirectly(agentParam, processedPrompt, tenantContext, tenantKeys);

    agentRequestsTotal.labels({ agent_name: execution.agentId, status: 'success' }).inc();

    // Exactly matches what heytam-core Mastra tools await: { result: "..." }
    res.status(200).json({
      result: execution.result,
      agent: execution.agentId,
      agentName: execution.agentName,
      status: 'success',
      executionTimeMs: Date.now() - startTime,
      phiScrubbed: scrubPhi,
      phiSessionId: sessionId,
      details: execution.output,
    });
  } catch (err: any) {
    agentRequestsTotal.labels({ agent_name: agentParam, status: 'error' }).inc();
    res.status(500).json({
      error: err?.message || 'Slave agent execution failed',
      agent: agentParam,
      status: 'error',
    });
  } finally {
    timer();
  }
}

// Direct slave endpoints matching heytam-core pod paths
router.post('/execute', optionalAuth, handleSlaveExecute);
router.post('/calling/execute', optionalAuth, (req: Request, res: Response) => {
  (req.params as any).agentId = 'calling';
  return handleSlaveExecute(req, res);
});
router.post('/mail/execute', optionalAuth, (req: Request, res: Response) => {
  (req.params as any).agentId = 'mail';
  return handleSlaveExecute(req, res);
});
router.post('/marketing/execute', optionalAuth, (req: Request, res: Response) => {
  (req.params as any).agentId = 'marketing';
  return handleSlaveExecute(req, res);
});
router.post('/slave/:agentId/execute', optionalAuth, handleSlaveExecute);
router.post('/:agentId/execute', optionalAuth, handleSlaveExecute);

// ─── Calling Agent Dispatcher (Asynchronous / UI Console) ─────────────────────
router.post('/calling', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { prompt, phoneNumber, leadId, businessId: bodyBusinessId, scrubPhi = true } = req.body;
  const businessId = bodyBusinessId || req.businessId || 'system';

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const timer = agentRequestDuration.labels({ agent_name: 'outbound-calling-agent' }).startTimer();

  try {
    let processedPrompt = prompt;
    if (scrubPhi) {
      const scrubResult = await phiVault.scrubAndStore(prompt);
      processedPrompt = scrubResult.scrubbedText;
    }

    const { runId } = await orchestrateWorkflow({
      workflowId: `dispatch-calling-${Date.now()}`,
      businessId,
      workflowName: 'Calling Agent Dispatch',
      trigger: 'API Dispatch',
      steps: [{ order: 1, agentId: 'outbound-calling-agent', agentName: 'Outbound Calling Agent' }],
      triggerData: {
        prompt: processedPrompt,
        phoneNumber,
        leadId,
        recipientPhone: phoneNumber,
      },
    });

    agentRequestsTotal.labels({ agent_name: 'outbound-calling-agent', status: 'success' }).inc();

    res.status(202).json({
      success: true,
      runId,
      agent: 'outbound-calling-agent',
      message: 'Calling agent task dispatched. Poll /api/workflows/:businessId/run/:runId for updates.',
      phiScrubbed: scrubPhi,
    });
  } catch (err: any) {
    agentRequestsTotal.labels({ agent_name: 'outbound-calling-agent', status: 'error' }).inc();
    res.status(500).json({ error: err?.message || 'Calling agent dispatch failed' });
  } finally {
    timer();
  }
});

// ─── Mail Agent Dispatcher (Asynchronous / UI Console) ────────────────────────
router.post('/mail', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { prompt, recipientEmail, subject, body, businessId: bodyBusinessId, scrubPhi = true } = req.body;
  const businessId = bodyBusinessId || req.businessId || 'system';

  if (!prompt && !recipientEmail) return res.status(400).json({ error: 'prompt or recipientEmail is required' });

  const effectivePrompt = prompt || `Send an email to ${recipientEmail}: ${body || subject}`;
  const timer = agentRequestDuration.labels({ agent_name: 'follow-up-agent' }).startTimer();

  try {
    let processedPrompt = effectivePrompt;
    if (scrubPhi) {
      const scrubResult = await phiVault.scrubAndStore(effectivePrompt);
      processedPrompt = scrubResult.scrubbedText;
    }

    const { runId } = await orchestrateWorkflow({
      workflowId: `dispatch-mail-${Date.now()}`,
      businessId,
      workflowName: 'Mail Agent Dispatch',
      trigger: 'API Dispatch',
      steps: [{ order: 1, agentId: 'follow-up-agent', agentName: 'Corporate Mail Agent' }],
      triggerData: {
        prompt: processedPrompt,
        recipientEmail,
        subject,
        message: body || prompt,
      },
    });

    agentRequestsTotal.labels({ agent_name: 'follow-up-agent', status: 'success' }).inc();

    res.status(202).json({
      success: true,
      runId,
      agent: 'follow-up-agent',
      message: 'Mail agent task dispatched.',
      phiScrubbed: scrubPhi,
    });
  } catch (err: any) {
    agentRequestsTotal.labels({ agent_name: 'follow-up-agent', status: 'error' }).inc();
    res.status(500).json({ error: err?.message || 'Mail agent dispatch failed' });
  } finally {
    timer();
  }
});

// ─── Marketing Agent Dispatcher (Asynchronous / UI Console) ───────────────────
router.post('/marketing', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { prompt, campaignId, metrics, businessId: bodyBusinessId } = req.body;
  const businessId = bodyBusinessId || req.businessId || 'system';

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const timer = agentRequestDuration.labels({ agent_name: 'campaign-agent' }).startTimer();

  try {
    const { runId } = await orchestrateWorkflow({
      workflowId: `dispatch-marketing-${Date.now()}`,
      businessId,
      workflowName: 'Marketing Agent Dispatch',
      trigger: 'API Dispatch',
      steps: [{ order: 1, agentId: 'campaign-agent', agentName: 'Marketing Optimization Agent' }],
      triggerData: { prompt, campaignId, metrics },
    });

    agentRequestsTotal.labels({ agent_name: 'campaign-agent', status: 'success' }).inc();

    res.status(202).json({
      success: true,
      runId,
      agent: 'campaign-agent',
      message: 'Marketing agent task dispatched.',
    });
  } catch (err: any) {
    agentRequestsTotal.labels({ agent_name: 'campaign-agent', status: 'error' }).inc();
    res.status(500).json({ error: err?.message || 'Marketing agent dispatch failed' });
  } finally {
    timer();
  }
});

// ─── Master Orchestrator Route ────────────────────────────────────────────────
// The HeyTam Master Orchestrator is hosted externally by heytam-core.
// This route forwards to heytam-core if reachable, or provides an internal slave fallback.
router.post('/orchestrate', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { prompt, businessId: bodyBusinessId, triggerData, scrubPhi = true } = req.body;
  const businessId = bodyBusinessId || req.businessId || 'system';

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const heytamCoreUrl = process.env.HEYTAM_CORE_URL || 'http://localhost:3000';

  // 1. If heytam-core is reachable, attempt delegation
  if (process.env.FORWARD_TO_HEYTAM_CORE === 'true') {
    try {
      const response = await fetch(`${heytamCoreUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (response.ok) {
        const coreResult = await response.json();
        return res.json({
          success: true,
          orchestrator: {
            name: 'heytam-core',
            status: 'external',
            mode: 'forwarded',
            url: heytamCoreUrl,
          },
          result: coreResult.result || coreResult,
          message: 'Delegated to external HeyTam Master Orchestrator (heytam-core).',
        });
      }
    } catch {
      // Fallback to local slave decomposition
    }
  }

  // 2. Fallback: Internal multi-agent decomposition
  try {
    let processedPrompt = prompt;
    if (scrubPhi) {
      const scrubResult = await phiVault.scrubAndStore(prompt);
      processedPrompt = scrubResult.scrubbedText;
    }

    const suggestion = suggestWorkflow(processedPrompt);

    const mergedTriggerData = {
      ...(suggestion.extractedTriggerData || {}),
      ...(triggerData || {}),
      originalPrompt: processedPrompt,
    };

    const { runId } = await orchestrateWorkflow({
      workflowId: `heytam-orchestrate-${Date.now()}`,
      businessId,
      workflowName: suggestion.name,
      trigger: suggestion.trigger,
      steps: suggestion.steps,
      triggerData: mergedTriggerData,
    });

    workflowExecutionsTotal.labels({ workflow_name: suggestion.name, status: 'started' }).inc();

    res.status(202).json({
      success: true,
      runId,
      orchestrator: {
        name: 'heytam-core',
        status: 'external',
        mode: 'slave-worker-fallback',
        url: heytamCoreUrl,
        note: 'Orchestrator hosted in heytam-core repository. Executed via local slave workforce pipeline.',
      },
      suggestion: {
        name: suggestion.name,
        description: suggestion.description,
        explanation: suggestion.explanation,
        steps: suggestion.steps,
      },
      message: 'Workflow dispatched to HeyTam slave agents.',
      phiScrubbed: scrubPhi,
    });
  } catch (err: any) {
    workflowExecutionsTotal.labels({ workflow_name: 'unknown', status: 'error' }).inc();
    res.status(500).json({ error: err?.message || 'Orchestration failed' });
  }
});

// ─── CRM Lead Signal Webhook ──────────────────────────────────────────────────
router.post('/signals/crm-lead', async (req: Request, res: Response) => {
  const { id, status, name, email, phone, source, notes, businessId } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: 'id and status are required' });
  }

  try {
    const result = await crmLeadSignalProvider.handleIncomingCrmWebhook({
      id,
      status,
      name,
      email,
      phone,
      source,
      notes,
      businessId,
    });

    if (!result.accepted) {
      return res.status(422).json({ error: 'Signal not accepted — unknown status or format' });
    }

    crmSignalsTotal.labels({ signal_type: result.signal?.kind || 'unknown', status: 'accepted' }).inc();

    res.json({
      success: true,
      accepted: true,
      signal: result.signal,
      message: 'CRM lead signal accepted and routed to slave agent workforce.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Signal processing failed' });
  }
});

// ─── System Health & Decentralized Topology ───────────────────────────────────
router.get('/health', async (req: Request, res: Response) => {
  const modelConfig = getModelConfig();
  const modelValidation = validateModelConfig();

  const agentPods = [
    {
      name: 'HeyTam Orchestrator (heytam-core)',
      port: process.env.HEYTAM_CORE_PORT ? Number(process.env.HEYTAM_CORE_PORT) : 3000,
      path: '/health',
      status: 'external',
      role: 'supervisor',
      managedBy: 'heytam-core (Mastra AI Supervisor)',
      url: process.env.HEYTAM_CORE_URL || 'http://localhost:3000',
    },
    {
      name: 'Calling Agent Slave Pod',
      port: 4000,
      path: '/api/dispatch/calling/execute',
      status: 'running',
      role: 'telephony',
    },
    {
      name: 'Mail Agent Slave Pod',
      port: 4000,
      path: '/api/dispatch/mail/execute',
      status: 'running',
      role: 'communication',
    },
    {
      name: 'Marketing Agent Slave Pod',
      port: 4000,
      path: '/api/dispatch/marketing/execute',
      status: 'running',
      role: 'campaigns',
    },
    {
      name: 'Sales & Ops Slave Pods (30 agents)',
      port: 4000,
      path: '/api/slave/:agentId/execute',
      status: 'running',
      role: 'operations',
    },
  ];

  res.json({
    status: 'ok',
    service: 'heytam-agents-backend',
    role: 'slave-agents-workforce-engine',
    version: '2.3.0',
    timestamp: new Date().toISOString(),
    architecture: 'pod-per-slave-agent',
    description: 'Slave Agent Workforce Engine providing telephony, communications, marketing, and 30 domain operations agents to HeyTam Master Orchestrator (heytam-core).',
    orchestrator: {
      status: 'external',
      name: 'heytam-core',
      url: process.env.HEYTAM_CORE_URL || 'http://localhost:3000',
      description: 'Master Orchestrator supervisor running in a separate pod with Mastra AI and scheduled crons.',
    },
    aiBackend: {
      backend: modelConfig.backend,
      model: modelConfig.model,
      description: getModelDescription(),
      configured: modelValidation.valid,
      configError: modelValidation.error,
    },
    agentPods,
    schedulerStatus: process.env.ENABLE_STANDALONE_SCHEDULER === 'true' ? 'running' : 'delegated-to-heytam-core',
    crmSignalProviderStatus: 'active',
  });
});

// ─── AI Backend Configuration ─────────────────────────────────────────────────
router.get('/backend', async (req: Request, res: Response) => {
  const config = getModelConfig();
  const validation = validateModelConfig();

  res.json({
    success: true,
    backend: config.backend,
    model: config.model,
    description: getModelDescription(),
    configured: validation.valid,
    configError: validation.error,
    availableBackends: [
      { id: 'OPENAI', name: 'OpenAI', description: 'OpenAI GPT-4o models', envVar: 'OPENAI_API_KEY' },
      { id: 'ANTHROPIC', name: 'Anthropic Claude', description: 'Claude 3.5 Sonnet', envVar: 'ANTHROPIC_API_KEY' },
      { id: 'COPILOT', name: 'GitHub Copilot', description: 'GPT-4o via GitHub Copilot Azure endpoint', envVar: 'GITHUB_PAT' },
    ],
  });
});

router.put('/backend', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { backend } = req.body;
  const validBackends = ['OPENAI', 'ANTHROPIC', 'COPILOT'];

  if (!backend || !validBackends.includes(backend.toUpperCase())) {
    return res.status(400).json({
      error: `Invalid backend. Must be one of: ${validBackends.join(', ')}`,
    });
  }

  process.env.AI_BACKEND = backend.toUpperCase();

  const newConfig = getModelConfig();
  const validation = validateModelConfig();

  res.json({
    success: true,
    message: `AI backend switched to ${backend.toUpperCase()}`,
    newConfig: {
      backend: newConfig.backend,
      model: newConfig.model,
      description: getModelDescription(),
      configured: validation.valid,
      configError: validation.error,
    },
  });
});

export default router;
