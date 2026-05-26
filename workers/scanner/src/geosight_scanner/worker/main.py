"""BullMQ worker entrypoint (`geosight-worker`).

What this binary does:
    * Reads WorkerConfig from process env (see config.py).
    * Spins up one bullmq.Worker per configured queue, all sharing the same
      asyncpg pool and key resolver.
    * Each Worker calls process_scan_job and stuffs HandlerResult into
      job.returnvalue so `GET /scans/:jobId/status` can surface it.
    * Installs SIGTERM/SIGINT handlers for graceful shutdown — drains
      in-flight jobs, closes the pool, then exits.

This is the only module that talks to BullMQ. Tests cover the handler in
isolation via fake repos and fake providers — see tests/test_worker_handler.py.
"""

from __future__ import annotations

import asyncio
import logging
import signal
import sys
from typing import Any

import structlog
from bullmq import UnrecoverableError, Worker

from geosight_scanner.providers import GeminiClient, OpenAIClient, PerplexityClient
from geosight_scanner.providers.base import ProviderClient
from geosight_scanner.types import ProviderName

from .config import ConfigError, WorkerConfig, load_config
from .db import AsyncpgScanRepo
from .handler import (
    HandlerDeps,
    UnrecoverableHandlerError,
    parse_payload,
    process_scan_job,
)
from .keys import KeyResolver, build_key_resolver

logger = structlog.get_logger(__name__)


def _configure_logging(level: str) -> None:
    """Tie stdlib logging + structlog to one level so bullmq / asyncpg logs
    aren't silently dropped under their own handlers."""
    numeric = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(level=numeric, format="%(message)s", stream=sys.stdout)
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(numeric),
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )


def _default_provider_factory(name: ProviderName, api_key: str) -> ProviderClient:
    """Build a real provider client. Tests pass their own factory."""
    if name is ProviderName.OPENAI:
        return OpenAIClient(api_key)
    if name is ProviderName.GEMINI:
        return GeminiClient(api_key)
    if name is ProviderName.PERPLEXITY:
        return PerplexityClient(api_key)
    raise ValueError(f"unknown provider: {name!r}")


def _make_processor(deps: HandlerDeps) -> Any:
    """Build the BullMQ `process(job, token)` callback bound to `deps`."""

    async def process(job: Any, _token: str) -> dict[str, Any]:
        # Parsing errors are unrecoverable — wrap in bullmq.UnrecoverableError
        # so the job moves straight to failed, no retry burn.
        try:
            payload = parse_payload(job.data)
        except UnrecoverableHandlerError as err:
            raise UnrecoverableError(str(err)) from err

        try:
            await job.updateProgress(10)
        except Exception as err:
            logger.debug("worker.progress.failed", phase="start", error=repr(err))

        try:
            result = await process_scan_job(payload, deps)
        except UnrecoverableHandlerError as err:
            raise UnrecoverableError(str(err)) from err

        try:
            await job.updateProgress(100)
        except Exception as err:
            logger.debug("worker.progress.failed", phase="end", error=repr(err))

        return {
            "keywordCount": result.keyword_count,
            "providerCount": result.provider_count,
            "rowsWritten": result.rows_written,
            "rowsFailed": result.rows_failed,
            "skippedProviders": [p.value for p in result.skipped_providers],
        }

    return process


async def _serve(config: WorkerConfig) -> None:
    """Build dependencies, start workers, block until signalled."""
    repo = await AsyncpgScanRepo.connect(config.database_url, max_size=config.concurrency)
    keys: KeyResolver = build_key_resolver(config.byok_mode)

    deps = HandlerDeps(
        repo=repo,
        keys=keys,
        provider_factory=_default_provider_factory,
    )
    process = _make_processor(deps)

    worker_opts = {
        "connection": config.redis_url,
        "concurrency": config.concurrency,
        # autorun=True is the bullmq Python default; spelling it out for clarity.
        "autorun": True,
    }

    workers: list[Worker] = [Worker(name, process, worker_opts) for name in config.queues]

    log = logger.bind(
        queues=list(config.queues),
        concurrency=config.concurrency,
        byok_mode=config.byok_mode,
    )
    log.info("worker.started")

    shutdown = asyncio.Event()

    def _request_shutdown(*_: object) -> None:
        log.info("worker.shutdown_requested")
        shutdown.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, _request_shutdown)
        except NotImplementedError:
            # Windows: add_signal_handler is unsupported on ProactorEventLoop.
            # Fall back to the stdlib signal hook — fine because we only need
            # one shot to flip the asyncio Event.
            signal.signal(sig, _request_shutdown)

    try:
        await shutdown.wait()
    finally:
        log.info("worker.draining")
        # bullmq Worker.close() waits for in-flight jobs (force=False).
        for w in workers:
            try:
                await w.close()
            except Exception as err:
                log.warning("worker.close.error", error=repr(err))
        try:
            await keys.close()
        finally:
            await repo.close()
        log.info("worker.stopped")


def run() -> None:
    """Console-script entrypoint — `geosight-worker`."""
    try:
        config = load_config()
    except ConfigError as err:
        print(f"[geosight-worker] {err}", file=sys.stderr)
        sys.exit(2)

    _configure_logging(config.log_level)

    try:
        asyncio.run(_serve(config))
    except KeyboardInterrupt:
        # asyncio.run translates SIGINT into KeyboardInterrupt on Python ≥3.11
        # if the signal handler hasn't run yet. Treat as a clean exit.
        sys.exit(0)


if __name__ == "__main__":  # pragma: no cover
    run()
