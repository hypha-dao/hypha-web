export function stripDescription(description: string): string {
  if (!description) return '';
  return description
    .replace(/\\([\[\]\(\)\{\}])/g, '$1')
    .replace(/&#x([0-9A-Fa-f]+);/gi, (full, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff)
        return full;
      return String.fromCodePoint(codePoint);
    })
    .replace(/&#(\d+);/g, (full, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff)
        return full;
      return String.fromCodePoint(codePoint);
    });
}
