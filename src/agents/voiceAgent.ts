/**
 * AI Voice Agent — Heavy-Duty with Real-World Tools
 * Call leads, discuss their inquiries, capture intent, and move qualified prospects toward booking.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const voiceAgentInfo = {
  id: 'voice-agent',
  name: 'AI Voice Agent',
  role: 'Outbound Calling',
  description: 'Call leads, discuss their inquiries, capture intent, and move qualified prospects toward booking.',
};

export async function runVoiceAgent(
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
      system: `You are the ${voiceAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Call leads, discuss their inquiries, capture intent, and move qualified prospects toward booking.

TOOL USAGE GUIDANCE:
- Use makeVoiceCall to initiate outbound calls to the lead.
- Before calling, use queryDatabase to check existing contact history.
- After the call, use addLeadNote to log the outcome.

DELEGATION RULES:
- If the call results in a booking intent, route to 'booking-agent'.
- If no answer, route to 'follow-up-agent' for multi-touch follow-up.

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
      agentName: voiceAgentInfo.name,
      agentRole: voiceAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: voiceAgentInfo.name,
      agentRole: voiceAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

