/**
 * AI Patient Concierge — Heavy-Duty with Real-World Tools
 * Handle client questions, appointment details, preparation instructions, and admin requests.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const patientConciergeAgentInfo = {
  id: 'patient-concierge',
  name: 'AI Patient Concierge',
  role: 'Client Experience',
  description: 'Handle client questions, appointment details, preparation instructions, and admin requests.',
};

export async function runPatientConciergeAgent(
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
      system: `You are the ${patientConciergeAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Handle client questions, appointment details, preparation instructions, and admin requests.

TOOL USAGE GUIDANCE:
- Use queryDatabase to look up the client's appointment details.
- Use listUpcomingAppointments to verify scheduling.
- Use sendEmail to send detailed pre-appointment instructions.

DELEGATION RULES:
- If they want to change appointment, route to 'booking-agent'.
- If they have a complaint, route to 'review-agent'.

MANDATORY: Your LAST action MUST be calling the finalizeResponse tool with a complete structured output.`,
      prompt: `Input / context: ${input}\n\nAnalyze and take real action using available tools, then finalize your response.`,
    });

    // Extract finalizeResponse result from the last step in AI SDK v7
    let structured;
    const allSteps = result.steps || [];
    for (const step of allSteps.reverse()) {
      const finalToolResult = (step.toolResults || []).find((t: any) => t.toolName === 'finalizeResponse');
      if (finalToolResult) { structured = (finalToolResult as any)?.output ?? (finalToolResult as any)?.result; break; }
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
      agentName: patientConciergeAgentInfo.name,
      agentRole: patientConciergeAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: patientConciergeAgentInfo.name,
      agentRole: patientConciergeAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

