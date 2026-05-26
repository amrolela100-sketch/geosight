# Arabic NLP Corpus

Seed benchmark corpus for Phase 2 W10-W11. The first checkpoint contains 240
entries: 60 MSA, 60 Gulf, 60 Levantine, and 60 Egyptian. The roadmap target is
1000 entries, expanded gradually as real scan data and manual labels arrive.

Each line is one JSON object matching `schema.json`.

Required fields:

- `id`: stable entry id, e.g. `msa-001`
- `dialect`: `msa`, `gulf`, `levantine`, or `egyptian`
- `text`: provider-like Arabic response text
- `target_brand`: canonical brand slug used by the benchmark registry
- `expected`: labeled parser output
- `difficulty`: `easy`, `medium`, or `hard`
- `notes`: short label rationale

Run validation from `workers/scanner`:

```bash
python corpus/validate.py
```

Run the parser accuracy gate:

```bash
python -m pytest tests/test_accuracy.py -q
```
