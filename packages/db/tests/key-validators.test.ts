import { describe, expect, it, vi } from 'vitest';

import {
  validateGeminiKey,
  validateOpenAIKey,
  validatePerplexityKey,
  validateKey,
} from '../src/services/key-validators.js';

function mockFetch(status: number) {
  return vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
}

function mockFetchError(name: string) {
  return vi.fn(async () => {
    const err = new Error('boom');
    err.name = name;
    throw err;
  }) as unknown as typeof fetch;
}

describe('key validators', () => {
  it('returns ok on 200 for OpenAI', async () => {
    const result = await validateOpenAIKey('sk-test', { fetchImpl: mockFetch(200) });
    expect(result).toMatchObject({ valid: true, reason: 'ok', status: 200 });
  });

  it('flags 401 as unauthorized for OpenAI', async () => {
    const result = await validateOpenAIKey('bad', { fetchImpl: mockFetch(401) });
    expect(result).toEqual({ valid: false, reason: 'unauthorized', status: 401 });
  });

  it('flags 429 as rate_limited (still invalid for this run)', async () => {
    const result = await validateOpenAIKey('sk-test', { fetchImpl: mockFetch(429) });
    expect(result.reason).toBe('rate_limited');
    expect(result.valid).toBe(false);
  });

  it('maps Gemini 400 → unauthorized (INVALID_ARGUMENT)', async () => {
    const result = await validateGeminiKey('bad', { fetchImpl: mockFetch(400) });
    expect(result).toEqual({ valid: false, reason: 'unauthorized', status: 400 });
  });

  it('accepts Gemini 200', async () => {
    const result = await validateGeminiKey('good', { fetchImpl: mockFetch(200) });
    expect(result.valid).toBe(true);
  });

  it('reports network errors as network_error', async () => {
    const result = await validatePerplexityKey('x', {
      fetchImpl: mockFetchError('TypeError'),
    });
    expect(result).toEqual({ valid: false, reason: 'network_error' });
  });

  it('reports aborts as timeout', async () => {
    const result = await validatePerplexityKey('x', {
      fetchImpl: mockFetchError('AbortError'),
    });
    expect(result).toEqual({ valid: false, reason: 'timeout' });
  });

  it('routes through validateKey by provider name', async () => {
    const result = await validateKey('openai', 'sk-test', { fetchImpl: mockFetch(200) });
    expect(result.valid).toBe(true);
  });

  it('treats unexpected status as unexpected_status', async () => {
    const result = await validateOpenAIKey('sk-test', { fetchImpl: mockFetch(503) });
    expect(result).toEqual({ valid: false, reason: 'unexpected_status', status: 503 });
  });
});
