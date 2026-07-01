export function parseBearerToken(
  authorization: string | null,
): string | undefined {
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || undefined;
}
