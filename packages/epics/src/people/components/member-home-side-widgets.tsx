'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { MessageSquare, Phone, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Skeleton } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import type { Locale } from '@hypha-platform/i18n';
import type { MemberIntelligence } from '@hypha-platform/core/client';
import { useDisplayCurrency, useUserAssets } from '../../treasury/hooks';
import type { AssetItem } from '../../treasury/hooks/use-user-assets';
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
      className="flex flex-col border border-border bg-background p-4"
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

function AssetMark({ icon, symbol }: { icon: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  const letter = symbol.trim().slice(0, 1).toUpperCase();
  if (!icon || failed) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-neutral-4 text-1 text-foreground">
        {letter}
      </span>
    );
  }
  return (
    <img
      src={icon}
      alt=""
      className="h-5 w-5 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function MainAssets({ assets, lang }: { assets: AssetItem[]; lang: Locale }) {
  const main = assets.filter((asset) => asset.value > 0).slice(0, 3);
  if (main.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {main.map((asset) => (
        <li
          key={`${asset.slug}:${asset.symbol}:${asset.address ?? ''}`}
          className="flex items-center gap-2"
        >
          <AssetMark icon={asset.icon} symbol={asset.symbol} />
          <span className="min-w-0 flex-1 truncate text-2">{asset.symbol}</span>
          <span className="shrink-0 text-2 tabular-nums">
            {formatCurrencyValue(asset.value, lang)}
          </span>
        </li>
      ))}
    </ul>
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
  const {
    balance,
    assets,
    isLoading: isBalanceLoading,
  } = useUserAssets({
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
        <div>
          <p
            className="text-6 leading-none tracking-[-0.02em] tabular-nums"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {formatFromUsd(balance)}
          </p>
          <MainAssets assets={assets} lang={lang} />
        </div>
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
  people,
  isLoading,
  fallbackName,
  onChat,
  onCall,
  onVideo,
}: {
  people: HomeConnection[];
  isLoading: boolean;
  fallbackName: string;
  onChat?: (person: HomeConnection) => Promise<boolean>;
  onCall?: (person: HomeConnection) => Promise<boolean>;
  onVideo?: (person: HomeConnection) => Promise<boolean>;
}) {
  const t = useTranslations('MemberHome');
  const [visibleCount, setVisibleCount] = useState(5);
  const visiblePeople = people.slice(0, visibleCount);
  const remaining = people.length - visiblePeople.length;

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
          {visiblePeople.map((person) => {
            const name = personLabel(person, fallbackName);
            const label = t('sharedSpaces', {
              count: person.sharedSpaceCount,
            });
            return (
              <li
                key={person.id}
                className="flex min-w-[11rem] max-w-full flex-1 items-center gap-2"
              >
                <button
                  type="button"
                  title={`${name}. ${label}`}
                  aria-label={t('chatPerson', { name })}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline"
                  onClick={() => {
                    void onChat?.(person);
                  }}
                >
                  <PersonAvatar
                    avatarSrc={person.avatarUrl ?? undefined}
                    userName={name}
                    size="md"
                    shape="circle"
                  />
                  <span className="min-w-0 truncate text-2">{name}</span>
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    colorVariant="neutral"
                    aria-label={t('callPerson', { name })}
                    onClick={() => {
                      void onCall?.(person);
                    }}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    colorVariant="neutral"
                    aria-label={t('videoPerson', { name })}
                    onClick={() => {
                      void onVideo?.(person);
                    }}
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    colorVariant="neutral"
                    aria-label={t('chatPerson', { name })}
                    onClick={() => {
                      void onChat?.(person);
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!isLoading && remaining > 0 ? (
        <button
          type="button"
          className="mt-3 text-2 text-neutral-11 underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setVisibleCount((count) => count + 5)}
        >
          {t('showMore')}
        </button>
      ) : null}
    </Widget>
  );
}
