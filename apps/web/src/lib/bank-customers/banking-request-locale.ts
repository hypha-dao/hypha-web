import { routing } from '@hypha-platform/i18n';

export function getLocaleFromRequest(request: Request): string {
  const referer = request.headers.get('referer') ?? '';
  const match = referer.match(/\/(en|pt|es|fr|de|mk)\//);
  const locale = match?.[1];
  if (locale && (routing.locales as readonly string[]).includes(locale)) {
    return locale;
  }
  return routing.defaultLocale;
}
