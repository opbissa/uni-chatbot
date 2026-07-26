export interface Chunk {
  heading: string | null;
  text: string;
}

const MIN_WORDS = 200;
const MAX_WORDS = 500;

/**
 * Splits by heading/section first, then by word count within a section,
 * with slight overlap between chunks. This scheme is expensive to change
 * later (re-processing everything), so keep edits deliberate.
 */
export function chunkText(fullText: string): Chunk[] {
  const sections = fullText.split(/\n(?=#{1,3}\s|[A-Z][A-Za-z0-9 ]{3,60}\n-{3,})/);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const headingMatch = section.match(/^#{1,3}\s*(.+)|^([A-Z][A-Za-z0-9 ]{3,60})\n-{3,}/);
    const heading = headingMatch ? (headingMatch[1] ?? headingMatch[2]).trim() : null;
    const words = section.trim().split(/\s+/);

    if (words.length <= MAX_WORDS) {
      if (words.length > 0 && words[0] !== "") chunks.push({ heading, text: section.trim() });
      continue;
    }

    const overlap = 30;
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + MAX_WORDS, words.length);
      chunks.push({ heading, text: words.slice(start, end).join(" ") });
      if (end === words.length) break;
      start = end - overlap;
    }
  }

  return chunks.filter((c) => c.text.split(/\s+/).length >= Math.min(MIN_WORDS, 20));
}
