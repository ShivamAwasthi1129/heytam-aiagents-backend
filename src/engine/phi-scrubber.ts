/**
 * PHI Token Vault — Adapted from heytam-core (HIPAA-Compliant Tokenization)
 *
 * Intercepts text payload and scrubs PHI/PII via RegEx.
 * Instead of destroying data, generates secure ephemeral tokens (e.g. {{EMAIL_A9B2C3}})
 * stored in an in-memory Map with strict TTL.
 *
 * Once the LLM completes generation using tokens, call restore() to map them back.
 */
import crypto from 'crypto';

interface TokenVaultEntry {
  tokenMap: Record<string, string>;
  expiresAt: number;
}

// In-memory vault — no Redis dependency required for single-process deployments
const vaultStore = new Map<string, TokenVaultEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of vaultStore.entries()) {
    if (entry.expiresAt < now) {
      vaultStore.delete(key);
    }
  }
}, TTL_MS);

export class PhiTokenVault {
  /**
   * Scans text for PHI/PII, replaces it with secure tokens, and stores the mapping.
   * @param text The raw prompt containing PHI
   * @returns scrubbedText (safe for LLMs) and sessionId (to retrieve tokens later)
   */
  async scrubAndStore(text: string): Promise<{ scrubbedText: string; sessionId: string }> {
    let scrubbed = text;
    const sessionId = crypto.randomUUID();
    const tokenMap: Record<string, string> = {};

    const replaceAndStore = (regex: RegExp, prefix: string) => {
      scrubbed = scrubbed.replace(regex, (match) => {
        const token = `{{${prefix}_${crypto.randomBytes(4).toString('hex').toUpperCase()}}}`;
        tokenMap[token] = match;
        return token;
      });
    };

    // 1. Mask Social Security Numbers (SSN)
    replaceAndStore(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, 'SSN');

    // 2. Mask Email Addresses
    replaceAndStore(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'EMAIL');

    // 3. Mask Phone Numbers (Standard US & International)
    replaceAndStore(/\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g, 'PHONE');

    // 4. Mask Credit Card Numbers (basic)
    replaceAndStore(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, 'CC');

    // 5. Mask Date of Birth patterns (common US formats)
    replaceAndStore(/\b(0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](\d{4})\b/g, 'DOB');

    if (Object.keys(tokenMap).length > 0) {
      vaultStore.set(sessionId, { tokenMap, expiresAt: Date.now() + TTL_MS });
    }

    return { scrubbedText: scrubbed, sessionId };
  }

  /**
   * Maps tokens in LLM response back to original PHI.
   * @param responseText Text from LLM containing tokens
   * @param sessionId ID from scrubAndStore()
   * @returns Restored text with real data
   */
  async restore(responseText: string, sessionId: string): Promise<string> {
    const entry = vaultStore.get(sessionId);

    if (!entry || entry.expiresAt < Date.now()) {
      // No tokens or expired — return as-is
      return responseText;
    }

    let restored = responseText;
    for (const [token, originalValue] of Object.entries(entry.tokenMap)) {
      const tokenRegex = new RegExp(
        token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g'
      );
      restored = restored.replace(tokenRegex, originalValue);
    }

    return restored;
  }

  /**
   * Explicitly invalidate a session's tokens before TTL (call after action is executed).
   */
  invalidate(sessionId: string): void {
    vaultStore.delete(sessionId);
  }
}

// Singleton instance for use across the application
export const phiVault = new PhiTokenVault();
