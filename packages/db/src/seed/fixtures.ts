/** Seed fixtures — three realistic Arabic-market organizations + their team
 * + the five canonical brands the Phase 0 scanner spike already exercises.
 *
 * The `clerk_*` IDs are *intentionally* prefixed `seed_` so the seeder can
 * idempotently delete prior seed rows before re-inserting.
 */

import type { AiProvider, Dialect, KeywordDialect, OrgRole } from '@geosight/shared/constants';

import type { NewBrand, NewKeyword, NewOrganization, NewUser } from '../schema/index.js';

export const SEED_PREFIX = 'seed_';

export type SeedOrg = NewOrganization & {
  /** Stable handle used by the seeder to link users + brands. */
  readonly handle: string;
};

export type SeedUser = Omit<NewUser, 'orgId'> & {
  readonly orgHandle: string;
};

export type SeedBrand = Omit<NewBrand, 'orgId'> & {
  readonly handle: string;
  readonly orgHandle: string;
};

export type SeedKeyword = Omit<NewKeyword, 'brandId'> & {
  readonly brandHandle: string;
};

export const seedOrgs: readonly SeedOrg[] = [
  {
    handle: 'noon',
    clerkOrgId: `${SEED_PREFIX}clerk_org_noon`,
    name: 'نون ميديا',
    slug: `${SEED_PREFIX}noon-media`,
    plan: 'agency',
    country: 'SA',
    billingEmail: 'billing@noonmedia.test',
  },
  {
    handle: 'tatweer',
    clerkOrgId: `${SEED_PREFIX}clerk_org_tatweer`,
    name: 'تطوير العربية',
    slug: `${SEED_PREFIX}tatweer-arabia`,
    plan: 'growth',
    country: 'AE',
    billingEmail: 'finance@tatweer.test',
  },
  {
    handle: 'layla',
    clerkOrgId: `${SEED_PREFIX}clerk_org_layla`,
    name: 'ليلى عمر — استشارات GEO',
    slug: `${SEED_PREFIX}layla-omar`,
    plan: 'starter',
    country: 'EG',
    billingEmail: 'layla@layla.test',
  },
];

export const seedUsers: readonly SeedUser[] = [
  // Noon Media (agency)
  {
    orgHandle: 'noon',
    clerkUserId: `${SEED_PREFIX}clerk_user_noor`,
    email: 'noor@noonmedia.test',
    fullName: 'نور القحطاني',
    role: 'owner' satisfies OrgRole,
    preferredDialect: 'gulf',
  },
  {
    orgHandle: 'noon',
    clerkUserId: `${SEED_PREFIX}clerk_user_ahmad`,
    email: 'ahmad@noonmedia.test',
    fullName: 'أحمد الزهراني',
    role: 'admin' satisfies OrgRole,
    preferredDialect: 'gulf',
  },
  {
    orgHandle: 'noon',
    clerkUserId: `${SEED_PREFIX}clerk_user_reema`,
    email: 'reema@noonmedia.test',
    fullName: 'ريما البلوي',
    role: 'viewer' satisfies OrgRole,
    preferredDialect: 'msa',
  },
  // Tatweer (growth)
  {
    orgHandle: 'tatweer',
    clerkUserId: `${SEED_PREFIX}clerk_user_sami`,
    email: 'sami@tatweer.test',
    fullName: 'سامي السويدي',
    role: 'owner' satisfies OrgRole,
    preferredDialect: 'msa',
  },
  {
    orgHandle: 'tatweer',
    clerkUserId: `${SEED_PREFIX}clerk_user_khaled`,
    email: 'khaled@tatweer.test',
    fullName: 'خالد المطوع',
    role: 'admin' satisfies OrgRole,
    preferredDialect: 'gulf',
  },
  // Layla (starter)
  {
    orgHandle: 'layla',
    clerkUserId: `${SEED_PREFIX}clerk_user_layla`,
    email: 'layla@layla.test',
    fullName: 'ليلى عمر',
    role: 'owner' satisfies OrgRole,
    preferredDialect: 'egyptian',
  },
];

export const seedBrands: readonly SeedBrand[] = [
  // Noon Media tracks two large advertisers as agency-of-record.
  {
    handle: 'saudia',
    orgHandle: 'noon',
    nameAr: 'الخطوط السعودية',
    nameEn: 'Saudia',
    aliasesAr: ['السعودية', 'الخطوط الجوية السعودية'],
    aliasesEn: ['saudi airlines', 'saudia airlines'],
    website: 'https://www.saudia.com',
    competitors: ['طيران الإمارات', 'القطرية', 'طيران الاتحاد', 'Emirates', 'Qatar Airways'],
    industry: 'aviation',
  },
  {
    handle: 'stc',
    orgHandle: 'noon',
    nameAr: 'إس تي سي',
    nameEn: 'STC',
    aliasesAr: ['الاتصالات السعودية', 'اس تي سي'],
    aliasesEn: ['stc', 'saudi telecom'],
    website: 'https://www.stc.com.sa',
    competitors: ['موبايلي', 'زين', 'Mobily', 'Zain'],
    industry: 'telecom',
  },
  // Tatweer tracks two of its own product lines.
  {
    handle: 'aramco',
    orgHandle: 'tatweer',
    nameAr: 'أرامكو',
    nameEn: 'Aramco',
    aliasesAr: ['أرامكو السعودية', 'ارامكو'],
    aliasesEn: ['saudi aramco'],
    website: 'https://www.aramco.com',
    competitors: ['أدنوك', 'قطر للطاقة', 'Shell', 'BP', 'ExxonMobil'],
    industry: 'energy',
  },
  {
    handle: 'talabat',
    orgHandle: 'tatweer',
    nameAr: 'طلبات',
    nameEn: 'Talabat',
    aliasesAr: ['تطبيق طلبات'],
    aliasesEn: ['talabat'],
    website: 'https://www.talabat.com',
    competitors: ['هنقرستيشن', 'جاهز', 'Jahez', 'HungerStation', 'Deliveroo'],
    industry: 'food-delivery',
  },
  // Layla (starter, plan caps brands at 1).
  {
    handle: 'careem',
    orgHandle: 'layla',
    nameAr: 'كريم',
    nameEn: 'Careem',
    aliasesAr: ['تطبيق كريم'],
    aliasesEn: ['careem'],
    website: 'https://www.careem.com',
    competitors: ['أوبر', 'Uber', 'بولت', 'Bolt', 'Jeeny'],
    industry: 'ride-hailing',
  },
];

/** 10 keywords per brand × 5 brands = 50 keywords. Dialects rotate so the
 * sample exercises every enum value the dashboard will filter by. */
export const seedKeywords: readonly SeedKeyword[] = [
  // SAUDIA — aviation, MSA + gulf-heavy
  ...keywordSet('saudia', [
    ['ما أفضل شركة طيران للسفر من الرياض إلى لندن؟', 'msa'],
    ['أفضل خطوط طيران بالشرق الأوسط', 'msa'],
    ['وش أحسن شركة طيران سعودية للسياحة؟', 'gulf'],
    ['أرخص تذاكر طيران من جدة للقاهرة', 'gulf'],
    ['شو أفضل شركة طيران بتطير من بيروت للرياض؟', 'levantine'],
    ['إيه أحسن طيران من القاهرة للسعودية؟', 'egyptian'],
    ['saudia vs emirates business class', 'auto'],
    ['برنامج الفرسان أحد أفضل برامج المسافر الدائم', 'msa'],
    ['تجربة سفر على الخطوط السعودية درجة الأعمال', 'msa'],
    ['Saudia airline ratings 2026', 'auto'],
  ]),
  // STC — telecom, gulf-heavy
  ...keywordSet('stc', [
    ['أفضل مزود اتصالات في السعودية', 'msa'],
    ['وش أحسن شركة جوال بالرياض؟', 'gulf'],
    ['مقارنة بين STC وموبايلي وزين', 'msa'],
    ['أفضل باقة 5G في السعودية', 'msa'],
    ['STC pay vs Apple Pay المملكة العربية السعودية', 'auto'],
    ['أحسن مزود انترنت منزلي بالخبر', 'gulf'],
    ['إيه أحسن شريحة موبايل للمصريين في السعودية؟', 'egyptian'],
    ['شو أحسن مزود اتصالات للسوريين بالسعودية؟', 'levantine'],
    ['STC business plans for SMEs', 'auto'],
    ['تجربة عملاء stc fiber', 'msa'],
  ]),
  // ARAMCO — energy, MSA dominant
  ...keywordSet('aramco', [
    ['ما أكبر شركة نفط في العالم العربي؟', 'msa'],
    ['أرامكو السعودية أرباح 2026', 'msa'],
    ['Aramco IPO valuation analysis', 'auto'],
    ['وش أكبر شركة بترول بالخليج؟', 'gulf'],
    ['شو أكبر شركة نفط بالشرق الأوسط؟', 'levantine'],
    ['إيه أكبر شركة بترول في المنطقة؟', 'egyptian'],
    ['أرامكو vs أدنوك من الأفضل للاستثمار', 'msa'],
    ['برنامج تطوير الموردين أرامكو', 'msa'],
    ['Aramco strategic upstream projects', 'auto'],
    ['ما هي مشاريع أرامكو في الهيدروجين الأخضر؟', 'msa'],
  ]),
  // TALABAT — food delivery
  ...keywordSet('talabat', [
    ['أفضل تطبيق توصيل طعام في الخليج', 'msa'],
    ['وش أحسن تطبيق توصيل أكل بجدة؟', 'gulf'],
    ['إيه أحسن تطبيق توصيل أكل في دبي؟', 'egyptian'],
    ['شو أفضل تطبيق توصيل أكل بالخليج؟', 'levantine'],
    ['عروض طلبات الجمعة البيضاء', 'msa'],
    ['talabat vs deliveroo UAE comparison', 'auto'],
    ['أرخص تطبيق توصيل أكل في الكويت', 'msa'],
    ['طلبات mart مقابل كارفور', 'msa'],
    ['Best food delivery app in Riyadh', 'auto'],
    ['تطبيق توصيل البقالة الأكثر استخداماً', 'msa'],
  ]),
  // CAREEM — ride-hailing
  ...keywordSet('careem', [
    ['أيهما أفضل: كريم أم أوبر؟', 'msa'],
    ['وش أحسن تطبيق توصيل بالرياض كريم لو أوبر؟', 'gulf'],
    ['إيه أحسن تطبيق توصيل عربيات في القاهرة؟', 'egyptian'],
    ['شو أحسن تطبيق توصيل سيارات بعمان؟', 'levantine'],
    ['Careem captain earnings UAE', 'auto'],
    ['كريم Plus subscription worth it?', 'auto'],
    ['أرخص توصيلة من مطار دبي', 'msa'],
    ['كريم Now ولا طلبات mart الأرخص؟', 'msa'],
    ['كريب كريم ضد uber x مقارنة', 'msa'],
    ['Best ride-hailing app in Egypt 2026', 'auto'],
  ]),
];

function keywordSet(
  brandHandle: string,
  rows: ReadonlyArray<readonly [text: string, dialect: KeywordDialect]>,
): SeedKeyword[] {
  return rows.map(([text, dialect], index) => ({
    brandHandle,
    queryText: text,
    language: /[؀-ۿ]/.test(text) ? 'ar' : 'en',
    dialect,
    schedule: index % 2 === 0 ? 'daily' : 'weekly',
    isActive: index < 8,
  }));
}

/** Realistic Arabic context snippets per (brand, provider, mentioned?).
 * Used to populate scan_results.contextSnippet with believable strings the
 * dashboard surfaces verbatim. */
export const seedSnippets: Readonly<
  Record<string, Readonly<Record<AiProvider, { positive: string; neutral: string; negative: string }>>>
> = {
  saudia: {
    chatgpt: {
      positive: 'تُعتبر الخطوط السعودية من أفضل شركات الطيران في الشرق الأوسط مع أسطول حديث.',
      neutral: 'الخطوط السعودية إحدى الشركات الرئيسية في المنطقة إلى جانب الإمارات والقطرية.',
      negative: 'تأخرت رحلات الخطوط السعودية بشكل متكرر خلال موسم العمرة الماضي.',
    },
    gemini: {
      positive: 'شبكة وجهات واسعة وبرنامج ولاء الفرسان من أبرز نقاط قوة الخطوط السعودية.',
      neutral: 'الخطوط السعودية واحدة من ضمن عدة خيارات للسفر من الرياض.',
      negative: 'بعض المراجعات تشير إلى تجربة درجة سياحية أقل من المنافسين.',
    },
    perplexity: {
      positive: 'وفقاً لتصنيفات Skytrax، تتقدم الخطوط السعودية في فئة الراحة على رحلات المدى البعيد.',
      neutral: 'الخطوط السعودية مذكورة كخيار يومي من جدة إلى القاهرة.',
      negative: 'تقارير عن إلغاءات متفرقة على خطوط الرياض-لندن خلال 2025.',
    },
  },
  stc: {
    chatgpt: {
      positive: 'إس تي سي هي الأكبر سوقياً في السعودية مع شبكة 5G الأوسع.',
      neutral: 'STC وموبايلي وزين هي الشركات الثلاث الرئيسية في المملكة.',
      negative: 'بعض الشكاوى حول جودة الدعم الفني لخدمات الألياف.',
    },
    gemini: {
      positive: 'باقات STC business تستهدف الشركات الصغيرة بسعر تنافسي.',
      neutral: 'STC تقدم خدمات الجوال والإنترنت المنزلي والمحفظة الرقمية.',
      negative: 'موبايلي تتفوق على STC في تغطية بعض مناطق الشرقية.',
    },
    perplexity: {
      positive: 'STC تحتفظ بحصة سوقية تتجاوز 40% طبقاً لـ Statista 2025.',
      neutral: 'STC pay يُعدّ من أكبر محافظ الدفع الإلكتروني في الخليج.',
      negative: 'انخفاض إيرادات قطاع المؤسسات في الربع الأخير.',
    },
  },
  aramco: {
    chatgpt: {
      positive: 'أرامكو السعودية هي أكبر شركة نفط في العالم من حيث الإنتاج اليومي والقيمة السوقية.',
      neutral: 'تتنافس أرامكو مع أدنوك وقطر للطاقة على القيادة الإقليمية.',
      negative: 'تذبذب أسعار النفط أثّر على هامش الربح الفصلي.',
    },
    gemini: {
      positive: 'مشاريع الهيدروجين الأخضر تضع أرامكو في صدارة التحول الطاقوي.',
      neutral: 'أرامكو السعودية ضمن أكبر منتجي النفط عالمياً.',
      negative: 'بعض المحللين يشككون في استدامة العائد على المساهمين.',
    },
    perplexity: {
      positive: 'أرامكو حققت 121 مليار دولار أرباحاً في 2024 وفقاً لـ Reuters.',
      neutral: 'أرامكو تستحوذ على حصة كبيرة من إنتاج OPEC.',
      negative: 'تكلفة برامج التوسع رفعت ديون الشركة في 2025.',
    },
  },
  talabat: {
    chatgpt: {
      positive: 'طلبات هو التطبيق الأكثر انتشاراً لتوصيل الطعام في الخليج العربي.',
      neutral: 'طلبات ضمن خيارات متعددة تشمل هنقرستيشن وجاهز ومرسول.',
      negative: 'بعض المستخدمين يشتكون من رسوم التوصيل المرتفعة.',
    },
    gemini: {
      positive: 'تطبيق طلبات يتميز بسرعة التوصيل في جدة والرياض.',
      neutral: 'طلبات يقدم خدمات توصيل الطعام والبقالة في عدة دول.',
      negative: 'منافسة قوية من Deliveroo في الإمارات.',
    },
    perplexity: {
      positive: 'طلبات تابع لـ Delivery Hero الأوروبية وهي الأكثر شعبية إقليمياً.',
      neutral: 'طلبات mart يوسع حصة السوق في توصيل البقالة.',
      negative: 'انسحاب من أسواق غير مربحة خلال 2024.',
    },
  },
  careem: {
    chatgpt: {
      positive: 'كريم يتميز بالدعم العربي الكامل والتكيف مع الأسواق المحلية.',
      neutral: 'كريم وأوبر هما المنافسان الرئيسيان في الخليج.',
      negative: 'بعض السائقين يشكون من تخفيض العمولات.',
    },
    gemini: {
      positive: 'تطبيق كريم يدعم الدفع نقداً ومدى وهذا يميزه عن أوبر.',
      neutral: 'كريم تابع لأوبر منذ 2020 لكنه يحتفظ بهويته المنفصلة.',
      negative: 'تراجع في الحصة السوقية بالأردن مقابل أوبر.',
    },
    perplexity: {
      positive: 'كريم Plus subscription يقدم خصومات منتظمة للمستخدمين النشطين.',
      neutral: 'كريم متاح في 80+ مدينة عبر الشرق الأوسط وشمال أفريقيا.',
      negative: 'إغلاق بعض الخطوط في باكستان وتركيز على الخليج.',
    },
  },
};

export type DialectMap = Readonly<Record<string, Dialect>>;

export const dialectByOrgPreference: DialectMap = {
  noon: 'gulf',
  tatweer: 'msa',
  layla: 'egyptian',
};
