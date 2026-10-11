'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { MessageSquare, Phone, Video } from 'lucide-react';
import {
  ERC20_TOKEN_TRANSFER_ADDRESSES,
  useJwt,
  useTransferTokensMutation,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { useUserAssets } from '../../treasury/hooks';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { PersonAvatar } from './person-avatar';

type HomeConnection = MemberIntelligence['connections'][number];
type HomeSpace = MemberIntelligence['spaces'][number];

const AMOUNTS = [5, 10, 25, 50, 100] as const;

type NoteKey =
  | 'sendTokensThanks'
  | 'sendTokensForTheWork'
  | 'sendTokensWithCare';

const NOTES: NoteKey[] = [
  'sendTokensThanks',
  'sendTokensForTheWork',
  'sendTokensWithCare',
];

function personName(
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

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

function WidgetFrame({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 flex-1 border border-border bg-background">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <h2
          className="text-4 leading-tight font-medium tracking-[-0.03em]"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {title}
        </h2>
        {aside ? (
          <p className="shrink-0 text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
            {aside}
          </p>
        ) : null}
      </header>
      <div className="px-4 pt-4 pb-4">{children}</div>
    </section>
  );
}

export function MemberHomeSpacesWidgetCard({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: HomeSpace[];
}) {
  const t = useTranslations('MemberHome');
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <WidgetFrame
      title={t('spacesWidgetTitle')}
      aside={
        spaces.length > 0
          ? t('spacesWidgetCount', { count: spaces.length })
          : undefined
      }
    >
      {spaces.length === 0 ? (
        <p className="text-2 text-neutral-11">{t('spacesWidgetEmpty')}</p>
      ) : (
        <>
          <div className="mb-4 overflow-hidden border border-border">
            <img
              src="/brand/strategy-mycelium.png"
              alt=""
              className="h-28 w-full object-cover object-center"
            />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {spaces.map((space) => {
              const icon = resolveSpaceDisplayLogoUrl(space, logoVariant);
              return (
                <li key={space.id}>
                  <Link
                    href={`/${lang}/dho/${space.slug}/overview`}
                    className="flex flex-col items-center gap-2 px-1 py-2 text-center hover:bg-accent-2"
                  >
                    <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border bg-background-2">
                      {icon ? (
                        <img
                          src={icon}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          className="text-3"
                          style={{ fontFamily: 'var(--font-family-heading)' }}
                        >
                          {space.title.trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-1 leading-snug">
                      {space.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-2 text-neutral-11">{t('spacesWidgetHint')}</p>
        </>
      )}
    </WidgetFrame>
  );
}

const PEOPLE_PREVIEW = 5;

export function MemberHomePeopleWidgetCard({
  people,
  fallbackName,
  onChat,
  onCall,
  onVideo,
}: {
  people: HomeConnection[];
  fallbackName: string;
  onChat: (person: HomeConnection) => void;
  onCall: (person: HomeConnection) => void;
  onVideo: (person: HomeConnection) => void;
}) {
  const t = useTranslations('MemberHome');
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? people : people.slice(0, PEOPLE_PREVIEW);
  const remaining = people.length - visible.length;

  return (
    <WidgetFrame title={t('peopleWidgetTitle')}>
      {people.length === 0 ? (
        <p className="text-2 text-neutral-11">{t('peopleWidgetEmpty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((person) => {
            const name = personName(person, fallbackName);
            return (
              <li
                key={person.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <PersonAvatar
                  avatarSrc={person.avatarUrl ?? undefined}
                  userName={name}
                  size="md"
                  shape="circle"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-2 font-medium">{name}</p>
                  <p className="truncate text-1 text-neutral-11">
                    {t('peopleWidgetShared', {
                      count: person.sharedSpaceCount,
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    className="h-9 w-9 p-0"
                    aria-label={t('chatPerson', { name })}
                    onClick={() => onChat(person)}
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    className="h-9 w-9 p-0"
                    aria-label={t('callPerson', { name })}
                    onClick={() => onCall(person)}
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    className="h-9 w-9 p-0"
                    aria-label={t('videoPerson', { name })}
                    onClick={() => onVideo(person)}
                  >
                    <Video className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {remaining > 0 ? (
        <button
          type="button"
          className="mt-3 text-1 text-neutral-11 underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setExpanded(true)}
        >
          {t('seeMoreNotifications')}
        </button>
      ) : null}
    </WidgetFrame>
  );
}

type TokenTarget =
  | { kind: 'person'; id: string; name: string; address: string }
  | { kind: 'space'; id: string; name: string; address: string };

export function MemberHomeSendTokensWidget({
  personSlug,
  hasWallet,
  people,
  spaces,
  fallbackName,
}: {
  personSlug: string;
  hasWallet: boolean;
  people: HomeConnection[];
  spaces: HomeSpace[];
  fallbackName: string;
}) {
  const t = useTranslations('MemberHome');
  const { resolvedTheme } = useTheme();
  const { jwt: authToken } = useJwt();
  const { assets, isLoading, manualUpdate } = useUserAssets({
    personSlug,
  });
  const { transferTokens, isTransferring } = useTransferTokensMutation({
    authToken,
  });
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(25);
  const [noteIndex, setNoteIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    amount: number;
    symbol: string;
    name: string;
    left: number;
  } | null>(null);

  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const tokens = useMemo(() => {
    return assets.filter((asset) => {
      const isTransferableType =
        (asset.type != null && !['ownership', 'voice'].includes(asset.type)) ||
        (asset.type == null &&
          asset.address !== undefined &&
          ERC20_TOKEN_TRANSFER_ADDRESSES.includes(asset.address));
      if (!isTransferableType || !asset.address) return false;
      const hasBalance = (asset.value ?? 0) > 0;
      const canDrawCredit = Boolean(
        asset.mutualCredit?.creditEligible &&
          asset.mutualCredit.creditLimitLeft > 0,
      );
      return hasBalance || canDrawCredit;
    });
  }, [assets]);

  const selected =
    tokens.find((token) => token.address === tokenAddress) ?? tokens[0] ?? null;
  const balance = selected?.value ?? 0;
  const creditLeft =
    selected?.mutualCredit?.creditEligible &&
    typeof selected.mutualCredit.creditLimitLeft === 'number'
      ? selected.mutualCredit.creditLimitLeft
      : 0;
  const spendable = balance + creditLeft;
  const choices = AMOUNTS.filter((value) => value <= spendable + 1e-9);
  const amountChoices =
    choices.length > 0
      ? [...choices]
      : spendable >= 0.01
      ? [Math.floor(spendable * 100) / 100]
      : [];
  const activeAmount = amountChoices.includes(amount)
    ? amount
    : amountChoices[0] ?? 0;

  const targets = useMemo(() => {
    const peopleTargets: TokenTarget[] = people.flatMap((person) => {
      const address = person.address?.trim();
      if (!address) return [];
      return [
        {
          kind: 'person' as const,
          id: `person-${person.id}`,
          name: personName(person, fallbackName),
          address,
        },
      ];
    });
    const spaceTargets: TokenTarget[] = spaces.flatMap((space) => {
      const address = space.address?.trim();
      if (!address) return [];
      return [
        {
          kind: 'space' as const,
          id: `space-${space.id}`,
          name: space.title,
          address,
        },
      ];
    });
    return [...peopleTargets, ...spaceTargets];
  }, [fallbackName, people, spaces]);
  const target = targets.find((item) => item.id === targetId) ?? null;
  const noteKey: NoteKey = NOTES[noteIndex] ?? 'sendTokensThanks';

  async function send() {
    if (!selected?.address || !target || activeAmount <= 0 || isTransferring) {
      return;
    }
    setError(null);
    try {
      await transferTokens({
        recipient: target.address,
        payouts: [
          {
            amount: String(activeAmount),
            token: selected.address,
          },
        ],
        memo: t(noteKey),
      });
      setSent({
        amount: activeAmount,
        symbol: selected.symbol,
        name: target.name,
        left: Math.max(0, balance - activeAmount),
      });
      try {
        await manualUpdate();
      } catch {
        // The transfer already landed. The balance refreshes on the next poll.
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('Smart wallet client not available')) {
        setError(t('sendTokensNoWallet'));
      } else {
        setError(t('sendTokensFailed'));
      }
    }
  }

  if (sent && selected) {
    return (
      <WidgetFrame title={t('sendTokensTitle')}>
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center border border-border text-3">
            ✓
          </span>
          <p
            className="mt-4 text-4 font-medium tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('sendTokensArrived', {
              amount: formatAmount(sent.amount),
              symbol: sent.symbol,
              name: sent.name,
            })}
          </p>
          <p className="mt-2 text-2 text-neutral-11">{t('sendTokensSigned')}</p>
          <p className="mt-4 text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
            {t('sendTokensLeft', {
              amount: formatAmount(sent.left),
              symbol: sent.symbol,
            })}
          </p>
        </div>
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={t('sendTokensTitle')}>
      {isLoading ? (
        <p className="text-2 text-neutral-11">{t('loading')}</p>
      ) : tokens.length === 0 ? (
        <p className="text-2 text-neutral-11">
          {hasWallet ? t('sendTokensNone') : t('sendTokensNoWallet')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="grid gap-1">
            {tokens.map((token) => {
              const active = token.address === selected?.address;
              return (
                <li key={token.address}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-3 border px-3 py-2 text-left',
                      active
                        ? 'border-foreground bg-accent-2'
                        : 'border-border hover:bg-accent-2',
                    )}
                    onClick={() => {
                      setTokenAddress(token.address ?? null);
                      setSent(null);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {token.icon ? (
                        <img
                          src={token.icon}
                          alt=""
                          className="h-5 w-5 shrink-0"
                        />
                      ) : null}
                      <span className="truncate text-2 font-medium">
                        {token.symbol}
                      </span>
                    </span>
                    <span className="shrink-0 text-2 tabular-nums">
                      {formatAmount(token.value)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div>
            <p className="text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
              {t('sendTokensTo')}
            </p>
            {targets.length === 0 ? (
              <p className="mt-2 text-2 text-neutral-11">
                {t('sendTokensNoOne')}
              </p>
            ) : (
              <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {targets.map((item) => {
                  const active = item.id === target?.id;
                  const person = people.find(
                    (entry) => `person-${entry.id}` === item.id,
                  );
                  const space = spaces.find(
                    (entry) => `space-${entry.id}` === item.id,
                  );
                  const icon = space
                    ? resolveSpaceDisplayLogoUrl(space, logoVariant)
                    : null;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full flex-col items-center gap-1 px-1 py-2',
                          active ? 'bg-accent-2' : 'hover:bg-accent-2',
                        )}
                        onClick={() => setTargetId(item.id)}
                      >
                        {person ? (
                          <PersonAvatar
                            avatarSrc={person.avatarUrl ?? undefined}
                            userName={item.name}
                            size="md"
                            shape="circle"
                          />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-background-2 text-1">
                            {icon ? (
                              <img
                                src={icon}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              item.name.trim().charAt(0).toUpperCase()
                            )}
                          </span>
                        )}
                        <span className="line-clamp-2 w-full text-center text-[11px] leading-tight">
                          {item.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selected ? (
            <div className="text-center">
              <p
                className="text-8 leading-none tabular-nums tracking-[-0.04em]"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {formatAmount(activeAmount)}
                <button
                  type="button"
                  className="ml-2 align-middle text-2 tracking-[0.14em] uppercase underline decoration-border underline-offset-4"
                  onClick={() => {
                    const index = tokens.findIndex(
                      (token) => token.address === selected.address,
                    );
                    const next = tokens[(index + 1) % tokens.length];
                    if (next?.address) setTokenAddress(next.address);
                  }}
                >
                  {selected.symbol}
                </button>
              </p>
              <p className="mt-2 text-1 text-neutral-11">
                {t('sendTokensYouHave', {
                  amount: formatAmount(balance),
                  symbol: selected.symbol,
                })}
              </p>
            </div>
          ) : null}

          {amountChoices.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {amountChoices.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'h-10 min-w-10 border px-3 text-2 tabular-nums',
                    value === activeAmount
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:bg-accent-2',
                  )}
                  onClick={() => setAmount(value)}
                >
                  {formatAmount(value)}
                </button>
              ))}
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={
              !hasWallet ||
              !target ||
              !selected ||
              activeAmount <= 0 ||
              isTransferring
            }
            onClick={() => {
              void send();
            }}
          >
            {isTransferring
              ? t('loading')
              : target
              ? t('sendTokensSend', {
                  amount: formatAmount(activeAmount),
                  symbol: selected?.symbol ?? '',
                  name: target.name,
                })
              : t('sendTokensPickFirst')}
          </Button>
          <button
            type="button"
            className="text-center text-1 text-neutral-11"
            onClick={() => setNoteIndex((index) => (index + 1) % NOTES.length)}
          >
            {t(noteKey)}
            <span className="text-neutral-10">
              {' '}
              · {t('sendTokensChangeNote')}
            </span>
          </button>
          {error ? (
            <p className="text-2 text-error-11" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </WidgetFrame>
  );
}
