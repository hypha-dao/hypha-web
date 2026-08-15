const EXCERPT_MAX = 220;

/** Plain-text card preview from an intelligence Markdown body (no YAML). */
export function excerptIntelligenceBody(
  body: string,
  max = EXCERPT_MAX,
): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trimEnd()}…`;
}
