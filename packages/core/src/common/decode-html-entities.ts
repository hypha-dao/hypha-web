/** Named entities we see in rich-text / TipTap plain-text leaks. */
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
};

/**
 * Decode HTML entities for plain-text UI (React text nodes do not expand them).
 * Runs a few passes so double-encoded values like `&amp;amp;` become `&`.
 */
export function decodeHtmlEntities(value: string): string {
  if (!value || !value.includes('&')) return value;

  let text = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(
      /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g,
      (full, body: string) => {
        if (body.startsWith('#')) {
          const codePoint =
            body[1] === 'x' || body[1] === 'X'
              ? Number.parseInt(body.slice(2), 16)
              : Number.parseInt(body.slice(1), 10);
          if (
            !Number.isFinite(codePoint) ||
            codePoint < 0 ||
            codePoint > 0x10ffff
          ) {
            return full;
          }
          return String.fromCodePoint(codePoint);
        }
        return NAMED_HTML_ENTITIES[body.toLowerCase()] ?? full;
      },
    );
    if (next === text) break;
    text = next;
  }
  return text;
}
