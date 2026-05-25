export const AI_PROVIDERS = ['chatgpt', 'gemini', 'perplexity'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const PROVIDER_DISPLAY: Readonly<Record<AiProvider, { name: string; logoSlug: string }>> = {
  chatgpt: { name: 'ChatGPT', logoSlug: 'openai' },
  gemini: { name: 'Gemini', logoSlug: 'gemini' },
  perplexity: { name: 'Perplexity', logoSlug: 'perplexity' },
};

/** Vault provider — the BYOK key vault is keyed by the underlying API provider, not the LLM brand. */
export const VAULT_PROVIDERS = ['openai', 'gemini', 'perplexity'] as const;
export type VaultProvider = (typeof VAULT_PROVIDERS)[number];

/** Maps the scan-side AiProvider to the BYOK-vault provider that supplies its key. */
export const PROVIDER_TO_VAULT: Readonly<Record<AiProvider, VaultProvider>> = {
  chatgpt: 'openai',
  gemini: 'gemini',
  perplexity: 'perplexity',
};
