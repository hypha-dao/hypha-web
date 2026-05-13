import { getRequestConfig } from 'next-intl/server';
import { loadLocaleMessages, resolveLocale } from './messages';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = resolveLocale(requested);
  const { messages } = await loadLocaleMessages(locale);

  return {
    locale,
    messages,
  };
});
