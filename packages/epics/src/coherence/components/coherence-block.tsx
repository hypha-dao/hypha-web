'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useCoherenceRecords } from '../hooks';
import { ConversationSection } from './conversation-section';
import { SignalSection } from './signal-section';
import { Empty } from '../../common/empty';
import { DirectionType } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';

type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
};

export function CoherenceBlock({ lang, spaceSlug }: CoherenceBlockProps) {
  const { isAuthenticated } = useAuthentication();
  const {
    records: { signals, conversations },
    isLoading,
  } = useCoherenceRecords({
    order: [
      {
        name: 'createdAt',
        dir: DirectionType.DESC,
      },
    ],
  });

  const basePath = `/${lang}/dho/${spaceSlug}/coherence`;

  return (
    <div className="flex flex-col gap-6 py-4">
      {isAuthenticated ? (
        <>
          <SignalSection
            label="AI Signals"
            hasSearch={false}
            signals={signals}
            isLoading={isLoading}
            firstPageSize={3}
            pageSize={3}
          />
          <ConversationSection
            basePath={`${basePath}/chat`}
            label="Conversations"
            hasSearch={true}
            conversations={conversations}
            isLoading={isLoading}
            firstPageSize={4}
            pageSize={2}
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
