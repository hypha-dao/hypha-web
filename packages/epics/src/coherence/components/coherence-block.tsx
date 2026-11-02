'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  DEFAULT_SIGNAL_TOP_WINDOW,
  SIGNAL_TOP_WINDOWS,
  parseSignalTopWindow,
  rankSignalsByWindow,
  useFindCoherences,
  useSpaceBySlug,
  type SignalTopWindow,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { CoherenceOrder } from '../types';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { getSignalPath } from '../../common/get-path-function';
import { useSignalRoomActivity } from '../hooks/use-signal-room-activity';
import { useSignalVotingMode } from '../hooks/use-signal-voting-mode';
import { SignalFeedRow } from './signal-feed-row';
import type { UseMembers } from '../../spaces/hooks/types';

export const SIGNAL_TOP_WINDOW_QUERY_KEY = 'top';

const TOP_WINDOW_LABEL_KEY: Record<SignalTopWindow, string> = {
  '7d': 'topWindow7d',
  '30d': 'topWindow30d',
  all: 'topWindowAll',
};

export type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
  /** Kept for route compatibility; the feed always ranks by upvotes. */
  order?: CoherenceOrder;
  humanChatEnabled?: boolean;
  useMembers?: UseMembers;
};

export function CoherenceBlock({ lang, spaceSlug }: CoherenceBlockProps) {
  const t = useTranslations('CoherenceTab');
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const topWindow = parseSignalTopWindow(
    searchParams.get(SIGNAL_TOP_WINDOW_QUERY_KEY),
  );
  const handleTopWindowChange = React.useCallback(
    (next: SignalTopWindow) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === DEFAULT_SIGNAL_TOP_WINDOW) {
        params.delete(SIGNAL_TOP_WINDOW_QUERY_KEY);
      } else {
        params.set(SIGNAL_TOP_WINDOW_QUERY_KEY, next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({
    spaceSlug,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const votingMode = useSignalVotingMode(space?.web3SpaceId);

  const {
    coherences: signals,
    isLoading: isSignalsLoading,
    refresh,
  } = useFindCoherences({ spaceSlug, orderBy: 'mostupvoted' });

  const ranked = React.useMemo(
    () => rankSignalsByWindow(signals ?? [], topWindow),
    [signals, topWindow],
  );
  const activity = useSignalRoomActivity(ranked);
  const isLoading = isSpaceLoading || (isSignalsLoading && !signals?.length);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="craft-page-title text-6 font-medium">
          {t('signals')}
          {typeof signals?.length === 'number' ? (
            <span className="ml-2 text-4 font-normal text-muted-foreground">
              | {format.number(signals.length)}
            </span>
          ) : null}
        </h1>
        {canMutate ? (
          <Button asChild colorVariant="neutral" className="gap-1.5">
            <Link
              href={`/${lang}/dho/${spaceSlug}/coherence/new-signal`}
              scroll={false}
            >
              <Plus className="craft-icon" aria-hidden />
              {t('newSignal')}
            </Link>
          </Button>
        ) : null}
      </header>

      <div
        role="radiogroup"
        aria-label={t('topSignalIn')}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t('topSignalIn')}
        </span>
        {SIGNAL_TOP_WINDOWS.map((value) => {
          const selected = value === topWindow;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => handleTopWindowChange(value)}
              className={cn(
                'craft-chip craft-chip-interactive h-8 px-3 text-1',
                selected &&
                  'border-foreground bg-foreground text-background hover:border-foreground hover:bg-foreground hover:text-background',
              )}
            >
              {t(TOP_WINDOW_LABEL_KEY[value] as never)}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              loading
              className="h-[104px] w-full rounded-none"
            />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <p className="craft-card px-4 py-8 text-center text-1 text-muted-foreground">
          {t('listIsEmpty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {ranked.map((signal) =>
            signal.slug ? (
              <SignalFeedRow
                key={signal.id}
                signal={signal}
                href={getSignalPath(lang, spaceSlug, signal.slug)}
                votingMode={votingMode}
                activity={signal.roomId ? activity[signal.roomId] : undefined}
                refresh={refresh}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
