'use client';

import Link from 'next/link';
import { ConversationCard } from './conversation-card';
import { Coherence } from '../types';
import { getSpaceChat } from '../../common';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';

type ConversationGridProps = {
  isLoading: boolean;
  conversations: Coherence[];
};

export function ConversationGrid({
  isLoading = true,
  conversations,
}: ConversationGridProps) {
  const { lang, id: spaceSlug } = useParams<{ lang: Locale; id: string }>();
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
      {conversations.map((conversation, index) => (
        <Link
          key={`conversation-card-${index}`}
          href={
            conversation.roomId
              ? getSpaceChat(lang, spaceSlug, conversation.roomId)
              : '#'
          }
        >
          <ConversationCard {...conversation} isLoading={isLoading} />
        </Link>
      ))}
    </div>
  );
}
