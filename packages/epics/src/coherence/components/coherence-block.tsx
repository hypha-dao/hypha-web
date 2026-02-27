'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Empty } from '../../common/empty';
import { useFindCoherences, useSpaceBySlug } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import React from 'react';
import { CoherenceOrder } from '../types';
import { Coherence, DirectionType } from '@hypha-platform/core/client';
import { SignalSection } from './signal-section';
import { ConversationSection } from './conversation-section';

type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
  orderSignal?: CoherenceOrder;
  orderConversation?: CoherenceOrder;
};

export function CoherenceBlock({
  lang,
  spaceSlug,
  orderSignal,
  orderConversation,
}: CoherenceBlockProps) {
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
  });

  const refresh = React.useCallback(async () => {
    await refreshSignals();
  }, [refreshSignals]);

  const chatBasePath = React.useMemo(
    () => `/${lang}/dho/${spaceSlug}/coherence/chat`,
    [lang, spaceSlug],
  );

  return (
    <div className="flex flex-col gap-6 py-4">
      {isAuthenticated ? (
        <>
          <SignalSection
            basePath={chatBasePath}
            label="Signals"
            hasSearch={true}
            signals={signals ?? []}
            isLoading={isSpaceLoading || isSignalsLoading}
            firstPageSize={6}
            pageSize={3}
            refresh={refresh}
          />
        </>
      ) : (
        <Empty>
          <p>Please, sign in to see signals and conversations</p>
        </Empty>
      )}
    </div>
  );
}
