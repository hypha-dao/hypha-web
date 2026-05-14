export function getLocaleFromPath(pathname: string | null | undefined): string {
  const normalized = (pathname ?? '').trim();
  const parts = normalized.split('/').filter(Boolean);
  return parts[0] ?? 'en';
}
