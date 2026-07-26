#!/usr/bin/env python3
"""PDF bytes in -> structured JSON out. Nothing else.

Contract: { pages: [{ n, text }], tables: [[...rows]], text: "full text" }
No DB access, no state, no tenant awareness. Invoked by Node via
child_process (MVP) or HTTP (once containerized). Any change here must
keep the golden-file tests in tests/golden/ passing.
"""

import json
import sys

import pdfplumber
import pytesseract
from pdf2image import convert_from_path


def extract(pdf_path: str) -> dict:
    pages = []
    tables = []
    full_text_parts = []

    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""

            if not text.strip():
                # Scanned page: fall back to OCR (Tesseract handles Hindi
                # notices via the "hin+eng" language pack).
                images = convert_from_path(pdf_path, first_page=i, last_page=i)
                text = pytesseract.image_to_string(images[0], lang="hin+eng")

            pages.append({"n": i, "text": text})
            full_text_parts.append(text)

            for table in page.extract_tables():
                tables.append(table)

    return {
        "pages": pages,
        "tables": tables,
        "text": "\n".join(full_text_parts),
    }


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: extract.py <pdf_path>"}), file=sys.stderr)
        sys.exit(1)

    result = extract(sys.argv[1])
    print(json.dumps(result))


if __name__ == "__main__":
    main()
