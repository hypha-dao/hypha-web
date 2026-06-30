import { getRequestConfig } from 'next-intl/server';
import { loadLocaleMessages, resolveLocale } from './messages';
import { resolveRequestTimeZone } from './local-date-time';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = resolveLocale(requested);
  const { messages } = await loadLocaleMessages(locale);
  const timeZone = await resolveRequestTimeZone();

  return {
    locale,
    messages,
    timeZone,
  };
});
