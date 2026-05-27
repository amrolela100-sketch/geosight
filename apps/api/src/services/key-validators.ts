/**
 * Per-provider key validators. Each validator hits the cheapest live endpoint
 * the provider offers to confirm the key is accepted — never doing real
 * generation work, so the customer isn't billed for validation traffic.
 *
 * Result shape is uniform so the cron job and the settings UI can render
 * the same status independent of provider quirks.
 */

import type { VaultProvider } from '@geosight/shared/constants';

export interface ValidationResult {
  readonly valid: boolean;
  /** Coarse machine-readable reason for the UI/cron to branch on. */
  readonly reason:
    | 'ok'
    | 'unauthorized'
    | 'forbidden'
    | 'rate_limited'
    | 'network_error'
    | 'unexpected_status'
    | 'timeout';
  /** Optional human note — surfaced in audit metadata, not in API responses. */
  readonly detail?: string;
  /** Original HTTP status, when applicable. */
  readonly status?: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;

interface ProbeOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

async function probe(
  url: string,
  init: RequestInit,
  options: ProbeOptions,
): Promise<Response | { error: 'timeout' | 'network' }> {
  const fetcher = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { error: 'timeout' };
    return { error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function classify(status: number): ValidationResult {
  if (status >= 200 && status < 300) return { valid: true, reason: 'ok', status };
  if (status === 401) return { valid: false, reason: 'unauthorized', status };
  if (status === 403) return { valid: false, reason: 'forbidden', status };
  if (status === 429) return { valid: false, reason: 'rate_limited', status };
  return { valid: false, reason: 'unexpected_status', status };
}

export async function validateOpenAIKey(
  apiKey: string,
  options: ProbeOptions = {},
): Promise<ValidationResult> {
  const result = await probe(
    'https://api.openai.com/v1/models',
    { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
    options,
  );
  if ('error' in result) {
    return { valid: false, reason: result.error === 'timeout' ? 'timeout' : 'network_error' };
  }
  return classify(result.status);
}

export async function validateGeminiKey(
  apiKey: string,
  options: ProbeOptions = {},
): Promise<ValidationResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const result = await probe(url, { method: 'GET' }, options);
  if ('error' in result) {
    return { valid: false, reason: result.error === 'timeout' ? 'timeout' : 'network_error' };
  }
  if (result.status === 400) {
    // Gemini returns 400 with INVALID_ARGUMENT for malformed keys, not 401.
    return { valid: false, reason: 'unauthorized', status: 400 };
  }
  return classify(result.status);
}

export async function validatePerplexityKey(
  apiKey: string,
  options: ProbeOptions = {},
): Promise<ValidationResult> {
  // Perplexity has no free probe endpoint, so we issue a 1-token completion
  // against the cheapest model. Customer is billed for ~1 token of usage.
  const result = await probe(
    'https://api.perplexity.ai/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    },
    options,
  );
  if ('error' in result) {
    return { valid: false, reason: result.error === 'timeout' ? 'timeout' : 'network_error' };
  }
  return classify(result.status);
}

const validators: Record<
  VaultProvider,
  (key: string, options?: ProbeOptions) => Promise<ValidationResult>
> = {
  openai: validateOpenAIKey,
  gemini: validateGeminiKey,
  perplexity: validatePerplexityKey,
};

export function validateKey(
  provider: VaultProvider,
  apiKey: string,
  options: ProbeOptions = {},
): Promise<ValidationResult> {
  return validators[provider](apiKey, options);
}
