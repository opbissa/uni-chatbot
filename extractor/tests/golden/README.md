# Golden files

Drop real university PDFs here (`some-name.pdf`) alongside their expected
extraction output (`some-name.json`, matching `extract.py`'s output shape).

Current fixtures (from mgsubikaner.ac.in, 2026-07-27):
- `mgsu-exam-notice-scanned.pdf` — scanned image, no text layer; exercises
  the Tesseract OCR fallback (hin+eng).
- `mgsu-registered-students-table.pdf` — 204-page tabular PDF; exercises
  `extract_tables()` (pdftotext -layout alone garbles the columns).
- `mgsu-affiliated-colleges-malformed.pdf` — produced by "Microsoft: Print
  To PDF"; pdfplumber/pdfminer silently reports 0 pages (empty catalog, no
  exception). Exercises the pdftotext fallback in `extract()` for this case.

Regenerate expected JSON after an intentional `extract.py` change with:
`python3 extract.py tests/golden/<name>.pdf > tests/golden/<name>.json`
