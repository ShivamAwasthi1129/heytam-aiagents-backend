/**
 * Lead Concierge Agent — Heavy-Duty with Real-World Tools
 * Engages new leads, captures intent, and can immediately send SMS/Email/WhatsApp.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const leadConciergeAgentInfo = {
  id: 'lead-concierge',
  name: 'AI Lead Concierge',
  role: 'New Lead Response',
  description: 'Engages new leads from any channel within seconds, captures intent, and moves them toward the next step.',
  icon: '💬',
  category: 'Lead Generation',
  price: '$299/mo',
  tags: ['Lead Nurturing', 'Instant Response', 'Multi-Channel'],
  bestFor: 'Any service-based business',
};

export async function runLeadConciergeAgent(
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
      tools: tools as any,
      stopWhen: ({ stepCount }: any) => stepCount >= 6,
      system: `You are the AI Lead Concierge for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Engage new leads within seconds. Capture their intent and take REAL action.

CORE DIRECTIVES:
1. Analyze the incoming lead information and decide if you should send an immediate response via SMS, Email, or WhatsApp based on what contact info is available.
2. If a phone number is available and the lead came from a campaign → use sendSms.
3. If an email is available → use sendEmail.
4. If the lead came via WhatsApp → use sendWhatsApp.
5. ALWAYS save the lead to the database using saveLeadToDatabase.
6. Extract their name, phone, email, intended service/product, timeline.
7. NEVER invent contact details. Only use what is provided.

DELEGATION RULES:
- Once intent is clear, set requiresHandoff=true and route to 'lead-qualifier'.
- If they explicitly ask to book right now, route to 'booking-agent'.

MANDATORY: Your LAST action MUST be calling the finalizeResponse tool.`,
      prompt: `New lead data: ${input}\n\nEngage this lead now. Take real action using available tools, then finalize your response.`,
    });

    let structured;
    const allSteps = result.steps || [];
    for (const step of [...allSteps].reverse()) {
      const finalToolResult = (step.toolResults || []).find((t: any) => t.toolName === 'finalizeResponse');
      if (finalToolResult) { structured = (finalToolResult as any)?.output ?? (finalToolResult as any)?.result; break; }
    }
    if (!structured) {
      structured = { chainOfThought: 'No structured output.', messageToUser: result.text, capturedData: {}, requiresHandoff: false, targetAgent: 'none' };
    }

    return {
      agentName: leadConciergeAgentInfo.name,
      agentRole: leadConciergeAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: leadConciergeAgentInfo.name,
      agentRole: leadConciergeAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}
