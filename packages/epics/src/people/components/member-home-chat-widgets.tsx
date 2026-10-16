'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { ClientEvent, RoomEvent, SyncState } from 'matrix-js-sdk';
import { Check, ChevronDown, MessageSquare, Phone, Video } from 'lucide-react';
import {
  ERC20_TOKEN_TRANSFER_ADDRESSES,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useTransferTokensMutation,
  type MemberIntelligence,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import { listTransferRecipientPeople } from '@hypha-platform/core/people/server/actions';
import type { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { Recipient } from '../../agreements/plugins/components/common/recipient';
import { useUserAssets } from '../../treasury/hooks';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import {
  memberRowsForConnections,
  STALE_CONNECTION_MS,
  suggestConnections,
  type ConnectionSuggestion,
  type ConversationRow,
  type NewcomerCandidate,
} from './member-connections';
import { sortByPresenceThenShared } from './member-presence';
import { PersonAvatar } from './person-avatar';
import { PresenceDot } from './presence-dot';
import { readConversationRows } from './my-connections';
import { useMemberPresence } from './use-member-presence';

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

function suggestionWhen(ts: number, locale: string, justNow: string) {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return justNow;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, 'day');
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(ts);
}

function newcomersFromSignals(
  signals: MemberIntelligence['networkSignals'],
  selfId: number | null,
): NewcomerCandidate[] {
  const newcomers: NewcomerCandidate[] = [];
  const seen = new Set<number>();
  for (const signal of signals ?? []) {
    const id = signal.creatorId;
    const name = signal.creatorName?.trim();
    if (id == null || !name || id === selfId || seen.has(id)) continue;
    seen.add(id);
    newcomers.push({
      id,
      name,
      avatarUrl: signal.creatorAvatarUrl,
      spaceTitle: signal.spaceTitle,
      spaceSlug: signal.spaceSlug,
      score: signal.relevance?.score ?? 0,
    });
  }
  return newcomers;
}

export function MemberHomePeopleWidgetCard({
  people,
  networkSignals,
  selfId,
  fallbackName,
  onChat,
  onCall,
  onVideo,
}: {
  people: HomeConnection[];
  networkSignals?: MemberIntelligence['networkSignals'];
  selfId?: number | null;
  fallbackName: string;
  onChat: (person: HomeConnection) => void;
  onCall: (person: HomeConnection) => void;
  onVideo: (person: HomeConnection) => void;
}) {
  const t = useTranslations('MemberHome');
  const tConnections = useTranslations('Connections');
  const locale = useLocale();
  const { client } = useMatrix();
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [synced, setSynced] = useState(false);
  const personIds = useMemo(() => people.map((person) => person.id), [people]);
  const { presenceById } = useMemberPresence(personIds);
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({ personIds });
  const ranked = useMemo(
    () => sortByPresenceThenShared(people, presenceById),
    [people, presenceById],
  );

  useEffect(() => {
    if (!client) {
      setRows([]);
      setSynced(false);
      return;
    }
    const refresh = () => {
      setRows(readConversationRows(client));
      const state = client.getSyncState();
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        setSynced(true);
      }
    };
    refresh();
    const onSync = () => {
      refresh();
      setSynced(true);
    };
    client.on(ClientEvent.Sync, onSync);
    client.on(RoomEvent.Timeline, refresh);
    client.on(RoomEvent.Receipt, refresh);
    client.on(RoomEvent.MyMembership, refresh);
    return () => {
      client.removeListener(ClientEvent.Sync, onSync);
      client.removeListener(RoomEvent.Timeline, refresh);
      client.removeListener(RoomEvent.Receipt, refresh);
      client.removeListener(RoomEvent.MyMembership, refresh);
    };
  }, [client]);

  const suggestions = useMemo(() => {
    const newcomers = newcomersFromSignals(networkSignals, selfId ?? null);
    if (!synced) {
      return suggestConnections([], newcomers, Date.now()).filter(
        (card) => card.kind === 'meet',
      );
    }
    const members = memberRowsForConnections(
      people,
      rows,
      personIdToMatrixUserId,
      selfId ?? null,
      fallbackName,
    );
    return suggestConnections(
      members,
      newcomers,
      Date.now(),
      STALE_CONNECTION_MS,
    );
  }, [
    fallbackName,
    networkSignals,
    people,
    personIdToMatrixUserId,
    rows,
    selfId,
    synced,
  ]);

  const openSuggestion = (card: ConnectionSuggestion) => {
    const known = people.find((person) => person.id === card.person.id);
    onChat(
      known ?? {
        id: card.person.id,
        slug: card.person.slug ?? null,
        name: card.person.name,
        surname: card.person.surname,
        nickname: card.person.nickname,
        avatarUrl: card.person.avatarUrl ?? null,
        sharedSpaceCount: card.sharedSpaceCount,
      },
    );
  };
  const visible = expanded ? ranked : ranked.slice(0, PEOPLE_PREVIEW);
  const remaining = ranked.length - visible.length;

  const actions = [
    {
      key: 'chat',
      label: (name: string) => t('chatPerson', { name }),
      icon: MessageSquare,
      run: onChat,
    },
    {
      key: 'call',
      label: (name: string) => t('callPerson', { name }),
      icon: Phone,
      run: onCall,
    },
    {
      key: 'video',
      label: (name: string) => t('videoPerson', { name }),
      icon: Video,
      run: onVideo,
    },
  ] as const;

  return (
    <WidgetFrame
      title={t('peopleWidgetTitle')}
      aside={people.length > 0 ? String(people.length) : undefined}
    >
      {suggestions.length > 0 ? (
        <section
          className="mb-4 flex flex-col gap-3"
          aria-label={tConnections('reachOut')}
        >
          <div className="flex flex-col gap-1">
            <h3 className="text-2 font-medium text-foreground">
              {tConnections('reachOut')}
            </h3>
            <p className="text-1 text-neutral-11">
              {tConnections('suggestSentence')}
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {suggestions.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => openSuggestion(card)}
                className="flex w-40 shrink-0 flex-col items-start gap-2 border border-border p-3 text-left hover:bg-accent-2"
              >
                <PersonAvatar
                  size="chat"
                  shape="circle"
                  avatarSrc={card.avatarUrl}
                  userName={card.name}
                />
                <span className="w-full truncate text-2 text-foreground">
                  {card.name}
                </span>
                <span className="text-1 text-foreground">
                  {card.kind === 'reconnect'
                    ? tConnections('longTimeNoSee')
                    : tConnections('worthMeeting')}
                </span>
                <span className="w-full truncate text-1 text-neutral-11">
                  {card.kind === 'reconnect'
                    ? card.lastTs
                      ? suggestionWhen(
                          card.lastTs,
                          locale,
                          tConnections('justNow'),
                        )
                      : tConnections('noMessage')
                    : card.spaceTitle
                    ? card.spaceTitle
                    : card.sharedSpaceCount > 0
                    ? tConnections('sharedCount', {
                        count: card.sharedSpaceCount,
                      })
                    : tConnections('noMessage')}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {people.length === 0 && suggestions.length === 0 ? (
        <p className="text-2 text-neutral-11">{t('peopleWidgetEmpty')}</p>
      ) : null}
      {people.length > 0 ? (
        <ul>
          {visible.map((person) => {
            const name = personName(person, fallbackName);
            const presence = presenceById.get(person.id) ?? 'offline';
            return (
              <li
                key={person.id}
                className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={t('chatPerson', { name })}
                  onClick={() => onChat(person)}
                >
                  <span className="relative inline-flex shrink-0">
                    <PersonAvatar
                      avatarSrc={person.avatarUrl ?? undefined}
                      userName={name}
                      size="md"
                      shape="circle"
                    />
                    <PresenceDot level={presence} size="sm" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-2 hover:underline">
                      {name}
                    </span>
                    <span className="mt-0.5 block truncate text-1 text-neutral-11">
                      {t('peopleWidgetShared', {
                        count: person.sharedSpaceCount,
                      })}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 border border-border">
                  {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.key}
                        type="button"
                        className="grid h-8 w-8 place-items-center border-r border-border text-foreground last:border-r-0 hover:bg-accent-2"
                        aria-label={action.label(name)}
                        onClick={() => action.run(person)}
                      >
                        <Icon
                          className="size-3.5"
                          strokeWidth={1.25}
                          aria-hidden
                        />
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {remaining > 0 ? (
        <button
          type="button"
          className="mt-1 w-full border-t border-border py-3 text-left text-1 text-neutral-11 hover:text-foreground"
          onClick={() => setExpanded(true)}
        >
          {t('seeMore')}
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
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(25);
  const [noteIndex, setNoteIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryPeople, setDirectoryPeople] = useState<Person[] | null>(null);
  const [directorySpaces, setDirectorySpaces] = useState<Space[] | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [picked, setPicked] = useState<TokenTarget | null>(null);
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
  const visibleTargets = useMemo(() => {
    if (
      picked &&
      !targets.some(
        (item) => item.address.toLowerCase() === picked.address.toLowerCase(),
      )
    ) {
      return [picked, ...targets];
    }
    return targets;
  }, [picked, targets]);
  const target =
    targets.find((item) => item.id === targetId) ??
    (picked?.id === targetId ? picked : null);
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
      } else if (message.toLowerCase().includes('user rejected')) {
        setError(t('sendTokensRejected'));
      } else {
        setError(t('sendTokensFailed'));
      }
    }
  }

  async function openDirectory() {
    if (directoryOpen) {
      setDirectoryOpen(false);
      return;
    }
    setDirectoryOpen(true);
    setError(null);
    if (directoryPeople && directorySpaces) return;
    setDirectoryLoading(true);
    try {
      const [peopleRows, spaceResponse] = await Promise.all([
        listTransferRecipientPeople(),
        fetch('/api/v1/spaces?parentOnly=false'),
      ]);
      if (!spaceResponse.ok) {
        throw new Error('spaces');
      }
      const spaceRows = (await spaceResponse.json()) as Space[];
      if (!Array.isArray(spaceRows)) {
        throw new Error('spaces');
      }
      setDirectoryPeople(
        peopleRows.map((person) => ({
          id: person.id,
          name: person.name,
          surname: person.surname,
          avatarUrl: person.avatarUrl ?? undefined,
          address: person.address,
          slug: person.slug,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        })),
      );
      setDirectorySpaces(
        spaceRows.filter((space) => Boolean(space.address?.trim())),
      );
    } catch {
      setDirectoryOpen(false);
      setError(t('sendTokensDirectoryFailed'));
    } finally {
      setDirectoryLoading(false);
    }
  }

  function chooseFromDirectory(choice: Person | Space | { address: string }) {
    const address = choice.address?.trim() ?? '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;
    const known = targets.find(
      (item) => item.address.toLowerCase() === address.toLowerCase(),
    );
    if (known) {
      setTargetId(known.id);
      setPicked(null);
    } else {
      const isSpace = 'title' in choice && typeof choice.title === 'string';
      const name = isSpace
        ? choice.title
        : `${'name' in choice ? choice.name ?? '' : ''} ${
            'surname' in choice ? choice.surname ?? '' : ''
          }`.trim() || address;
      const next: TokenTarget = {
        kind: isSpace ? 'space' : 'person',
        id: `directory-${address.toLowerCase()}`,
        name,
        address,
      };
      setPicked(next);
      setTargetId(next.id);
    }
    setDirectoryOpen(false);
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
          <div>
            <p className="text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
              {t('sendTokensTo')}
            </p>
            {visibleTargets.length === 0 ? (
              <p className="mt-2 text-2 text-neutral-11">
                {t('sendTokensNoOne')}
              </p>
            ) : (
              <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {visibleTargets.map((item) => {
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
                        aria-pressed={active}
                        className={cn(
                          'flex w-full flex-col items-center gap-1 border px-1 py-2',
                          active
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-transparent hover:bg-accent-2',
                        )}
                        onClick={() => setTargetId(item.id)}
                      >
                        <span className="relative inline-flex">
                          {person ? (
                            <PersonAvatar
                              avatarSrc={person.avatarUrl ?? undefined}
                              userName={item.name}
                              size="md"
                              shape="circle"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-background-2 text-1 text-foreground">
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
                          {active ? (
                            <span
                              className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-background text-foreground"
                              aria-hidden
                            >
                              <Check className="size-2.5" strokeWidth={3} />
                            </span>
                          ) : null}
                        </span>
                        <span className="line-clamp-2 w-full text-center text-[11px] leading-tight">
                          {item.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              disabled={directoryLoading || isTransferring}
              onClick={() => {
                void openDirectory();
              }}
            >
              {t('sendTokensSeeMore')}
            </Button>
            {directoryOpen && directoryPeople && directorySpaces ? (
              <div className="mt-3 border border-border p-3">
                <Recipient
                  members={directoryPeople}
                  spaces={directorySpaces}
                  value={target?.address}
                  onChange={chooseFromDirectory}
                />
              </div>
            ) : null}
          </div>

          {selected ? (
            <div className="text-center">
              <div
                className="text-8 leading-none tabular-nums tracking-[-0.04em]"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {formatAmount(activeAmount)}
                {tokens.length > 1 ? (
                  <Popover open={tokenMenuOpen} onOpenChange={setTokenMenuOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={t('sendTokensChoose', {
                          symbol: selected.symbol,
                        })}
                        className="ml-2 inline-flex items-center gap-1 align-middle text-2 tracking-[0.14em] uppercase"
                      >
                        {selected.symbol}
                        <ChevronDown
                          aria-hidden
                          strokeWidth={1.5}
                          className={cn(
                            'size-3.5 text-neutral-10 transition-transform',
                            tokenMenuOpen && 'rotate-180',
                          )}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="center"
                      className="w-64 rounded-none border-border bg-background p-1 text-foreground shadow-md"
                    >
                      <ul className="max-h-64 overflow-y-auto">
                        {tokens.map((token) => {
                          const active = token.address === selected.address;
                          return (
                            <li key={token.address}>
                              <button
                                type="button"
                                className={cn(
                                  'flex w-full items-center gap-3 px-3 py-2 text-left',
                                  active ? 'bg-accent-2' : 'hover:bg-accent-2',
                                )}
                                onClick={() => {
                                  setTokenAddress(token.address ?? null);
                                  setSent(null);
                                  setTokenMenuOpen(false);
                                }}
                              >
                                {token.icon ? (
                                  <img
                                    src={token.icon}
                                    alt=""
                                    className="h-5 w-5 shrink-0"
                                  />
                                ) : (
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-border text-[10px]">
                                    {token.symbol.trim().charAt(0)}
                                  </span>
                                )}
                                <span className="min-w-0 truncate text-2 font-medium tracking-[0.08em] uppercase">
                                  {token.symbol}
                                </span>
                                <span className="ml-auto shrink-0 text-2 tabular-nums text-neutral-11">
                                  {formatAmount(token.value)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="ml-2 align-middle text-2 tracking-[0.14em] uppercase">
                    {selected.symbol}
                  </span>
                )}
              </div>
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
              ? t('sendTokensSigning')
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
