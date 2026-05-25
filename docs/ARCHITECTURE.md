# GeoSight — Architecture Overview

A pnpm + Turborepo monorepo. Each workspace has a single, well-defined responsibility; nothing crosses boundaries except through `@geosight/shared` types and `@geosight/db` queries.

```
geosight/
├── apps/
│   ├── web/              Next.js 14 — marketing site + dashboard (RTL-first)
│   └── api/              Fastify — REST API, BullMQ producers, Clerk/Stripe webhooks
├── workers/
│   └── scanner/          Python (async) — provider scanners + Arabic NLP parser
├── packages/
│   ├── db/               Drizzle schema + migrations + typed query helpers
│   ├── shared/           Cross-cutting types, Zod schemas, constants, pure utils
│   ├── ui/               shadcn primitives + GeoSight design tokens (RTL-aware)
│   └── config/           Shared TypeScript / ESLint / Tailwind base configs
├── tooling/              One-off devops scripts, migration helpers, seed runners
├── docs/                 ROADMAP, ARCHITECTURE, decision records
└── scripts/              Repo-level bash/node automation
```

## Data Flow

```
User → Next.js (web) → Fastify (api) ──┬─► BullMQ queue ──► Python worker
                                       │                       │
                                       ├─► Postgres (Neon)     ├─► OpenAI / Gemini / Perplexity
                                       │                       ▼
                                       └─► Redis (Upstash) ◄─── parsed results
                                                               │
                                                               ▼
                                                          Postgres + R2 (PDFs)
```

## Boundaries

- **`apps/web`** never imports from `apps/api` or `workers/`. It speaks to the API over HTTP.
- **`apps/api`** never reaches into `workers/scanner` source. It dispatches work via BullMQ jobs.
- **`workers/scanner`** is Python and shares no code with TS — the contract is the BullMQ job payload + DB schema, both versioned via `@geosight/shared` JSON schemas.
- **`@geosight/db`** owns *all* SQL. No raw queries elsewhere.
- **`@geosight/shared`** is the only package the API and Web layer both import — keeps a single source of truth for types and Zod schemas.

## Decision Records

Long-form ADRs land in `docs/adr/` once architectural decisions need durable rationale. Until then, the [ROADMAP](./ROADMAP.md) is the single source of truth.
