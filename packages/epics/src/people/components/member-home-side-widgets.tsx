'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button, Skeleton } from '@hypha-platform/ui';
import type { Locale } from '@hypha-platform/i18n';
import type { MemberIntelligence } from '@hypha-platform/core/client';
import { useDisplayCurrency, useUserAssets } from '../../treasury/hooks';
import { PersonAvatar } from './person-avatar';

type HomeConnection = MemberIntelligence['connections'][number];

function Widget({
  title,
  busy = false,
  children,
  action,
}: {
  title: string;
  busy?: boolean;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      aria-busy={busy || undefined}
      className="flex flex-col border border-border bg-background/80 p-4"
    >
      <h2
        className="text-3"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h2>
      <div className="mt-3">{children}</div>
      {action}
    </section>
  );
}

function WidgetAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button asChild className="mt-4 w-full">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function personLabel(
  person: {
    name: string | null;
    surname: string | null;
    nickname: string | null;
  },
  fallback: string,
) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

export function MemberHomeWalletWidget({
  lang,
  personSlug,
  hasAddress,
  isHomeLoading,
}: {
  lang: Locale;
  personSlug?: string;
  hasAddress: boolean;
  isHomeLoading: boolean;
}) {
  const t = useTranslations('MemberHome');
  const { balance, isLoading: isBalanceLoading } = useUserAssets({
    personSlug,
  });
  const { formatFromUsd } = useDisplayCurrency();
  const showBalance = hasAddress && !isHomeLoading && !isBalanceLoading;

  return (
    <Widget
      title={t('wallet')}
      busy={isHomeLoading || (hasAddress && isBalanceLoading)}
      action={
        <WidgetAction href={`/${lang}/my-wallet`}>
          {t('openMyWallet')}
        </WidgetAction>
      }
    >
      {isHomeLoading ? (
        <Skeleton loading height="36px" width="9rem" />
      ) : showBalance ? (
        <p
          className="text-6 leading-none tracking-[-0.02em] tabular-nums"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {formatFromUsd(balance)}
        </p>
      ) : hasAddress ? (
        <Skeleton loading height="36px" width="9rem" />
      ) : (
        <p className="text-2 text-neutral-11">{t('walletEmpty')}</p>
      )}
    </Widget>
  );
}

export function MemberHomeSpacesWidget({
  lang,
  busy = false,
  children,
}: {
  lang: Locale;
  busy?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('MemberHome');

  return (
    <Widget
      title={t('spaces')}
      busy={busy}
      action={
        <WidgetAction href={`/${lang}/my-spaces`}>
          {t('openMySpaces')}
        </WidgetAction>
      }
    >
      {children}
    </Widget>
  );
}

export function MemberHomeConnectionsWidget({
  lang,
  people,
  isLoading,
  fallbackName,
}: {
  lang: Locale;
  people: HomeConnection[];
  isLoading: boolean;
  fallbackName: string;
}) {
  const t = useTranslations('MemberHome');

  return (
    <Widget title={t('connections')} busy={isLoading}>
      {isLoading ? (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              loading
              height="32px"
              width="32px"
              className="rounded-full"
            />
          ))}
        </div>
      ) : people.length === 0 ? (
        <p className="text-2 text-neutral-11">{t('noConnections')}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {people.map((person) => {
            const name = personLabel(person, fallbackName);
            const href = person.slug ? `/${lang}/profile/${person.slug}` : null;
            const label = t('sharedSpaces', {
              count: person.sharedSpaceCount,
            });
            const hoverLabel = `${name}. ${label}`;
            const portrait = (
              <>
                <PersonAvatar
                  avatarSrc={person.avatarUrl ?? undefined}
                  userName={name}
                  size="md"
                  shape="circle"
                />
                <span className="min-w-0 truncate text-2">{name}</span>
              </>
            );

            return (
              <li key={person.id} className="max-w-full min-w-[8.5rem] flex-1">
                {href ? (
                  <Link
                    href={href}
                    title={hoverLabel}
                    aria-label={hoverLabel}
                    className="flex min-w-0 items-center gap-2 hover:underline"
                  >
                    {portrait}
                  </Link>
                ) : (
                  <span
                    title={hoverLabel}
                    className="flex min-w-0 items-center gap-2"
                  >
                    {portrait}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}
