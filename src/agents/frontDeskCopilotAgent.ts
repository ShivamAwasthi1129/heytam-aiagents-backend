/**
 * AI Front Desk Copilot — Heavy-Duty with Real-World Tools
 * Provide staff with quick context summaries, conversation history, and suggested next steps for any lead or client.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const frontDeskCopilotAgentInfo = {
  id: 'front-desk-copilot',
  name: 'AI Front Desk Copilot',
  role: 'Staff Assistance',
  description: 'Provide staff with quick context summaries, conversation history, and suggested next steps for any lead or client.',
};

export async function runFrontDeskCopilotAgent(
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
      system: `You are the ${frontDeskCopilotAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Provide staff with quick context summaries, conversation history, and suggested next steps for any lead or client.

TOOL USAGE GUIDANCE:
- Use queryDatabase to pull the full history of a lead or client.
- Use readGoogleSheet if data is stored there.
- Summarize findings clearly for staff use.

DELEGATION RULES:
- This agent does not delegate to customer-facing agents.

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
      agentName: frontDeskCopilotAgentInfo.name,
      agentRole: frontDeskCopilotAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: frontDeskCopilotAgentInfo.name,
      agentRole: frontDeskCopilotAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

