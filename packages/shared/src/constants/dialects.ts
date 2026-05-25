export const DIALECTS = ['msa', 'gulf', 'levantine', 'egyptian'] as const;
export type Dialect = (typeof DIALECTS)[number];

/** Dialect chosen when a keyword should be matched against responses in any dialect. */
export const DIALECT_AUTO = 'auto' as const;

export const KEYWORD_DIALECTS = [...DIALECTS, DIALECT_AUTO] as const;
export type KeywordDialect = (typeof KEYWORD_DIALECTS)[number];

export const DIALECT_DISPLAY: Readonly<Record<Dialect, { ar: string; en: string }>> = {
  msa: { ar: 'الفصحى', en: 'Modern Standard Arabic' },
  gulf: { ar: 'الخليجي', en: 'Gulf' },
  levantine: { ar: 'الشامي', en: 'Levantine' },
  egyptian: { ar: 'المصري', en: 'Egyptian' },
};

export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
