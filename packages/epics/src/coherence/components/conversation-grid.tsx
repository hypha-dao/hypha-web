'use client';

import Link from 'next/link';
import { ConversationCard } from './conversation-card';
import { Coherence } from '@hypha-platform/core/client';

type ConversationGridProps = {
  isLoading: boolean;
  basePath: string;
  conversations: Coherence[];
  refresh: () => Promise<void>;
};

export function ConversationGrid({
  isLoading = true,
  basePath,
  conversations,
  refresh,
}: ConversationGridProps) {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
      {conversations.map((conversation) =>
        conversation.archived ? (
          <ConversationCard
            key={conversation.id}
            {...conversation}
            isLoading={isLoading}
            refresh={refresh}
          />
        ) : (
          <Link key={conversation.id} href={`${basePath}/${conversation.slug}`}>
            <ConversationCard
              {...conversation}
              isLoading={isLoading}
              refresh={refresh}
            />
          </Link>
        ),
      )}
    </div>
  );
}
