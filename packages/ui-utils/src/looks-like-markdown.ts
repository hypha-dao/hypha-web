/**
 * Heuristic: does plaintext look like Markdown worth parsing on paste?
 * Conservative — avoid hijacking normal prose, single URLs, or short fragments.
 */
export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed.length < 2) return false;

  // Single-line URL / path — not markdown structure.
  if (/^https?:\/\/\S+$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return false;
  }

  const lines = trimmed.split(/\r?\n/);
  let structuralHits = 0;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    if (/^#{1,6}\s+\S/.test(line)) {
      structuralHits += 2;
      continue;
    }
    if (/^>\s?\S?/.test(line)) {
      structuralHits += 1;
      continue;
    }
    if (/^(`{3,}|~~~)/.test(line)) {
      structuralHits += 2;
      continue;
    }
    if (/^(\s{0,3})([-*+]|\d+\.)\s+\S/.test(line)) {
      structuralHits += 1;
      continue;
    }
    if (/^(\s{0,3})[-*+]\s+\[[ xX]\]\s+\S/.test(line)) {
      structuralHits += 2;
      continue;
    }
  }

  if (structuralHits >= 1 && lines.length >= 2) return true;
  if (structuralHits >= 2) return true;

  // Inline-only signals need at least one clear pair.
  if (/\*\*[^*\n]+\*\*/.test(trimmed)) return true;
  if (/__[^_\n]+__/.test(trimmed)) return true;
  if (/\[[^\]\n]+\]\([^)\s]+\)/.test(trimmed)) return true;
  if (/`[^`\n]+`/.test(trimmed) && /[\n*]/.test(trimmed)) return true;

  // Single-line heading or list item.
  if (lines.length === 1) {
    const line = lines[0]!.trim();
    if (/^#{1,6}\s+\S/.test(line)) return true;
    if (/^([-*+]|\d+\.)\s+\S/.test(line) && line.length > 4) return true;
  }

  return false;
}
