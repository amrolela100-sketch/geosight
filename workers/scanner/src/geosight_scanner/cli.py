"""GeoSight Phase 0 spike CLI.

Usage:
    geosight-scan run --mode fixtures
    geosight-scan run --mode live --providers openai,gemini

In --mode live the CLI reads keys from environment / .env. These env-derived
keys are the OWNER'S OWN keys for the Phase 0 spike only — never production
behaviour. In production the keys come from the BYOK vault (see
feedback-byok-from-day-one memory). The provider clients themselves remain
ignorant of any env fallback — keys are always passed in explicitly.
"""

from __future__ import annotations

import asyncio
import csv
import json
import os
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from geosight_scanner.fixtures import FixtureClient
from geosight_scanner.prompts import PROBES
from geosight_scanner.providers import (
    GeminiClient,
    OpenAIClient,
    PerplexityClient,
    ProviderClient,
    ProviderError,
)
from geosight_scanner.runner import run_all
from geosight_scanner.types import ProbeOutcome, ProviderName

app = typer.Typer(
    name="geosight-scan",
    help="GeoSight Phase 0 spike — Arabic GEO scanner.",
    no_args_is_help=True,
    add_completion=False,
)
console = Console()

# Phase 0 accuracy gates (from docs/ROADMAP.md § Phase 0 / exit criteria).
_GATE_EXTRACTION = 0.80  # ≥80% probes return parseable text per provider
_GATE_BRAND_DETECTION = 0.75  # ≥75% probes correctly detect the target brand


@app.command()
def run(
    mode: Annotated[str, typer.Option(help="`fixtures` (default, $0) or `live` (real APIs).")] = (
        "fixtures"
    ),
    providers: Annotated[
        str, typer.Option(help="Comma-separated subset, e.g. 'openai,gemini'.")
    ] = "openai,gemini,perplexity",
    out_dir: Annotated[
        Path, typer.Option(help="Where to write raw JSON + CSV summary.")
    ] = Path("tmp/phase-0"),
    concurrency: Annotated[int, typer.Option(help="Parallel requests per provider.")] = 4,
) -> None:
    """Run the Phase 0 spike against the canonical probe set."""
    if mode not in {"fixtures", "live"}:
        raise typer.BadParameter(f"--mode must be 'fixtures' or 'live', got {mode!r}")

    requested = tuple(p.strip().lower() for p in providers.split(",") if p.strip())
    clients = _build_clients(mode=mode, requested=requested)

    if not clients:
        console.print("[red]no providers built — aborting[/red]")
        raise typer.Exit(code=2)

    console.print(
        f"[bold]GeoSight Phase 0 spike[/bold] · mode=[cyan]{mode}[/cyan] · "
        f"providers=[cyan]{','.join(c.name for c in clients)}[/cyan] · "
        f"probes=[cyan]{len(PROBES)}[/cyan]"
    )

    results = asyncio.run(run_all(clients, PROBES, concurrency=concurrency))

    out_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    raw_path = out_dir / f"raw-{run_id}.json"
    csv_path = out_dir / f"summary-{run_id}.csv"

    _write_raw(results, raw_path)
    _write_csv(results, csv_path)
    _print_summary(results, raw_path=raw_path, csv_path=csv_path)


# ─────────────────────────────────────────────────────────────────────────────
# Client construction — BYOK shape (keys passed in explicitly, never read by
# the provider itself).
# ─────────────────────────────────────────────────────────────────────────────


def _build_clients(*, mode: str, requested: tuple[str, ...]) -> list[ProviderClient]:
    if mode == "fixtures":
        return [
            FixtureClient(ProviderName(name))
            for name in requested
            if name in ProviderName._value2member_map_
        ]

    # mode == "live"
    load_dotenv()
    clients: list[ProviderClient] = []
    for name in requested:
        if name == ProviderName.OPENAI.value:
            key = os.environ.get("OPENAI_API_KEY", "").strip()
            if not key:
                console.print("[yellow]skip openai: OPENAI_API_KEY missing[/yellow]")
                continue
            clients.append(OpenAIClient(api_key=key))
        elif name == ProviderName.GEMINI.value:
            key = os.environ.get("GOOGLE_AI_API_KEY", "").strip()
            if not key:
                console.print("[yellow]skip gemini: GOOGLE_AI_API_KEY missing[/yellow]")
                continue
            clients.append(GeminiClient(api_key=key))
        elif name == ProviderName.PERPLEXITY.value:
            key = os.environ.get("PERPLEXITY_API_KEY", "").strip()
            if not key:
                console.print("[yellow]skip perplexity: PERPLEXITY_API_KEY missing[/yellow]")
                continue
            clients.append(PerplexityClient(api_key=key))
        else:
            console.print(f"[yellow]unknown provider: {name}[/yellow]")
    return clients


# ─────────────────────────────────────────────────────────────────────────────
# Output writers
# ─────────────────────────────────────────────────────────────────────────────


def _serialize_outcome(outcome: ProbeOutcome | ProviderError) -> dict[str, object]:
    if isinstance(outcome, ProviderError):
        return {
            "kind": "error",
            "provider": outcome.provider.value,
            "status": outcome.status,
            "message": str(outcome),
        }
    return {
        "kind": "outcome",
        "probe": {
            "id": outcome.probe.id,
            "dialect": outcome.probe.dialect,
            "query": outcome.probe.query,
            "target_brand": outcome.probe.target_brand.name_en,
        },
        "provider": outcome.provider.value,
        "response": {
            "text": outcome.response.text,
            "citations": list(outcome.response.citations),
            "latency_ms": outcome.response.latency_ms,
            "fetched_at": outcome.response.fetched_at.isoformat(),
        },
        "parsed": {
            **{k: v for k, v in asdict(outcome.parsed).items() if k != "citations"},
            "citations": list(outcome.parsed.citations),
            "competitors_mentioned": list(outcome.parsed.competitors_mentioned),
        },
    }


def _write_raw(
    results: dict[ProviderName, list[ProbeOutcome | ProviderError]], path: Path
) -> None:
    payload = {
        provider.value: [_serialize_outcome(o) for o in outcomes]
        for provider, outcomes in results.items()
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_csv(
    results: dict[ProviderName, list[ProbeOutcome | ProviderError]], path: Path
) -> None:
    fieldnames = [
        "provider",
        "probe_id",
        "dialect",
        "target_brand",
        "kind",
        "brand_mentioned",
        "mention_rank",
        "competitors_mentioned",
        "citations_count",
        "sentiment",
        "detected_dialect",
        "geo_score",
        "latency_ms",
    ]
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for provider, outcomes in results.items():
            for outcome in outcomes:
                if isinstance(outcome, ProviderError):
                    writer.writerow(
                        {
                            "provider": provider.value,
                            "kind": "error",
                            "brand_mentioned": "",
                            "mention_rank": "",
                            "competitors_mentioned": "",
                            "citations_count": "",
                            "sentiment": "",
                            "detected_dialect": "",
                            "geo_score": "",
                            "latency_ms": "",
                            "probe_id": "",
                            "dialect": "",
                            "target_brand": "",
                        }
                    )
                    continue
                writer.writerow(
                    {
                        "provider": provider.value,
                        "probe_id": outcome.probe.id,
                        "dialect": outcome.probe.dialect,
                        "target_brand": outcome.probe.target_brand.name_en,
                        "kind": "outcome",
                        "brand_mentioned": outcome.parsed.brand_mentioned,
                        "mention_rank": outcome.parsed.mention_rank or "",
                        "competitors_mentioned": ",".join(outcome.parsed.competitors_mentioned),
                        "citations_count": len(outcome.parsed.citations),
                        "sentiment": outcome.parsed.sentiment,
                        "detected_dialect": outcome.parsed.detected_dialect or "",
                        "geo_score": outcome.parsed.geo_score,
                        "latency_ms": outcome.response.latency_ms,
                    }
                )


# ─────────────────────────────────────────────────────────────────────────────
# Pretty-printed summary + gate check
# ─────────────────────────────────────────────────────────────────────────────


def _print_summary(
    results: dict[ProviderName, list[ProbeOutcome | ProviderError]],
    *,
    raw_path: Path,
    csv_path: Path,
) -> None:
    table = Table(title="Phase 0 — per-provider summary", show_lines=True)
    table.add_column("Provider", style="cyan")
    table.add_column("Probes")
    table.add_column("Extraction OK", justify="right")
    table.add_column("Brand detected", justify="right")
    table.add_column("Avg GEO Score", justify="right")
    table.add_column("Avg latency (ms)", justify="right")
    table.add_column("Gate", justify="center")

    gate_passes: list[bool] = []
    for provider, outcomes in results.items():
        total = len(outcomes)
        ok = [o for o in outcomes if isinstance(o, ProbeOutcome)]
        extraction_rate = len(ok) / total if total else 0.0
        detected = [o for o in ok if o.parsed.brand_mentioned]
        detection_rate = len(detected) / total if total else 0.0
        avg_score = (sum(o.parsed.geo_score for o in ok) / len(ok)) if ok else 0.0
        avg_latency = (sum(o.response.latency_ms for o in ok) / len(ok)) if ok else 0.0

        passed = extraction_rate >= _GATE_EXTRACTION and detection_rate >= _GATE_BRAND_DETECTION
        gate_passes.append(passed)

        table.add_row(
            provider.value,
            str(total),
            f"{extraction_rate:.0%}",
            f"{detection_rate:.0%}",
            f"{avg_score:.1f}",
            f"{avg_latency:.0f}",
            "[green]PASS[/green]" if passed else "[red]FAIL[/red]",
        )

    console.print(table)
    console.print(f"raw   → [dim]{raw_path}[/dim]")
    console.print(f"csv   → [dim]{csv_path}[/dim]")

    if all(gate_passes):
        console.print("\n[bold green]✓ Phase 0 gates passed — clear to start Phase 1.[/bold green]")
    else:
        console.print(
            "\n[bold red]✗ Phase 0 gates FAILED — revisit the parser before Phase 1.[/bold red]"
        )


if __name__ == "__main__":
    app()
