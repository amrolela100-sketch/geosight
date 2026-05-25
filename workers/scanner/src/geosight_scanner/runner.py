"""Orchestrator — run the probe set across one or more providers.

Phase 0 keeps this synchronous-async simple: gather all probes per provider,
collect ProbeOutcome rows, hand them back. Phase 2 will queue this work
through BullMQ instead.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable, Sequence

from geosight_scanner.parse import parse
from geosight_scanner.providers.base import ProviderClient, ProviderError
from geosight_scanner.types import Probe, ProbeOutcome, ProviderName, ProviderResponse


async def _safe_query(client: ProviderClient, probe: Probe) -> ProviderResponse | ProviderError:
    """Run one probe, returning the error object instead of raising on failure.

    Lets the rest of the spike continue when a single provider misbehaves —
    critical for the accuracy gate, where we want partial data over no data.
    """
    try:
        return await client.query(probe.query)
    except ProviderError as err:
        return err
    except Exception as err:
        return ProviderError(client.name, f"unexpected: {err!r}")


async def run_provider(
    client: ProviderClient,
    probes: Sequence[Probe],
    *,
    concurrency: int = 4,
) -> list[ProbeOutcome | ProviderError]:
    """Run every probe through one provider with bounded concurrency."""
    semaphore = asyncio.Semaphore(concurrency)

    async def _one(probe: Probe) -> ProbeOutcome | ProviderError:
        async with semaphore:
            response_or_err = await _safe_query(client, probe)
            if isinstance(response_or_err, ProviderError):
                return response_or_err
            parsed = parse(response_or_err, probe.target_brand)
            return ProbeOutcome(
                probe=probe,
                provider=client.name,
                response=response_or_err,
                parsed=parsed,
            )

    return list(await asyncio.gather(*[_one(p) for p in probes]))


async def run_all(
    clients: Iterable[ProviderClient],
    probes: Sequence[Probe],
    *,
    concurrency: int = 4,
) -> dict[ProviderName, list[ProbeOutcome | ProviderError]]:
    """Run the probe set across multiple providers, one provider at a time.

    Returns a per-provider result list keyed by ProviderName.
    """
    results: dict[ProviderName, list[ProbeOutcome | ProviderError]] = {}
    for client in clients:
        results[client.name] = await run_provider(client, probes, concurrency=concurrency)
    return results
