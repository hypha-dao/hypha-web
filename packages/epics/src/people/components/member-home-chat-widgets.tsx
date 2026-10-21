'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { SyncState } from 'matrix-js-sdk';
import {
  Check,
  ChevronDown,
  MessageSquare,
  Phone,
  Plus,
  Video,
} from 'lucide-react';
import './member-home-sent-tick.css';
import {
  ERC20_TOKEN_TRANSFER_ADDRESSES,
  useJwt,
  useMe,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useTransferTokensMutation,
  type MemberIntelligence,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import type { AssetItem } from '../../treasury/hooks/use-user-assets';
import {
  HYPHA_TOKEN_ADDRESS,
  isHyphaAsset,
} from '../../wallet/components/wallet-asset-action';
import type { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  formatWalletAmount,
  WalletHoldingLine,
} from '../../common/wallet-flow-card';

import { Recipient } from '../../agreements/plugins/components/common/recipient';
import { useFundWallet, useUserAssets } from '../../treasury/hooks';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { MySpacesSwitcherMenu } from '../../spaces/components/my-spaces-switcher-menu';
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
import {
  attachConversationList,
  conversationRowsSnapshot,
  prioritizeConversationRooms,
} from './my-connections';
import { useMemberPresence } from './use-member-presence';

type HomeConnection = MemberIntelligence['connections'][number];
type HomeSpace = MemberIntelligence['spaces'][number];

const AMOUNTS = [5, 10, 25, 50, 100] as const;
const AMOUNT_INPUT = /^\d*\.?\d{0,2}$/;
const SPACE_PREVIEW = 5;
/** Quick picks. A wide screen wraps these into rows instead of one strip. */
const RECIPIENT_PREVIEW = 10;

function recipientProfileRank(person: {
  name?: string | null;
  surname?: string | null;
  avatarUrl?: string | null;
}) {
  const named = Boolean(person.name?.trim() && person.surname?.trim());
  const photo = Boolean(person.avatarUrl?.trim());
  if (named && photo) return 2;
  if (named) return 1;
  return 0;
}

/** Stable shuffle so a fallback row does not jump on every render. */
function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap] as T;
    copy[swap] = current as T;
  }
  return copy;
}

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
  framed = true,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
  framed?: boolean;
}) {
  return (
    <section
      className={cn(
        'min-w-0 flex-1',
        framed && 'border border-border bg-background',
      )}
    >
      {framed ? (
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
      ) : null}
      <div className={cn(framed ? 'px-4 pt-4 pb-4' : undefined)}>
        {children}
      </div>
    </section>
  );
}

export function MemberHomeSpacesWidgetCard({
  lang,
  spaces,
  framed = true,
  limit = SPACE_PREVIEW,
}: {
  lang: Locale;
  spaces: HomeSpace[];
  /** Card chrome on home. The spaces screen supplies its own title. */
  framed?: boolean;
  /** Cap the grid and offer the finder. Null shows every space. */
  limit?: number | null;
}) {
  const t = useTranslations('MemberHome');
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [finderOpen, setFinderOpen] = useState(false);
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() =>
    readRecentSpaceSlugs(),
  );

  useEffect(() => subscribeRecentSpaceSlugs(setRecentSlugs), []);

  const recentSpaces = useMemo(() => {
    const bySlug = new Map(spaces.map((space) => [space.slug, space]));
    const ordered: HomeSpace[] = [];
    const seen = new Set<string>();
    for (const slug of recentSlugs) {
      const space = bySlug.get(slug);
      if (!space || seen.has(space.slug)) continue;
      ordered.push(space);
      seen.add(space.slug);
    }
    for (const space of spaces) {
      if (seen.has(space.slug)) continue;
      ordered.push(space);
      seen.add(space.slug);
    }
    return ordered;
  }, [recentSlugs, spaces]);
  const shown = limit == null ? recentSpaces : recentSpaces.slice(0, limit);

  const body =
    spaces.length === 0 ? (
      <p className="text-2 text-neutral-11">{t('spacesWidgetEmpty')}</p>
    ) : (
      <>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shown.map((space) => {
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
        {limit != null && spaces.length > limit ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              aria-expanded={finderOpen}
              onClick={() => setFinderOpen((open) => !open)}
            >
              {t('spacesFindMore')}
            </Button>
            {finderOpen ? (
              <div className="mt-3 h-72 overflow-hidden border border-border">
                <MySpacesSwitcherMenu
                  open={finderOpen}
                  onSelect={() => setFinderOpen(false)}
                />
              </div>
            ) : null}
          </>
        ) : null}
        <p className="mt-3 text-2 text-neutral-11">{t('spacesWidgetHint')}</p>
      </>
    );

  if (!framed) return body;

  return (
    <WidgetFrame
      title={t('spacesWidgetTitle')}
      aside={
        spaces.length > 0
          ? t('spacesWidgetCount', { count: spaces.length })
          : undefined
      }
    >
      {body}
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
  const matrixIdsRef = useRef(personIdToMatrixUserId);
  matrixIdsRef.current = personIdToMatrixUserId;
  const visibleMatrixKey = useMemo(
    () =>
      Object.values(personIdToMatrixUserId)
        .filter((id): id is string => Boolean(id))
        .sort()
        .join('\n'),
    [personIdToMatrixUserId],
  );
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
    return attachConversationList(client, () => {
      setRows((current) => {
        const next = conversationRowsSnapshot(client);
        if (
          current.length === next.length &&
          current.every((row, index) => row === next[index])
        ) {
          return current;
        }
        return next;
      });
      const state = client.getSyncState();
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        setSynced(true);
      }
    });
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const ids = Object.values(matrixIdsRef.current).filter((id): id is string =>
      Boolean(id),
    );
    prioritizeConversationRooms(client, ids);
  }, [client, visibleMatrixKey]);

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
          <div className="flex gap-3 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  personId={card.person.id}
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
                  <PersonAvatar
                    avatarSrc={person.avatarUrl ?? undefined}
                    userName={name}
                    size="md"
                    shape="circle"
                    personId={person.id}
                    presence={presence}
                  />
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

type TokenLine = {
  id: string;
  tokenAddress: string | null;
  amount: string;
};

/** Everyone can send HYPHA. A zero balance still belongs on the form. */
const HYPHA_SEND_TOKEN: AssetItem = {
  icon: '/placeholder/hypha-token-icon.svg',
  name: 'Hypha',
  symbol: 'HYPHA',
  value: 0,
  usdEqual: 0,
  type: 'utility',
  chartData: [],
  transactions: [],
  closeUrl: '',
  slug: 'hypha',
  address: HYPHA_TOKEN_ADDRESS,
};

function tokenSpendable(
  token:
    | {
        value?: number | null;
        mutualCredit?: {
          creditEligible?: boolean;
          creditLimitLeft?: number;
        } | null;
      }
    | null
    | undefined,
) {
  const balance = token?.value ?? 0;
  const creditLeft =
    token?.mutualCredit?.creditEligible &&
    typeof token.mutualCredit.creditLimitLeft === 'number'
      ? token.mutualCredit.creditLimitLeft
      : 0;
  return { balance, creditLeft, spendable: balance + creditLeft };
}

function SentTick() {
  return (
    <span className="sent-tick text-foreground" aria-hidden>
      <svg viewBox="0 0 48 48">
        <circle className="sent-tick-ring" cx="24" cy="24" r="18" />
        <path className="sent-tick-mark" d="M15.5 24.5 L21.2 30.2 L33 17.5" />
      </svg>
    </span>
  );
}

export function MemberHomeSendTokensWidget({
  personSlug,
  hasWallet,
  people,
  spaces,
  fallbackName,
  framed = true,
  initialTokenAddress,
  initialRecipient,
}: {
  personSlug: string;
  hasWallet: boolean;
  people: HomeConnection[];
  spaces: HomeSpace[];
  fallbackName: string;
  /** Home keeps the card. The wallet page is already the screen. */
  framed?: boolean;
  /** Prefill from a wallet asset card (`?token=`). */
  initialTokenAddress?: string;
  /** Prefill the space being funded (`?to=` + `?name=`). */
  initialRecipient?: { address: string; name: string };
}) {
  const t = useTranslations('MemberHome');
  const tWallet = useTranslations('MyWallet');
  const { resolvedTheme } = useTheme();
  const { client } = useMatrix();
  const [conversationRows, setConversationRows] = useState<ConversationRow[]>(
    [],
  );
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryPeople, setDirectoryPeople] = useState<Person[] | null>(null);
  const [directorySpaces, setDirectorySpaces] = useState<Space[] | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [closestPeople, setClosestPeople] = useState<HomeConnection[] | null>(
    null,
  );
  const directoryShuffleSeed = useRef(
    Math.floor(Math.random() * 0x7fffffff) + 1,
  );
  const connectionIds = useMemo(
    () => people.map((entry) => entry.id),
    [people],
  );
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({
    personIds: connectionIds,
  });
  const { jwt: authToken, isLoadingJwt } = useJwt();
  const locale = useLocale();
  const { person } = useMe();
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}` | undefined,
  });
  const { assets, isLoading, manualUpdate } = useUserAssets({
    personSlug,
  });
  const { transferTokens, isTransferring } = useTransferTokensMutation({
    authToken,
  });
  const lineSeq = useRef(1);
  const recipientTouched = useRef(false);
  const [lines, setLines] = useState<TokenLine[]>([
    { id: 'line-1', tokenAddress: null, amount: '' },
  ]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fundingKind, setFundingKind] = useState<'funds' | 'hypha' | null>(
    null,
  );
  const [picked, setPicked] = useState<TokenTarget | null>(null);
  const [sent, setSent] = useState<{
    count: number;
    amount: number;
    symbol: string;
    name: string;
    left: number | null;
  } | null>(null);

  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const tokens = useMemo(() => {
    const listed = assets.filter((asset) => {
      const hypha = isHyphaAsset(asset);
      const isTransferableType =
        (asset.type != null && !['ownership', 'voice'].includes(asset.type)) ||
        (asset.type == null &&
          asset.address !== undefined &&
          ERC20_TOKEN_TRANSFER_ADDRESSES.includes(asset.address)) ||
        hypha;
      if (!isTransferableType || !asset.address) return false;
      if (hypha) return true;
      const hasBalance = (asset.value ?? 0) > 0;
      const canDrawCredit = Boolean(
        asset.mutualCredit?.creditEligible &&
          asset.mutualCredit.creditLimitLeft > 0,
      );
      return hasBalance || canDrawCredit;
    });
    if (!hasWallet || listed.some((asset) => isHyphaAsset(asset))) {
      return listed;
    }
    return [HYPHA_SEND_TOKEN, ...listed];
  }, [assets, hasWallet]);

  useEffect(() => {
    const preferred = initialTokenAddress?.trim().toLowerCase();
    const preferredMatch = preferred
      ? tokens.find((token) => token.address?.toLowerCase() === preferred)
          ?.address
      : undefined;
    const first = preferredMatch ?? tokens[0]?.address;
    if (!first) return;
    setLines((current) => {
      const currentAddress = current[0]?.tokenAddress?.toLowerCase();
      if (preferred) {
        if (currentAddress === preferred) return current;
        if (!preferredMatch) return current;
      } else if (current[0]?.tokenAddress) {
        return current;
      }
      return current.map((line, index) =>
        index === 0 ? { ...line, tokenAddress: first } : line,
      );
    });
  }, [initialTokenAddress, tokens]);

  useEffect(() => {
    if (!client) {
      setConversationRows([]);
      return;
    }
    return attachConversationList(client, () => {
      setConversationRows((current) => {
        const next = conversationRowsSnapshot(client);
        if (
          current.length === next.length &&
          current.every((row, index) => row === next[index])
        ) {
          return current;
        }
        return next;
      });
    });
  }, [client]);

  const loadTransferRecipients = useCallback(async () => {
    if (directoryPeople && directorySpaces) return true;
    setDirectoryLoading(true);
    try {
      const response = await fetch('/api/v1/transfer-recipients');
      if (!response.ok) {
        throw new Error('recipients');
      }
      const body = (await response.json()) as {
        people?: Array<{
          id: number;
          name: string;
          surname: string;
          avatarUrl?: string | null;
          address: string;
          slug: string;
        }>;
        spaces?: Array<{
          id: number;
          title: string;
          slug: string;
          address: string;
          logoUrl?: string | null;
          web3SpaceId?: number | null;
          parentId?: number | null;
          flags?: Space['flags'];
        }>;
      };
      const peopleRows = Array.isArray(body.people) ? body.people : [];
      const now = new Date(0);
      setDirectoryPeople(
        peopleRows.map((entry) => ({
          id: entry.id,
          name: entry.name,
          surname: entry.surname,
          avatarUrl: entry.avatarUrl ?? undefined,
          address: entry.address,
          slug: entry.slug,
          createdAt: now,
          updatedAt: now,
        })),
      );
      setDirectorySpaces(
        (Array.isArray(body.spaces) ? body.spaces : []).map((space) => ({
          id: space.id,
          title: space.title,
          description: null,
          slug: space.slug,
          address: space.address,
          logoUrl: space.logoUrl ?? null,
          web3SpaceId: space.web3SpaceId ?? null,
          parentId: space.parentId ?? null,
          flags: space.flags ?? [],
          links: [],
          categories: [],
          createdAt: now,
          updatedAt: now,
        })),
      );
      return true;
    } catch {
      return false;
    } finally {
      setDirectoryLoading(false);
    }
  }, [directoryPeople, directorySpaces]);

  /** Wallet send passes no connections — load the payable directory for "see more". */
  useEffect(() => {
    if (people.length > 0) return;
    void loadTransferRecipients();
  }, [loadTransferRecipients, people.length]);

  /** Closest people are shared-space connections. The wallet page does not pass them. */
  useEffect(() => {
    if (people.length > 0) {
      setClosestPeople(null);
      return;
    }
    if (isLoadingJwt) return;
    if (!authToken) {
      setClosestPeople([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          '/api/v1/people/me/intelligence?connections=40',
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        if (!response.ok) throw new Error('intelligence');
        const body = (await response.json()) as MemberIntelligence;
        if (!cancelled) setClosestPeople(body.connections ?? []);
      } catch {
        if (!cancelled) setClosestPeople([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, isLoadingJwt, people.length]);

  const targets = useMemo(() => {
    const passedConnections = people.length > 0;
    const source = passedConnections ? people : closestPeople;
    // Wallet has not heard back yet. Don't flash the whole directory.
    if (!source) return [];

    const closest = memberRowsForConnections(
      source,
      conversationRows,
      personIdToMatrixUserId,
      person?.id ?? null,
      fallbackName,
    )
      .flatMap((row) => {
        const address = row.person.address?.trim();
        if (!address) return [];
        return [
          {
            kind: 'person' as const,
            id: `person-${row.person.id}`,
            name: row.name,
            address,
            sharedSpaceCount: row.person.sharedSpaceCount ?? 0,
            lastTs: row.lastTs ?? 0,
          },
        ];
      })
      .sort((left, right) => {
        const bySpaces = right.sharedSpaceCount - left.sharedSpaceCount;
        if (bySpaces !== 0) return bySpaces;
        return right.lastTs - left.lastTs;
      })
      .map((row) => ({
        kind: row.kind,
        id: row.id,
        name: row.name,
        address: row.address,
      }));

    if (closest.length > 0) return closest;

    const selfAddress = person?.address?.trim().toLowerCase() ?? '';
    const selfSlug = person?.slug?.trim() ?? '';
    const directory = (directoryPeople ?? []).filter((entry) => {
      const address = entry.address?.trim();
      if (!address) return false;
      if (selfAddress && address.toLowerCase() === selfAddress) return false;
      if (selfSlug && entry.slug?.trim() === selfSlug) return false;
      return true;
    });
    return shuffleWithSeed(directory, directoryShuffleSeed.current)
      .sort(
        (left, right) =>
          recipientProfileRank(right) - recipientProfileRank(left),
      )
      .map((entry) => {
        const address = entry.address?.trim() ?? '';
        const name =
          [entry.name, entry.surname].filter(Boolean).join(' ').trim() ||
          fallbackName;
        return {
          kind: 'person' as const,
          id: `person-${entry.id}`,
          name,
          address,
        };
      });
  }, [
    closestPeople,
    conversationRows,
    directoryPeople,
    fallbackName,
    people,
    person?.address,
    person?.id,
    person?.slug,
    personIdToMatrixUserId,
  ]);
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

  useEffect(() => {
    const address = initialRecipient?.address?.trim() ?? '';
    const name = initialRecipient?.name?.trim() ?? '';
    if (recipientTouched.current) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;
    const match = targets.find(
      (item) => item.address.toLowerCase() === address.toLowerCase(),
    );
    const next: TokenTarget = match ?? {
      kind: 'space',
      id: `space-address-${address.toLowerCase()}`,
      name: name || fallbackName,
      address,
    };
    setPicked(next);
    setTargetId(next.id);
  }, [fallbackName, initialRecipient, targets]);

  const target =
    targets.find((item) => item.id === targetId) ??
    (picked?.id === targetId ? picked : null);
  const previewTargets = useMemo(() => {
    const preview = visibleTargets.slice(0, RECIPIENT_PREVIEW);
    if (!target || preview.some((item) => item.id === target.id)) {
      return preview;
    }
    return [target, ...preview].slice(0, RECIPIENT_PREVIEW);
  }, [target, visibleTargets]);
  const memo = memoDraft.trim();
  const readyLines = lines.flatMap((line) => {
    const token = tokens.find((item) => item.address === line.tokenAddress);
    const amount = Number(line.amount);
    if (!token?.address || !(amount > 0)) return [];
    return [{ line, token, amount }];
  });

  function updateLine(id: string, patch: Partial<TokenLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    const used = new Set(
      lines
        .map((line) => line.tokenAddress?.toLowerCase())
        .filter((address): address is string => Boolean(address)),
    );
    const nextToken = tokens.find(
      (token) => token.address && !used.has(token.address.toLowerCase()),
    );
    if (!nextToken?.address) return;
    lineSeq.current += 1;
    setLines((current) => [
      ...current,
      {
        id: `line-${lineSeq.current}`,
        tokenAddress: nextToken.address ?? null,
        amount: '25',
      },
    ]);
  }

  async function send() {
    if (!target || readyLines.length === 0 || isTransferring) return;
    setError(null);
    setFundingKind(null);

    const totals = new Map<string, number>();
    for (const item of readyLines) {
      const key = item.token.address?.toLowerCase() ?? '';
      totals.set(key, (totals.get(key) ?? 0) + item.amount);
    }
    let shortfall: 'funds' | 'hypha' | null = null;
    for (const [address, total] of totals) {
      const asset = tokens.find(
        (token) => token.address?.toLowerCase() === address,
      );
      if (total > tokenSpendable(asset).spendable + 1e-9) {
        shortfall = asset?.symbol === 'HYPHA' ? 'hypha' : 'funds';
        if (shortfall === 'hypha') break;
      }
    }
    if (shortfall) {
      setFundingKind(shortfall);
      setError('insufficient');
      return;
    }

    try {
      await transferTokens({
        recipient: target.address,
        payouts: readyLines.map((item) => ({
          amount: item.line.amount,
          token: item.token.address ?? '',
        })),
        memo: memo.trim() || undefined,
      });
      const first = readyLines[0];
      const sameToken = readyLines.every(
        (item) =>
          item.token.address?.toLowerCase() ===
          first?.token.address?.toLowerCase(),
      );
      const spent = readyLines.reduce((sum, item) => sum + item.amount, 0);
      setSent({
        count: readyLines.length,
        amount: first?.amount ?? 0,
        symbol: first?.token.symbol ?? '',
        name: target.name,
        left:
          sameToken && first
            ? Math.max(0, tokenSpendable(first.token).balance - spent)
            : null,
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
      } else if (
        message.includes('ERC20: transfer amount exceeds balance') ||
        message.toLowerCase().includes('insufficient')
      ) {
        const hypha = readyLines.some((item) => item.token.symbol === 'HYPHA');
        setFundingKind(hypha ? 'hypha' : 'funds');
        setError('insufficient');
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
    const loaded = await loadTransferRecipients();
    if (!loaded) {
      setDirectoryOpen(false);
      setError(t('sendTokensDirectoryFailed'));
    }
  }

  function chooseFromDirectory(choice: Person | Space | { address: string }) {
    recipientTouched.current = true;
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

  if (sent) {
    return (
      <WidgetFrame title={t('sendTokensTitle')} framed={framed}>
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <SentTick />
          <p
            className="mt-4 text-4 font-medium tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {sent.count > 1
              ? t('sendTokensArrivedMany', {
                  count: sent.count,
                  name: sent.name,
                })
              : t('sendTokensArrived', {
                  amount: formatAmount(sent.amount),
                  symbol: sent.symbol,
                  name: sent.name,
                })}
          </p>
          <p className="mt-2 text-2 text-neutral-11">{t('sendTokensSigned')}</p>
          {sent.left != null ? (
            <p className="mt-4 text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
              {t('sendTokensLeft', {
                amount: formatAmount(sent.left),
                symbol: sent.symbol,
              })}
            </p>
          ) : null}
        </div>
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={t('sendTokensTitle')} framed={framed}>
      {isLoading ? (
        <p className="text-2 text-neutral-11">{t('loading')}</p>
      ) : tokens.length === 0 ? (
        <p className="text-2 text-neutral-11">
          {hasWallet ? t('sendTokensNone') : t('sendTokensNoWallet')}
        </p>
      ) : (
        <div className="flex flex-col gap-5 xl:gap-6">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
              {t('sendTokensTo')}
            </p>
            {previewTargets.length === 0 ? (
              <p className="mt-2 text-2 text-neutral-11">
                {people.length === 0 &&
                (directoryLoading || closestPeople == null)
                  ? t('loading')
                  : t('sendTokensNoOne')}
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:grid-cols-4">
                {previewTargets.map((item) => {
                  const active = item.id === target?.id;
                  const person =
                    people.find((entry) => `person-${entry.id}` === item.id) ??
                    closestPeople?.find(
                      (entry) => `person-${entry.id}` === item.id,
                    ) ??
                    directoryPeople?.find(
                      (entry) => `person-${entry.id}` === item.id,
                    );
                  const space =
                    spaces.find((entry) => `space-${entry.id}` === item.id) ??
                    directorySpaces?.find(
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
                          'flex w-full flex-col items-center gap-2 border px-2 py-2',
                          active
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-transparent hover:bg-accent-2',
                        )}
                        onClick={() => {
                          recipientTouched.current = true;
                          setTargetId(item.id);
                        }}
                      >
                        <span className="relative inline-flex">
                          {person ? (
                            <PersonAvatar
                              avatarSrc={person.avatarUrl ?? undefined}
                              userName={item.name}
                              size="md"
                              shape="circle"
                              personId={person.id}
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

          <div className="flex flex-col gap-3">
            {lines.map((line) => {
              const selected =
                tokens.find((token) => token.address === line.tokenAddress) ??
                null;
              const holding = tokenSpendable(selected);
              const available =
                holding.creditLeft > 0 ? holding.spendable : holding.balance;
              const numeric = Number(line.amount);
              const enough =
                !selected ||
                !Number.isFinite(numeric) ||
                numeric <= 0 ||
                numeric <= available + 1e-9;
              const menuOpen = openMenuId === line.id;
              return (
                <div
                  key={line.id}
                  className={cn(
                    'border px-4 py-5 text-center',
                    enough ? 'border-border' : 'border-error-7',
                  )}
                >
                  {lines.length > 1 ? (
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        className="text-1 text-neutral-11"
                        onClick={() =>
                          setLines((current) =>
                            current.filter((item) => item.id !== line.id),
                          )
                        }
                      >
                        {t('sendTokensRemove')}
                      </button>
                    </div>
                  ) : null}
                  <div
                    className="text-8 leading-none tabular-nums tracking-[-0.04em]"
                    style={{ fontFamily: 'var(--font-family-heading)' }}
                  >
                    <label className="sr-only" htmlFor={`${line.id}-amount`}>
                      {t('sendTokensAmount')}
                    </label>
                    <input
                      id={`${line.id}-amount`}
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(event) => {
                        const next = event.target.value.replace(',', '.');
                        if (next !== '' && !AMOUNT_INPUT.test(next)) {
                          return;
                        }
                        updateLine(line.id, { amount: next });
                      }}
                      className="w-28 bg-transparent text-center outline-none"
                    />
                    {tokens.length > 1 ? (
                      <Popover
                        modal={false}
                        open={menuOpen}
                        onOpenChange={(open) =>
                          setOpenMenuId(open ? line.id : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={t('sendTokensChoose', {
                              symbol: selected?.symbol ?? '',
                            })}
                            className="ml-2 inline-flex items-center gap-1 align-middle text-2 tracking-[0.14em] uppercase"
                          >
                            {selected?.symbol}
                            <ChevronDown
                              aria-hidden
                              strokeWidth={1.5}
                              className={cn(
                                'size-3.5 text-neutral-10 transition-transform',
                                menuOpen && 'rotate-180',
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
                              const active =
                                token.address === selected?.address;
                              return (
                                <li key={token.address}>
                                  <button
                                    type="button"
                                    className={cn(
                                      'flex w-full items-center gap-3 px-3 py-2 text-left',
                                      active
                                        ? 'bg-accent-2'
                                        : 'hover:bg-accent-2',
                                    )}
                                    onClick={() => {
                                      updateLine(line.id, {
                                        tokenAddress: token.address ?? null,
                                      });
                                      setOpenMenuId(null);
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
                        {selected?.symbol}
                      </span>
                    )}
                  </div>
                  {selected ? (
                    <WalletHoldingLine
                      label={tWallet('available')}
                      amount={formatWalletAmount(available)}
                      symbol={selected.symbol}
                      enough={enough}
                    />
                  ) : null}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {AMOUNTS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={cn(
                          'h-10 min-w-10 border px-3 text-2 tabular-nums',
                          Math.abs(numeric - value) < 1e-9
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border hover:bg-accent-2',
                        )}
                        onClick={() =>
                          updateLine(line.id, { amount: String(value) })
                        }
                      >
                        {formatAmount(value)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {lines.length < tokens.length ? (
              <button
                type="button"
                className="flex items-center justify-center gap-2 border border-dashed border-border py-3 text-1 text-neutral-11"
                onClick={addLine}
              >
                <Plus className="size-4" aria-hidden />
                {t('sendTokensAdd')}
              </button>
            ) : null}
          </div>

          <label className="flex flex-col gap-2" htmlFor="send-tokens-memo">
            <span className="text-[11px] tracking-[0.16em] text-neutral-11 uppercase">
              {t('sendTokensMemo')}
            </span>
            <input
              id="send-tokens-memo"
              value={memoDraft}
              placeholder={t('sendTokensMemoPlaceholder')}
              onChange={(event) => setMemoDraft(event.target.value)}
              className="h-10 w-full border border-border bg-background px-3 text-2 text-foreground outline-none placeholder:text-neutral-9 focus:border-foreground"
            />
          </label>

          <Button
            type="button"
            className="w-full"
            disabled={
              !hasWallet || !target || readyLines.length === 0 || isTransferring
            }
            onClick={() => {
              void send();
            }}
          >
            {isTransferring
              ? t('sendTokensSigning')
              : !target
              ? t('sendTokensPickFirst')
              : readyLines.length > 1
              ? t('sendTokensSendMany', {
                  count: readyLines.length,
                  name: target.name,
                })
              : t('sendTokensSend', {
                  amount: formatAmount(readyLines[0]?.amount ?? 0),
                  symbol: readyLines[0]?.token.symbol ?? '',
                  name: target.name,
                })}
          </Button>
          {error === 'insufficient' ? (
            <p className="text-2 text-foreground" role="alert">
              {t('sendTokensInsufficient')}{' '}
              {fundingKind === 'hypha' ? (
                <Link
                  href={`/${locale}/my-wallet/actions/purchase-hypha-tokens`}
                  className="font-bold text-accent-9 underline"
                >
                  {t('sendTokensTopUp')}
                </Link>
              ) : (
                <button
                  type="button"
                  className="font-bold text-accent-9 underline"
                  onClick={() => {
                    void fundWallet();
                  }}
                >
                  {t('sendTokensTopUp')}
                </button>
              )}
            </p>
          ) : error ? (
            <p className="text-2 text-error-11" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </WidgetFrame>
  );
}
