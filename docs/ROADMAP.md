# GeoSight — Implementation Roadmap

Solo build · 32-week plan · Arabic-first GEO analytics SaaS.

This roadmap is the canonical execution sequence. Phases are sized so each one produces a verifiable, demonstrable artifact — never theoretical work.

---

## Phase 0 — Proof of Concept (weeks 1–2)

**Goal:** prove that quality Arabic GEO signal can be extracted from ChatGPT / Gemini / Perplexity before investing in product surface area.

- Python spike inside `workers/scanner/`: query 20 Arabic prompts × 3 providers, persist raw JSON.
- First-pass Arabic normalization (hamza, yaa, taa marbuta, tatweel, diacritics, digits).
- Heuristic brand-detection + naive GEO score (0–100).
- CSV/JSON output for manual review.

**Exit criteria:**
- Successful structured extraction on ≥ 80% of probes across all 3 providers.
- Brand detection accuracy ≥ 75% on the dialect sample set.
- If criteria miss, **stop** and revisit the thesis before Phase 1.

---

## Phase 1 — Infrastructure, Auth, DB (weeks 3–6)

**Goal:** production-grade foundation.

- Week 3: monorepo + Next.js 14 (`apps/web`) + Tailwind/RTL + next-intl + next-themes + CI.
- Week 4: Clerk auth + Organizations + RBAC (owner/admin/member/viewer) + Clerk webhooks.
- Week 5: `packages/db` (Drizzle schema + migrations + RLS) + Sentry/PostHog wiring.
- Week 6: marketing landing page + waitlist (Resend) + SEO + deploy to Vercel.

**Exit criteria:** signed-up users land on a real dashboard shell, marketing site live, waitlist collecting leads.

---

## Phase 2 — GEO Engine + Arabic NLP (weeks 7–12) — the moat

**Goal:** the hardest, most defensible work. Six weeks dedicated.

- Week 7: Fastify (`apps/api`) + Zod + BullMQ queues (`scan:scheduled`, `scan:manual`, `report:generate`, `alert:send`, `dead-letter`) + Bull Board.
- Weeks 8–9: production Python scanner per provider — retry + exponential backoff + Redis response cache + prompt engineering matrix per dialect.
- Weeks 10–11: **Arabic NLP parser**.
  - Build 1000-item labeled test set (250 MSA + 250 Gulf + 250 Levantine + 250 Egyptian).
  - `ArabicNormalizer` pipeline.
  - `ArabicNLPParser` with multi-strategy brand detection (exact → alias → English-in-Arabic → fuzzy/Levenshtein → transliteration).
  - Dialect glossary mapping.
  - Sentiment + competitor + citation extraction.
- Week 12: GEO Score formula (configurable weights) + AISoV + daily aggregation cron + 90-day retention policy.

**Accuracy targets:** MSA brand detection > 95%, dialects > 85%, citation > 95%, competitor > 85%, sentiment > 75%.

---

## Phase 3 — BYOK Vault (weeks 13–15)

**Goal:** customer-provided API keys, stored safely.

- Week 13: AES-256-GCM `KeyVaultService` with master key from env (never in DB / never in source) + audit log on every encrypt/decrypt.
- Week 14: settings UI — add/remove/validate keys per provider, live usage meters, team & notification settings.
- Week 15: automated 24h key validation cron + low-balance alerts + key-rotation test + security review of decryption proxy layer.

---

## Phase 4 — Dashboard UX (weeks 16–22)

**Goal:** Linear/Vercel/Stripe-grade UI. Seven weeks because UX polish is a stated priority (#3, ahead of scalability).

- Weeks 16–17: design tokens, dark-first theme, `@geosight/ui` (shadcn primitives + GeoSight tokens), layout shell, micro-animations.
- Weeks 18–19: Overview / Keywords / Scan Detail / Competitors pages with interactive charts (Recharts).
- Weeks 20–21: PDF reports (`@react-pdf/renderer`, white-label) + scheduled email delivery + notification center + Slack hook.
- Week 22: Server Components + Suspense streaming + React Query client cache + error boundaries + Playwright E2E covering the full signup → scan → report path.

---

## Phase 5 — Billing + Closed Beta (weeks 23–28)

**Goal:** revenue plumbing + 20 real Arabic marketing users.

- Week 23: Stripe Checkout + Billing Portal + 4 plans (Starter/Growth/Agency/Enterprise) + webhooks + usage-based overage.
- Weeks 24–25: PostHog feature flags + staging + in-app feedback widget + interactive onboarding + Arabic knowledge base + Crisp/Intercom.
- Weeks 26–28: closed beta with 20 waitlist users (Arabic marketing agencies prioritized), weekly 30-min interviews, NPS + Activation + Engagement tracking, NLP refinement on real production data.

---

## Phase 6 — Public Launch (weeks 29–32)

**Goal:** open the gates, $7K MRR.

- Weeks 29–30: bug bash, Betteruptime status page, beta case studies, free single-shot GEO Audit tool (lead magnet).
- Weeks 31–32: Product Hunt launch, Arabic SaaS communities, LinkedIn content, ArabNet / Step Conference outreach, 20% affiliate program.

**Launch goals (end of week 32):** 500+ signups, 100+ paying, $7K MRR, churn < 5%, NPS > 50.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Provider API breaking changes | High | High | Adapter abstraction layer + quick patch pipeline |
| Arabic NLP accuracy below target | Medium | Critical | 1000-item labeled set + Phase 0 gate + 6 weeks in Phase 2 |
| Rate-limit / cost spikes | High | Medium | Response cache + exponential backoff + smart scheduling |
| BYOK key leak | Low | Critical | AES-256-GCM + master key in env only + audit log |
| Slow user acquisition | Medium | High | Free GEO Audit tool + content + 20% affiliates |
| Solo-developer burnout | High | High | Hard cap at 25–30 hrs/week + buffer weeks built into every phase |

---

## Cost Trajectory

| Stage | Cost / month |
|---|---|
| Pre-launch (months 1–6) | ~$0 (every vendor has a free tier large enough) |
| Post-launch @ 100 customers | ~$127 (Vercel + Supabase + Upstash + Clerk + Railway + R2 + Resend + Sentry + domain) |

At $7K MRR with $121 infra, gross margin > 98% before BYOK pass-through.
