'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
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
import { useHumanChatPanel } from '../../common/human-chat-panel-context';

type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
  order?: CoherenceOrder;
  priorityFilter?: 'all' | 'high' | 'medium' | 'low';
  humanChatEnabled?: boolean;
};

export function CoherenceBlock({
  lang,
  spaceSlug,
  order,
  priorityFilter = 'all',
  humanChatEnabled = false,
}: CoherenceBlockProps) {
  const t = useTranslations('CoherenceTab');
  const tSpaces = useTranslations('Spaces');
  const [hideArchived, setHideArchived] = React.useState(true);
  const { isAuthenticated, login } = useAuthentication();
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
  const filteredSignals = React.useMemo(
    () =>
      (signals ?? []).filter((signal) =>
        priorityFilter === 'all' ? true : signal.priority === priorityFilter,
      ),
    [priorityFilter, signals],
  );

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
    <div className="flex flex-col gap-4 py-2">
      {isAuthenticated ? (
        <div className="flex flex-col gap-4">
          <SignalSection
            basePath={chatBasePath}
            hasSearch={true}
            signals={filteredSignals}
            leadImage={space?.leadImage ?? undefined}
            isLoading={isSpaceLoading || isSignalsLoading}
            firstPageSize={3}
            pageSize={3}
            refresh={refresh}
            onSignalClick={onSignalClick}
          />
        </div>
      ) : (
        <Empty>
          <div className="flex flex-col gap-7">
            <p>{tSpaces('accessDeniedNotLoggedIn')}</p>
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" onClick={login}>
                {tSpaces('signIn')}
              </Button>
              <Button onClick={login}>{tSpaces('getStarted')}</Button>
            </div>
          </div>
        </Empty>
      )}
    </div>
  );
}
