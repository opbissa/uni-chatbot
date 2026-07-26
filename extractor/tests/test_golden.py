"""Runs extract.py against every PDF in tests/golden/ and diffs the output
against its committed <name>.json. Add a real university PDF + expected JSON
here before changing extract.py; this is the safety rail for the extractor.
"""

import json
import subprocess
import sys
from pathlib import Path

GOLDEN_DIR = Path(__file__).parent / "golden"
EXTRACT_SCRIPT = Path(__file__).parent.parent / "extract.py"


def run_extract(pdf_path: Path) -> dict:
    result = subprocess.run(
        [sys.executable, str(EXTRACT_SCRIPT), str(pdf_path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_golden_files():
    pdf_files = sorted(GOLDEN_DIR.glob("*.pdf"))
    assert pdf_files, "no golden PDFs found in tests/golden/ yet"

    for pdf_path in pdf_files:
        expected_path = pdf_path.with_suffix(".json")
        assert expected_path.exists(), f"missing expected output for {pdf_path.name}"

        actual = run_extract(pdf_path)
        expected = json.loads(expected_path.read_text())
        assert actual == expected, f"mismatch for {pdf_path.name}"
