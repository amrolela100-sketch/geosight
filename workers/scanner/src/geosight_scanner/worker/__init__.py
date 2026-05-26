"""BullMQ worker bridge — consume scan jobs and persist results.

This subpackage is the Phase 2 W8 deliverable: it lets a job enqueued by
`apps/api` (POST /scans/trigger) be picked up by Python, run through
`geosight_scanner.runner`, and written back to `scan_results` via asyncpg.

Module layout:
    config   — env-backed worker settings (no pydantic dep)
    keys     — KeyResolver protocol: EnvKeyResolver (dev) + VaultKeyResolver (W13)
    db       — asyncpg pool + load_brand / load_keywords / insert_scan_result
    handler  — process_scan_job(payload, deps) — pure-async, dependency-injected
    main     — BullMQ Worker entrypoint (`geosight-worker` console script)

The handler is deliberately decoupled from BullMQ so tests can drive it
directly with fake DB + fake providers (see tests/test_worker_handler.py).
"""
