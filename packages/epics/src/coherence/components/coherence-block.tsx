'use client';

import { useCoherenceRecords } from '../hooks';
import { ConversationSection } from './conversation-section';
import { SignalSection } from './signal-section';

type CoherenceBlockProps = {};

export function CoherenceBlock({}: CoherenceBlockProps) {
  const {
    records: { signals, conversations },
    isLoading,
  } = useCoherenceRecords({});

  return (
    <div className="flex flex-col gap-6 py-4">
      <SignalSection
        label="AI Signals"
        hasSearch={false}
        signals={signals}
        isLoading={isLoading}
        firstPageSize={9}
        pageSize={15}
      />
      <ConversationSection
        label="Conversations"
        hasSearch={true}
        conversations={conversations}
        isLoading={isLoading}
        firstPageSize={9}
        pageSize={15}
      />
    </div>
  );
}
