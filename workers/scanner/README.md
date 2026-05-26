# geosight-scanner — Python workers

Two-in-one Python package:

| Binary             | Purpose                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `geosight-scan`    | Phase 0 / offline CLI. Replays fixtures or live providers and dumps GEO scores to JSON / CSV. |
| `geosight-worker`  | Phase 2 W8 BullMQ consumer. Picks up jobs enqueued by `apps/api` and writes `scan_results`.   |

The CLI is the developer's offline lab; the worker is the production bridge between Fastify and Postgres.

---

## Architecture (worker)

```
apps/api  ─POST /scans/trigger──▶  BullMQ (scan:manual)  ─consumed by──▶  geosight-worker
                                          ▲                                       │
                                          │                                       ▼
                                  scan:scheduled (cron)                  fetch brand + keywords (asyncpg)
                                                                         resolve API keys (BYOK)
                                                                         run providers via geosight_scanner.runner
                                                                         parse via geosight_scanner.parse
                                                                         INSERT scan_results
                                                                         UPDATE keywords.last_scanned_at
```

Source layout for the worker:

| Module                                  | What it owns                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `src/geosight_scanner/worker/config.py`  | env-backed `WorkerConfig` (`DATABASE_URL`, `REDIS_URL`, queues, concurrency)  |
| `src/geosight_scanner/worker/keys.py`    | `KeyResolver` protocol — `EnvKeyResolver` (dev), `VaultKeyResolver` (W13 stub) |
| `src/geosight_scanner/worker/db.py`      | `asyncpg`-backed `ScanRepo` — brand / keyword reads, scan_result inserts      |
| `src/geosight_scanner/worker/handler.py` | `process_scan_job` — pure-async, DI-friendly, BullMQ-agnostic                 |
| `src/geosight_scanner/worker/main.py`    | `geosight-worker` entrypoint — one `bullmq.Worker` per configured queue       |

The handler is the only file with business logic; everything else is wiring.

---

## Running locally

```bash
# from repo root
cd workers/scanner

# one-time
python -m venv .venv
./.venv/Scripts/pip install -e ".[dev]"     # bash / git-bash on Windows
# or:  ./.venv/Scripts/activate && pip install -e ".[dev]"

# required env (set in a .env, then source it — or export inline)
export DATABASE_URL='postgresql://user:pass@host:5432/geosight'
export REDIS_URL='rediss://default:...@your.upstash.io:6379'

# BYOK keys — env mode only (dev). In production swap to BYOK_MODE=vault
# once Phase 3 W13 ships the AES-256-GCM vault.
export OPENAI_API_KEY='sk-...'
export GEMINI_API_KEY='...'
export PERPLEXITY_API_KEY='pplx-...'

# optional
export WORKER_QUEUES='scan:manual,scan:scheduled'   # default
export WORKER_CONCURRENCY=4                          # default
export BYOK_MODE=env                                  # default (env|vault)
export LOG_LEVEL=info

./.venv/Scripts/geosight-worker
```

End-to-end smoke test:

1. Start `apps/api` (Fastify) and ensure `REDIS_URL` is reachable.
2. Start `geosight-worker` in another terminal.
3. From a third terminal:

   ```bash
   curl -X POST http://localhost:4000/scans/trigger \
     -H 'content-type: application/json' \
     -d '{
       "organizationId": "<org_uuid>",
       "brandId": "<brand_uuid>"
     }'
   ```

4. Poll `GET /scans/:jobId/status` until `state: "completed"`. The job's
   `returnvalue` reports `rowsWritten`, `rowsFailed`, and any
   `skippedProviders` whose keys were missing.

---

## BYOK status

This worker honours the BYOK contract documented in
`memory/feedback_byok_from_day_one.md`: provider clients require an API key
at construction, with **no owner-side fallback**.

- `BYOK_MODE=env` — dev shortcut. The developer running the worker is
  treated as the sole tenant and supplies their own keys via env. Safe only
  in single-tenant dev.
- `BYOK_MODE=vault` — production target. Reads `api_keys_vault.encrypted_key`
  via the AES-256-GCM `KeyVaultService` that lands in **Phase 3 / Week 13**.
  Constructing it before that point raises `NotImplementedError` on purpose —
  the tripwire test in `tests/test_worker_config.py` will start failing once
  the resolver is implemented and forces the rewrite.

---

## Where this fits in the roadmap

`docs/ROADMAP.md § Phase 2 / Weeks 8–9` lists the production-grade scanner
work as four threads:

| Thread                                | Status                                          |
| ------------------------------------- | ----------------------------------------------- |
| BullMQ → Python bridge                | ✅ this PR (W8)                                  |
| Retry + exponential backoff           | ⏳ next slice (W8 cont.)                         |
| Redis response cache                  | ⏳ next slice (W8 cont.)                         |
| Prompt engineering matrix per dialect | ⏳ W9 — requires live API access for validation  |

---

## Tests

```bash
./.venv/Scripts/pytest                     # 79 tests, all in-process
```

The handler tests use a fake `ScanRepo` and a fake `ProviderClient`, so the
scan-job lifecycle is exercised end-to-end without Redis, Postgres, or real
API keys.
