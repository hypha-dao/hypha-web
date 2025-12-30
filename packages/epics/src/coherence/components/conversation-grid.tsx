'use client';

import Link from 'next/link';
import { ConversationCard } from './conversation-card';
import { Coherence } from '../types';

type ConversationGridProps = {
  isLoading: boolean;
  basePath: string;
  conversations: Coherence[];
};

export function ConversationGrid({
  isLoading = true,
  basePath,
  conversations,
}: ConversationGridProps) {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
      {conversations.map((conversation, index) => (
        <Link
          key={`conversation-card-${index}`}
          href={`${basePath}/${conversation.roomId}`}
        >
          <ConversationCard {...conversation} isLoading={isLoading} />
        </Link>
      ))}
    </div>
  );
}
