"""Validate the Arabic NLP JSONL corpus without external dependencies."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DIALECTS = ("msa", "gulf", "levantine", "egyptian")
DIFFICULTIES = ("easy", "medium", "hard")
SENTIMENTS = ("positive", "neutral", "negative")


def _fail(path: Path, line_no: int, message: str) -> None:
    raise ValueError(f"{path.name}:{line_no}: {message}")


def validate_entry(entry: dict[str, Any], path: Path, line_no: int) -> None:
    required = {"id", "dialect", "text", "target_brand", "expected", "difficulty", "notes"}
    extra = set(entry) - required
    missing = required - set(entry)
    if missing:
        _fail(path, line_no, f"missing fields: {sorted(missing)}")
    if extra:
        _fail(path, line_no, f"extra fields: {sorted(extra)}")

    dialect = entry["dialect"]
    if dialect not in DIALECTS:
        _fail(path, line_no, f"invalid dialect {dialect!r}")
    if not isinstance(entry["id"], str) or not entry["id"].startswith(f"{dialect}-"):
        _fail(path, line_no, "id must start with dialect prefix")
    if not isinstance(entry["text"], str) or not entry["text"].strip():
        _fail(path, line_no, "text must be a non-empty string")
    if not isinstance(entry["target_brand"], str) or not entry["target_brand"].strip():
        _fail(path, line_no, "target_brand must be a non-empty string")
    if entry["difficulty"] not in DIFFICULTIES:
        _fail(path, line_no, f"invalid difficulty {entry['difficulty']!r}")
    if not isinstance(entry["notes"], str):
        _fail(path, line_no, "notes must be a string")

    expected = entry["expected"]
    if not isinstance(expected, dict):
        _fail(path, line_no, "expected must be an object")
    expected_required = {"mentioned", "position", "rank", "sentiment", "competitors", "citations"}
    if set(expected) != expected_required:
        _fail(path, line_no, "expected has wrong fields")
    if not isinstance(expected["mentioned"], bool):
        _fail(path, line_no, "expected.mentioned must be boolean")
    if expected["position"] is not None and not isinstance(expected["position"], int):
        _fail(path, line_no, "expected.position must be int or null")
    if expected["rank"] is not None and not isinstance(expected["rank"], int):
        _fail(path, line_no, "expected.rank must be int or null")
    if expected["sentiment"] not in SENTIMENTS:
        _fail(path, line_no, f"invalid sentiment {expected['sentiment']!r}")
    if not isinstance(expected["competitors"], list) or not all(
        isinstance(item, str) for item in expected["competitors"]
    ):
        _fail(path, line_no, "expected.competitors must be a string array")
    if not isinstance(expected["citations"], list) or not all(
        isinstance(item, str) for item in expected["citations"]
    ):
        _fail(path, line_no, "expected.citations must be a string array")


def validate_file(path: Path) -> int:
    seen: set[str] = set()
    count = 0
    with path.open("r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            entry = json.loads(line)
            validate_entry(entry, path, line_no)
            if entry["id"] in seen:
                _fail(path, line_no, f"duplicate id {entry['id']!r}")
            seen.add(entry["id"])
            count += 1
    return count


def main() -> None:
    total = 0
    for dialect in DIALECTS:
        path = ROOT / f"{dialect}.jsonl"
        count = validate_file(path)
        if count != 60:
            raise ValueError(f"{path.name}: expected 60 entries, found {count}")
        total += count
    print(f"Validated {total} corpus entries.")


if __name__ == "__main__":
    main()
