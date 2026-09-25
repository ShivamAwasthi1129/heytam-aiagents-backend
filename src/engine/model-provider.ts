/**
 * Dynamic Model Provider — Adapted from heytam-core
 * Returns the AI model string/config based on AI_BACKEND environment variable.
 * Supports: OPENAI (default), ANTHROPIC, COPILOT (GitHub Copilot via Azure OpenAI)
 */

export type AiBackend = 'OPENAI' | 'ANTHROPIC' | 'COPILOT';

export interface ModelConfig {
  backend: AiBackend;
  model: string;
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

/**
 * Returns model configuration based on AI_BACKEND env var.
 * Used by the orchestrator and agent executor for LLM calls.
 */
export function getModelConfig(): ModelConfig {
  const backend = (process.env.AI_BACKEND?.toUpperCase() || 'OPENAI') as AiBackend;

  switch (backend) {
    case 'ANTHROPIC':
      return {
        backend: 'ANTHROPIC',
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620',
        apiKey: process.env.ANTHROPIC_API_KEY,
      };

    case 'COPILOT':
      // GitHub Copilot via Azure OpenAI endpoint — preserves full tool-calling support
      return {
        backend: 'COPILOT',
        model: process.env.COPILOT_MODEL || 'gpt-4o',
        baseURL: process.env.COPILOT_API_BASE_URL || 'https://api.githubcopilot.com',
        apiKey: process.env.GITHUB_PAT,
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PAT || ''}`,
          'Editor-Version': 'vscode/1.84.0',
          'Copilot-Integration-Id': 'vscode-chat',
        },
      };

    case 'OPENAI':
    default:
      return {
        backend: 'OPENAI',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY,
      };
  }
}

/**
 * Returns a human-readable description of the current AI backend config.
 */
export function getModelDescription(): string {
  const cfg = getModelConfig();
  switch (cfg.backend) {
    case 'ANTHROPIC': return `Anthropic Claude (${cfg.model})`;
    case 'COPILOT': return `GitHub Copilot — ${cfg.model} via Azure OpenAI`;
    case 'OPENAI': return `OpenAI ${cfg.model}`;
  }
}

/**
 * Validates that the required API key for the selected backend is present.
 */
export function validateModelConfig(): { valid: boolean; error?: string } {
  const cfg = getModelConfig();
  switch (cfg.backend) {
    case 'ANTHROPIC':
      if (!cfg.apiKey) return { valid: false, error: 'ANTHROPIC_API_KEY is required when AI_BACKEND=ANTHROPIC' };
      break;
    case 'COPILOT':
      if (!cfg.apiKey) return { valid: false, error: 'GITHUB_PAT is required when AI_BACKEND=COPILOT' };
      break;
    case 'OPENAI':
      if (!cfg.apiKey) return { valid: false, error: 'OPENAI_API_KEY is required when AI_BACKEND=OPENAI' };
      break;
  }
  return { valid: true };
}
