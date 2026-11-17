import 'server-only';
import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';
import { loadLocaleMessages } from '@hypha-platform/i18n/messages';
import { routing } from '@hypha-platform/i18n/routing';
import {
  AUTH_SERVER_LANG_COOKIE,
  resolveAuthLocale,
} from '@hypha-platform/auth-server/client';
import { LocaleSync } from './locale-sync';

/**
 * Language of the login and consent pages. These pages have one path for everyone (no
 * `/<lang>/` prefix), so the language comes from the person: `?lang=`, the cookie that remembers
 * it, the browser's Accept-Language, then English. Only the AuthServer messages are sent to the
 * browser.
 */
export type AuthIntl = {
  locale: string;
  /** The language came from `?lang=`: remember it for the next page. */
  persist: boolean;
  messages: AbstractIntlMessages;
};

const NAMESPACE = 'AuthServer';

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export async function loadAuthIntl(options?: {
  /** A `lang` the caller has already separated from the signed authorization query. */
  lang?: string | null;
}): Promise<AuthIntl> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const { locale, fromParam } = resolveAuthLocale({
    lang: options?.lang ?? null,
    cookie: cookieStore.get(AUTH_SERVER_LANG_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    supported: routing.locales,
    fallback: routing.defaultLocale,
  });
  const { messages } = await loadLocaleMessages(locale);
  return {
    locale,
    persist: fromParam,
    messages: { [NAMESPACE]: messages[NAMESPACE] } as AbstractIntlMessages,
  };
}

/** `?lang=` of a page that has no signed query to protect (the login page). */
export const langParam = (raw: Record<string, string | string[] | undefined>) =>
  first(raw.lang) ?? null;

/** For server components: the same messages, as a translator. */
export function authTranslator(intl: AuthIntl) {
  return createTranslator({
    locale: intl.locale,
    messages: intl.messages,
    namespace: NAMESPACE,
  });
}

export function AuthIntlProvider({
  intl,
  children,
}: {
  intl: AuthIntl;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={intl.locale} messages={intl.messages}>
      <LocaleSync locale={intl.locale} persist={intl.persist} />
      {children}
    </NextIntlClientProvider>
  );
}
