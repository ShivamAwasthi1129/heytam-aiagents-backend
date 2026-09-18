import { Router, Request, Response } from 'express';
import { runMasterOrchestrator } from '../agents/masterOrchestrator.js';
import { runBookingAgent } from '../agents/bookingAgent.js';
import { runCampaignAgent } from '../agents/campaignAgent.js';
import { runCancellationRecoveryAgent } from '../agents/cancellationRecoveryAgent.js';
import { runCrmAgent } from '../agents/crmAgent.js';
import { runEmrEhrIntegrationAgent } from '../agents/emrEhrIntegrationAgent.js';
import { runFollowUpAgent } from '../agents/followUpAgent.js';
import { runFrontDeskCopilotAgent } from '../agents/frontDeskCopilotAgent.js';
import { runGrowthAnalystAgent } from '../agents/growthAnalystAgent.js';
import { runIntegrationGuardianAgent } from '../agents/integrationGuardianAgent.js';
import { runLeadConciergeAgent } from '../agents/leadConciergeAgent.js';
import { runLeadQualifierAgent } from '../agents/leadQualifierAgent.js';
import { runLeadRecoveryAgent } from '../agents/leadRecoveryAgent.js';
import { runMembershipAgent } from '../agents/membershipAgent.js';
import { runNoShowPreventionAgent } from '../agents/noShowPreventionAgent.js';
import { runPatientConciergeAgent } from '../agents/patientConciergeAgent.js';
import { runPostTreatmentAgent } from '../agents/postTreatmentAgent.js';
import { runReactivationAgent } from '../agents/reactivationAgent.js';
import { runRebookingAgent } from '../agents/rebookingAgent.js';
import { runReceptionistAgent } from '../agents/receptionistAgent.js';
import { runReferralAgent } from '../agents/referralAgent.js';
import { runRevenueRecoveryAgent } from '../agents/revenueRecoveryAgent.js';
import { runReviewAgent } from '../agents/reviewAgent.js';
import { runSmsConciergeAgent } from '../agents/smsConciergeAgent.js';
import { runTreatmentAdvisorAgent } from '../agents/treatmentAdvisorAgent.js';
import { runUpsellAgent } from '../agents/upsellAgent.js';
import { runVoiceAgent } from '../agents/voiceAgent.js';
import { runWaitlistAgent } from '../agents/waitlistAgent.js';
import { runWebConciergeAgent } from '../agents/webConciergeAgent.js';
import { runWhatsappConciergeAgent } from '../agents/whatsappConciergeAgent.js';

import { ALL_AGENT_IDS } from '../tools/index.js';

const router = Router();

// Endpoint to get a list of all available agents
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    agents: ALL_AGENT_IDS
  });
});

// Generic endpoint to run a specific agent
router.post('/run/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { input, tenantContext, rawInput, tenantKeys = {} } = req.body;

  // The orchestrator takes rawInput, others take input
  const payload = agentId === 'master-orchestrator' ? (rawInput || input) : input;

  if (!payload) {
    return res.status(400).json({ error: 'Input (or rawInput) is required' });
  }

  try {
    let result;

    switch (agentId) {
      case 'master-orchestrator':
        result = await runMasterOrchestrator(rawInput || input, tenantContext, tenantKeys);
        break;
      case 'booking-agent':
        result = await runBookingAgent(input, tenantContext, tenantKeys);
        break;
      case 'campaign-agent':
        result = await runCampaignAgent(input, tenantContext, tenantKeys);
        break;
      case 'cancellation-recovery-agent':
        result = await runCancellationRecoveryAgent(input, tenantContext, tenantKeys);
        break;
      case 'crm-agent':
        result = await runCrmAgent(input, tenantContext, tenantKeys);
        break;
      case 'emr-ehr-integration-agent':
        result = await runEmrEhrIntegrationAgent(input, tenantContext, tenantKeys);
        break;
      case 'follow-up-agent':
        result = await runFollowUpAgent(input, tenantContext, tenantKeys);
        break;
      case 'front-desk-copilot':
        result = await runFrontDeskCopilotAgent(input, tenantContext, tenantKeys);
        break;
      case 'growth-analyst':
        result = await runGrowthAnalystAgent(input, tenantContext, tenantKeys);
        break;
      case 'integration-guardian':
        result = await runIntegrationGuardianAgent(input, tenantContext, tenantKeys);
        break;
      case 'lead-concierge':
        result = await runLeadConciergeAgent(input, tenantContext, tenantKeys);
        break;
      case 'lead-qualifier':
        result = await runLeadQualifierAgent(input, tenantContext, tenantKeys);
        break;
      case 'lead-recovery-agent':
        result = await runLeadRecoveryAgent(input, tenantContext, tenantKeys);
        break;
      case 'membership-agent':
        result = await runMembershipAgent(input, tenantContext, tenantKeys);
        break;
      case 'no-show-prevention-agent':
        result = await runNoShowPreventionAgent(input, tenantContext, tenantKeys);
        break;
      case 'patient-concierge':
        result = await runPatientConciergeAgent(input, tenantContext, tenantKeys);
        break;
      case 'post-treatment-agent':
        result = await runPostTreatmentAgent(input, tenantContext, tenantKeys);
        break;
      case 'reactivation-agent':
        result = await runReactivationAgent(input, tenantContext, tenantKeys);
        break;
      case 'rebooking-agent':
        result = await runRebookingAgent(input, tenantContext, tenantKeys);
        break;
      case 'receptionist-agent':
        result = await runReceptionistAgent(input, tenantContext, tenantKeys);
        break;
      case 'referral-agent':
        result = await runReferralAgent(input, tenantContext, tenantKeys);
        break;
      case 'revenue-recovery-agent':
        result = await runRevenueRecoveryAgent(input, tenantContext, tenantKeys);
        break;
      case 'review-agent':
        result = await runReviewAgent(input, tenantContext, tenantKeys);
        break;
      case 'sms-concierge':
        result = await runSmsConciergeAgent(input, tenantContext, tenantKeys);
        break;
      case 'treatment-advisor':
        result = await runTreatmentAdvisorAgent(input, tenantContext, tenantKeys);
        break;
      case 'upsell-agent':
        result = await runUpsellAgent(input, tenantContext, tenantKeys);
        break;
      case 'voice-agent':
        result = await runVoiceAgent(input, tenantContext, tenantKeys);
        break;
      case 'waitlist-agent':
        result = await runWaitlistAgent(input, tenantContext, tenantKeys);
        break;
      case 'web-concierge':
        result = await runWebConciergeAgent(input, tenantContext, tenantKeys);
        break;
      case 'whatsapp-concierge':
        result = await runWhatsappConciergeAgent(input, tenantContext, tenantKeys);
        break;

      default:
        return res.status(404).json({ error: `Agent ${agentId} not found or not implemented yet.` });
    }

    if (result.status === 'error') {
      return res.status(500).json({ error: (result as any).output || (result as any).routingDecision || (result as any).message || 'Agent error' });
    }

    res.json(result);
  } catch (error) {
    console.error(`Error running agent ${agentId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
