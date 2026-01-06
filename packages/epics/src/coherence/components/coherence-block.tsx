'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { ConversationSection } from './conversation-section';
import { SignalSection } from './signal-section';
import { Empty } from '../../common/empty';
import { useFindCoherences, useSpaceBySlug } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import React from 'react';

type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
};

export function CoherenceBlock({ lang, spaceSlug }: CoherenceBlockProps) {
  const [hideArchived, setHideArchived] = React.useState(true);
  const { isAuthenticated } = useAuthentication();
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const {
    coherences: signals,
    isLoading: isSignalsLoading,
    refresh: refreshSignals,
  } = useFindCoherences({
    spaceId: space?.id,
    status: 'signal',
  });
  const {
    coherences: conversations,
    isLoading: isConversationLoading,
    refresh: refreshConversations,
  } = useFindCoherences({
    spaceId: space?.id,
    status: 'conversation',
    includeArchived: !hideArchived,
  });

  const refresh = React.useCallback(async () => {
    await refreshSignals();
    await refreshConversations();
  }, [refreshSignals, refreshConversations]);

  const chatBasePath = React.useMemo(
    () => `/${lang}/dho/${spaceSlug}/coherence/chat`,
    [lang, spaceSlug],
  );

  return (
    <div className="flex flex-col gap-6 py-4">
      {isAuthenticated ? (
        <>
          <SignalSection
            label="AI Signals"
            hasSearch={false}
            signals={signals ?? []}
            isLoading={isSpaceLoading || isSignalsLoading}
            firstPageSize={3}
            pageSize={3}
            refresh={refresh}
          />
          <ConversationSection
            basePath={chatBasePath}
            label="Conversations"
            hasSearch={true}
            conversations={conversations ?? []}
            isLoading={isSpaceLoading || isConversationLoading}
            firstPageSize={4}
            pageSize={2}
            hideArchived={hideArchived}
            setHideArchived={setHideArchived}
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
