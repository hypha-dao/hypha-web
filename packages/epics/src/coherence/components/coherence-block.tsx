'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Empty } from '../../common/empty';
import {
  Coherence,
  useFindCoherences,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import React from 'react';
import { useTranslations } from 'next-intl';
import { CoherenceOrder } from '../types';
import { SignalSection } from './signal-section';
import { SpaceMemorySection } from './space-memory-section';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';

type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
  order?: CoherenceOrder;
  humanChatEnabled?: boolean;
  spaceMemoryEnabled?: boolean;
};

export function CoherenceBlock({
  lang,
  spaceSlug,
  order,
  humanChatEnabled = false,
  spaceMemoryEnabled = false,
}: CoherenceBlockProps) {
  const t = useTranslations('CoherenceTab');
  const [hideArchived, setHideArchived] = React.useState(true);
  const { isAuthenticated } = useAuthentication();
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const {
    coherences: signals,
    isLoading: isSignalsLoading,
    refresh: refreshSignals,
  } = useFindCoherences({
    spaceId: space?.id,
    includeArchived: !hideArchived,
    orderBy: order,
  });

  const refresh = React.useCallback(async () => {
    await refreshSignals();
  }, [refreshSignals]);

  const chatBasePath = React.useMemo(
    () => `/${lang}/dho/${spaceSlug}/coherence/chat`,
    [lang, spaceSlug],
  );

  const { openCoherenceChat } = useHumanChatPanel();

  const handleSignalClick = React.useCallback(
    (signal: Coherence) => {
      openCoherenceChat(
        signal.roomId ?? null,
        signal.title ?? '',
        signal.slug ?? '',
      );
    },
    [openCoherenceChat],
  );

  const onSignalClick = humanChatEnabled ? handleSignalClick : undefined;

  return (
    <div className="flex flex-col gap-6 py-4">
      {isAuthenticated ? (
        <div className="rounded-2xl border border-border/60 bg-card/35 shadow-sm backdrop-blur-[2px] supports-[backdrop-filter]:bg-card/25 dark:bg-card/40 dark:supports-[backdrop-filter]:bg-card/30">
          <div className="flex flex-col gap-10 px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8">
            <SignalSection
              basePath={chatBasePath}
              label={t('signals')}
              hasSearch={true}
              signals={signals ?? []}
              leadImage={space?.leadImage ?? undefined}
              isLoading={isSpaceLoading || isSignalsLoading}
              firstPageSize={3}
              pageSize={3}
              refresh={refresh}
              onSignalClick={onSignalClick}
            />
            {spaceMemoryEnabled ? (
              <SpaceMemorySection spaceSlug={spaceSlug} />
            ) : null}
          </div>
        </div>
      ) : (
        <Empty>
          <p>{t('signInToSee')}</p>
        </Empty>
      )}
    </div>
  );
}
