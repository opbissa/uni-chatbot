import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
const EXTRACTOR_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../extractor/extract.py"
);
// pdftotext -layout is the fast path (CLAUDE.md); below this, assume the
// PDF is scanned or table-heavy and hand it to the Python extractor.
const MIN_FAST_PATH_CHARS = 200;
const MAX_BUFFER = 50 * 1024 * 1024;

/** PDF bytes in -> best-effort plain text out. Node decides the strategy; extract.py just transforms one file when called. */
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "uc-pdf-"));
  const pdfPath = path.join(dir, `${randomUUID()}.pdf`);
  try {
    await writeFile(pdfPath, pdfBuffer);

    const fastText = await pdftotextFastPath(pdfPath);
    if (fastText.trim().length >= MIN_FAST_PATH_CHARS) return fastText;

    return await extractWithPython(pdfPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function pdftotextFastPath(pdfPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
      maxBuffer: MAX_BUFFER,
    });
    return stdout;
  } catch {
    return "";
  }
}

async function extractWithPython(pdfPath: string): Promise<string> {
  const { stdout } = await execFileAsync(PYTHON_BIN, [EXTRACTOR_SCRIPT, pdfPath], {
    maxBuffer: MAX_BUFFER,
  });
  const data = JSON.parse(stdout) as { text: string };
  return data.text;
}
