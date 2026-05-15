import { routing, type Locale } from '@hypha-platform/i18n';

const SUPPORTED_LOCALES = new Set<Locale>(routing.locales);

export function getLocaleFromPath(pathname: string | null | undefined): Locale {
  const normalized = (pathname ?? '').trim();
  const parts = normalized.split('/').filter(Boolean);
  const candidate = parts[0];
  if (candidate && SUPPORTED_LOCALES.has(candidate as Locale)) {
    return candidate as Locale;
  }
  return 'en';
}
