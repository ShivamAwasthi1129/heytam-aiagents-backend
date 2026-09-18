/**
 * AI No-Show Prevention Agent — Heavy-Duty with Real-World Tools
 * Send intelligent appointment reminders and confirm attendance to reduce no-shows.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const noShowPreventionAgentInfo = {
  id: 'no-show-prevention-agent',
  name: 'AI No-Show Prevention Agent',
  role: 'Appointment Attendance',
  description: 'Send intelligent appointment reminders and confirm attendance to reduce no-shows.',
};

export async function runNoShowPreventionAgent(
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
      system: `You are the ${noShowPreventionAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Send intelligent appointment reminders and confirm attendance to reduce no-shows.

TOOL USAGE GUIDANCE:
- Use listUpcomingAppointments to identify appointments needing reminders.
- Use sendSms or sendEmail to send reminders.
- Use addLeadNote to log the reminder action.

DELEGATION RULES:
- If a client replies to cancel, route to 'cancellation-recovery-agent'.

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
      agentName: noShowPreventionAgentInfo.name,
      agentRole: noShowPreventionAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: noShowPreventionAgentInfo.name,
      agentRole: noShowPreventionAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

