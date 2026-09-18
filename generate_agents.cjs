const fs = require('fs');
const path = require('path');

const agents = [
  {
    file: 'leadQualifierAgent.ts', id: 'lead-qualifier', name: 'AI Lead Qualifier', role: 'Budget & Intent Scoring',
    objective: 'Evaluate leads for service fit, budget viability, and urgency without being pushy.',
    toolGuidance: `- Use readGoogleSheet or queryDatabase to look up any existing data on this lead before responding.
- After qualifying, use saveLeadToDatabase to update their qualification status.
- If fully qualified, send a brief SMS or email confirming the next step.`,
    delegation: `- Once budget, fit, and timeline are confirmed, route to 'booking-agent'.
- If unqualified, route to 'none' and note the reason in capturedData.`
  },
  {
    file: 'voiceAgent.ts', id: 'voice-agent', name: 'AI Voice Agent', role: 'Outbound Calling',
    objective: 'Call leads, discuss their inquiries, capture intent, and move qualified prospects toward booking.',
    toolGuidance: `- Use makeVoiceCall to initiate outbound calls to the lead.
- Before calling, use queryDatabase to check existing contact history.
- After the call, use addLeadNote to log the outcome.`,
    delegation: `- If the call results in a booking intent, route to 'booking-agent'.
- If no answer, route to 'follow-up-agent' for multi-touch follow-up.`
  },
  {
    file: 'receptionistAgent.ts', id: 'receptionist-agent', name: 'AI Receptionist', role: 'Inbound Call Handling',
    objective: 'Handle incoming call transcriptions: answer FAQs, identify caller intent, and route appropriately.',
    toolGuidance: `- Use queryDatabase to look up the caller by phone number before responding.
- Use addLeadNote to record the interaction summary.
- If the caller wants to book, use checkCalendarAvailability before confirming.`,
    delegation: `- Route booking requests to 'booking-agent'.
- Route complaints to 'review-agent'.`
  },
  {
    file: 'smsConciergeAgent.ts', id: 'sms-concierge', name: 'AI SMS Concierge', role: 'Text Conversations',
    objective: 'Handle two-way SMS conversations for inquiries, follow-ups, and appointment booking.',
    toolGuidance: `- Use sendSms to reply to the lead via SMS.
- Use saveLeadToDatabase to capture their data.
- Keep SMS replies under 160 characters when possible.`,
    delegation: `- Route to 'booking-agent' when appointment intent is clear.
- Route to 'review-agent' if dissatisfied.`
  },
  {
    file: 'whatsappConciergeAgent.ts', id: 'whatsapp-concierge', name: 'AI WhatsApp Concierge', role: 'WhatsApp Engagement',
    objective: 'Conduct personalized WhatsApp conversations and guide prospects toward appointments.',
    toolGuidance: `- Use sendWhatsApp for all replies.
- Use saveLeadToDatabase to store captured data.
- WhatsApp allows longer messages — be warm and conversational.`,
    delegation: `- Route to 'booking-agent' when ready to schedule.`
  },
  {
    file: 'webConciergeAgent.ts', id: 'web-concierge', name: 'AI Web Concierge', role: 'Website Conversion',
    objective: 'Answer website visitor questions, capture leads, recommend services, and guide toward booking.',
    toolGuidance: `- Use saveLeadToDatabase to capture any contact info shared.
- Use writeToGoogleSheet to log new website leads.`,
    delegation: `- Route to 'lead-qualifier' once basic intent is captured.`
  },
  {
    file: 'treatmentAdvisorAgent.ts', id: 'treatment-advisor', name: 'AI Treatment Advisor', role: 'Service Discovery',
    objective: 'Help prospects understand available services/treatments based on their goals and concerns.',
    toolGuidance: `- Use readGoogleSheet to pull the business's service menu if available.
- Use saveLeadToDatabase to record their stated interests.`,
    delegation: `- Route to 'lead-qualifier' once they've expressed a service preference.
- Route to 'booking-agent' if they want to book immediately.`
  },
  {
    file: 'noShowPreventionAgent.ts', id: 'no-show-prevention-agent', name: 'AI No-Show Prevention Agent', role: 'Appointment Attendance',
    objective: 'Send intelligent appointment reminders and confirm attendance to reduce no-shows.',
    toolGuidance: `- Use listUpcomingAppointments to identify appointments needing reminders.
- Use sendSms or sendEmail to send reminders.
- Use addLeadNote to log the reminder action.`,
    delegation: `- If a client replies to cancel, route to 'cancellation-recovery-agent'.`
  },
  {
    file: 'cancellationRecoveryAgent.ts', id: 'cancellation-recovery-agent', name: 'AI Cancellation Recovery Agent', role: 'Recover Cancellations',
    objective: 'Engage clients who cancel and find them another suitable appointment slot.',
    toolGuidance: `- Use cancelAppointment to remove the existing booking if confirmed.
- Use checkCalendarAvailability to find alternative slots.
- Use sendSms or sendEmail to propose alternatives.`,
    delegation: `- If the client agrees to rebook, route to 'booking-agent'.
- If they want a refund/complaint, route to 'review-agent'.`
  },
  {
    file: 'waitlistAgent.ts', id: 'waitlist-agent', name: 'AI Waitlist Agent', role: 'Fill Empty Slots',
    objective: 'Identify waitlisted users and contact them when earlier/new appointment slots open up.',
    toolGuidance: `- Use queryDatabase to find leads tagged as "waitlist".
- Use checkCalendarAvailability to confirm new openings.
- Use sendSms to proactively notify waitlisted clients.`,
    delegation: `- Route to 'booking-agent' once the client confirms interest in the new slot.`
  },
  {
    file: 'reactivationAgent.ts', id: 'reactivation-agent', name: 'AI Reactivation Agent', role: 'Database Reactivation',
    objective: 'Find dormant leads/customers who haven\'t engaged in 30+ days and restart the conversation.',
    toolGuidance: `- Use queryDatabase or readGoogleSheet to identify dormant contacts.
- Use sendEmail or sendSms with a fresh, value-driven message.
- Track who was contacted via addLeadNote.`,
    delegation: `- If they respond with interest, route to 'lead-qualifier'.`
  },
  {
    file: 'membershipAgent.ts', id: 'membership-agent', name: 'AI Membership Agent', role: 'Membership Growth',
    objective: 'Introduce eligible clients to membership/loyalty programs and explain the benefits.',
    toolGuidance: `- Use queryDatabase to identify eligible clients (e.g. 3+ visits, high spend).
- Use sendEmail with a personalized membership offer.
- Use writeToGoogleSheet to log membership interest.`,
    delegation: `- If interested, route to 'booking-agent' to schedule enrollment consultation.`
  },
  {
    file: 'upsellAgent.ts', id: 'upsell-agent', name: 'AI Upsell Agent', role: 'Additional Services',
    objective: 'Identify opportunities to recommend complementary services or upgrades to existing clients.',
    toolGuidance: `- Use queryDatabase to check the client's history and past purchases.
- Use sendEmail or sendSms with a targeted, personalized offer.
- Use addLeadNote to track the upsell attempt.`,
    delegation: `- If interested in additional service, route to 'booking-agent'.`
  },
  {
    file: 'rebookingAgent.ts', id: 'rebooking-agent', name: 'AI Rebooking Agent', role: 'Repeat Visits',
    objective: 'Identify clients approaching their normal return interval and encourage rebooking.',
    toolGuidance: `- Use queryDatabase to find clients whose last visit was 30-90 days ago.
- Use sendSms or sendEmail with a personalized rebooking prompt.
- Use addLeadNote to log the rebooking outreach.`,
    delegation: `- Route to 'booking-agent' once they confirm interest.`
  },
  {
    file: 'patientConciergeAgent.ts', id: 'patient-concierge', name: 'AI Patient Concierge', role: 'Client Experience',
    objective: 'Handle client questions, appointment details, preparation instructions, and admin requests.',
    toolGuidance: `- Use queryDatabase to look up the client's appointment details.
- Use listUpcomingAppointments to verify scheduling.
- Use sendEmail to send detailed pre-appointment instructions.`,
    delegation: `- If they want to change appointment, route to 'booking-agent'.
- If they have a complaint, route to 'review-agent'.`
  },
  {
    file: 'postTreatmentAgent.ts', id: 'post-treatment-agent', name: 'AI Post-Treatment Agent', role: 'Aftercare Communication',
    objective: 'Send personalized post-service follow-ups and check on client satisfaction.',
    toolGuidance: `- Use queryDatabase to find clients whose appointments were earlier today.
- Use sendSms with a warm check-in message.
- Use addLeadNote to log the post-treatment outreach.`,
    delegation: `- If satisfied, route to 'review-agent' to request a review.
- If unsatisfied, route to 'review-agent' for service recovery.`
  },
  {
    file: 'referralAgent.ts', id: 'referral-agent', name: 'AI Referral Agent', role: 'Referral Programs',
    objective: 'Run referral campaigns and track referred prospects from existing satisfied clients.',
    toolGuidance: `- Use queryDatabase to find happy clients (those who left positive reviews or have 3+ visits).
- Use sendEmail or sendSms with a personalized referral ask.
- Use writeToGoogleSheet to log referral tracking data.`,
    delegation: `- If a referral comes in, route to 'lead-concierge'.`
  },
  {
    file: 'campaignAgent.ts', id: 'campaign-agent', name: 'AI Campaign Agent', role: 'Marketing Campaigns',
    objective: 'Execute coordinated multi-channel promotional campaigns based on client segments.',
    toolGuidance: `- Use readGoogleSheet to pull campaign segment lists.
- Use sendEmail and sendSms for bulk outreach to the segment.
- Use writeToGoogleSheet to log campaign send status.`,
    delegation: `- Interested respondents should be routed to 'lead-qualifier'.`
  },
  {
    file: 'leadRecoveryAgent.ts', id: 'lead-recovery-agent', name: 'AI Lead Recovery Agent', role: 'Lost Lead Recovery',
    objective: 'Identify leads who stopped responding and restart the conversation with a compelling new angle.',
    toolGuidance: `- Use queryDatabase to find leads with status "cold" or "unresponsive".
- Use sendSms or sendEmail with a value-driven recovery message (new offer, FAQ, or check-in).
- Use addLeadNote to log the recovery attempt.`,
    delegation: `- If they respond, route to 'lead-qualifier' or 'booking-agent' as appropriate.`
  },
  {
    file: 'frontDeskCopilotAgent.ts', id: 'front-desk-copilot', name: 'AI Front Desk Copilot', role: 'Staff Assistance',
    objective: 'Provide staff with quick context summaries, conversation history, and suggested next steps for any lead or client.',
    toolGuidance: `- Use queryDatabase to pull the full history of a lead or client.
- Use readGoogleSheet if data is stored there.
- Summarize findings clearly for staff use.`,
    delegation: `- This agent does not delegate to customer-facing agents.`
  },
  {
    file: 'crmAgent.ts', id: 'crm-agent', name: 'AI CRM Agent', role: 'CRM Automation',
    objective: 'Update pipeline stages, create follow-up tasks, record interaction outcomes, and maintain CRM hygiene.',
    toolGuidance: `- Use saveLeadToDatabase to update lead pipeline stage and status.
- Use addLeadNote to record interaction outcomes.
- Use updateGoogleSheetRow to sync data back to Google Sheets CRM.`,
    delegation: `- Does not typically initiate handoffs. Used as a supporting agent.`
  },
  {
    file: 'emrEhrIntegrationAgent.ts', id: 'emr-ehr-integration-agent', name: 'AI EMR/EHR Integration Agent', role: 'System Coordination',
    objective: 'Synchronize operational information between AI workflows and core EMR/EHR systems.',
    toolGuidance: `- Use queryDatabase to pull data before syncing.
- Use saveLeadToDatabase or writeToGoogleSheet to write back synchronized records.
- Never expose sensitive clinical data — only handle operationally permitted fields.`,
    delegation: `- Does not directly handle client conversations; used as a data-sync agent.`
  },
  {
    file: 'revenueRecoveryAgent.ts', id: 'revenue-recovery-agent', name: 'AI Revenue Recovery Agent', role: 'Revenue Opportunities',
    objective: 'Identify missed appointments, abandoned inquiries, and lapsed memberships to recover lost revenue.',
    toolGuidance: `- Use queryDatabase to find leads/clients with status "no-show", "abandoned", or "lapsed".
- Use sendSms or sendEmail with recovery offers.
- Use addLeadNote to track recovery efforts.`,
    delegation: `- If interested, route to 'booking-agent' for immediate scheduling.`
  },
  {
    file: 'growthAnalystAgent.ts', id: 'growth-analyst', name: 'AI Growth Analyst', role: 'Performance Intelligence',
    objective: 'Monitor business metrics, highlight conversion trends, and surface actionable growth opportunities.',
    toolGuidance: `- Use readGoogleSheet to pull metrics and lead data.
- Use queryDatabase to aggregate performance data.
- Provide concise, actionable insight summaries.`,
    delegation: `- Does not handle client conversations. Reports to staff/management.`
  },
  {
    file: 'integrationGuardianAgent.ts', id: 'integration-guardian', name: 'AI Integration Guardian', role: 'Integration Health',
    objective: 'Monitor API health, detect failures in connected systems, and initiate safe recovery protocols.',
    toolGuidance: `- Use readGoogleSheet and queryDatabase to check data freshness and identify sync failures.
- Report errors clearly so engineers can act.`,
    delegation: `- Does not handle client conversations. Alerts staff via sendEmail in case of critical failures.`
  },
];

const template = (a) => `/**
 * ${a.name} — Heavy-Duty with Real-World Tools
 * ${a.objective}
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const ${a.file.replace('.ts', 'Info')} = {
  id: '${a.id}',
  name: '${a.name}',
  role: '${a.role}',
  description: '${a.objective.replace(/'/g, "\\'")}',
};

export async function run${a.file.replace('.ts', '').charAt(0).toUpperCase() + a.file.replace('.ts', '').slice(1)}(
  input: string,
  tenantContext: string = 'Generic Business',
  tenantKeys: TenantKeys = {}
) {
  const timestamp = new Date().toISOString();
  const tools = createAgentTools(tenantKeys);
  const model = tenantKeys.openaiApiKey
    ? createOpenAI({ apiKey: tenantKeys.openaiApiKey })(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    : openai(process.env.OPENAI_MODEL || 'gpt-4o-mini');

  try {
    const result = await generateText({
      model,
      tools,
      maxSteps: 6,
      system: \`You are the \${${a.file.replace('.ts', 'Info')}.name} for the following business:
---
BUSINESS CONTEXT:
\${tenantContext}
---

YOUR SOLE OBJECTIVE: ${a.objective}

TOOL USAGE GUIDANCE:
${a.toolGuidance}

DELEGATION RULES:
${a.delegation}

MANDATORY: Your LAST action MUST be calling the finalizeResponse tool with a complete structured output.\`,
      prompt: \`Input / context: \${input}\\n\\nAnalyze and take real action using available tools, then finalize your response.\`,
    });

    // Extract finalizeResponse result from the last step in AI SDK v7
    let structured;
    const allSteps = result.steps || [];
    for (const step of allSteps.reverse()) {
      const finalToolResult = (step.toolResults || []).find((t: any) => t.toolName === 'finalizeResponse');
      if (finalToolResult) { structured = finalToolResult.result; break; }
    }
    if (!structured) {
      structured = {
        chainOfThought: 'No structured output produced.',
        messageToUser: result.text,
        capturedData: {},
        requiresHandoff: false,
        targetAgent: 'none',
      };
    }

    return {
      agentName: ${a.file.replace('.ts', 'Info')}.name,
      agentRole: ${a.file.replace('.ts', 'Info')}.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: ${a.file.replace('.ts', 'Info')}.name,
      agentRole: ${a.file.replace('.ts', 'Info')}.role,
      input,
      output: \`Error: \${error instanceof Error ? error.message : 'Unknown error'}\`,
      status: 'error' as const, timestamp,
    };
  }
}
`;

let created = 0, skipped = 0;
agents.forEach(a => {
  const filePath = path.join(__dirname, 'src', 'agents', a.file);
  fs.writeFileSync(filePath, template(a)); // Always overwrite
  console.log("Generated: " + a.file);
  created++;
});
console.log("\nDone! Generated " + created + " agents.");
