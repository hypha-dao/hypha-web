import Link from 'next/link';
import { ConversationCard } from './conversation-card';
import { Coherence } from '../types';

type ConversationGridProps = {
  isLoading: boolean;
  conversations: Coherence[];
};

export function ConversationGrid({
  isLoading = true,
  conversations,
}: ConversationGridProps) {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
      {conversations.map((conversation) => (
        <Link href="#">
          <ConversationCard {...conversation} isLoading={isLoading} />
        </Link>
      ))}
    </div>
  );
}
