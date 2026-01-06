import { Coherence, Order } from '@hypha-platform/core/client';
import { ConversationGrid } from './conversation-grid';

type ConversationGridContainerProps = {
  basePath: string;
  pagination: {
    page: number;
    firstPageSize: number;
    pageSize: number;
    searchTerm?: string;
    order?: Order<Coherence>;
  };
  conversations: Coherence[];
};

export const ConversationGridContainer = ({
  basePath,
  pagination,
  conversations,
}: ConversationGridContainerProps) => {
  const { page, firstPageSize, pageSize } = pagination;
  const startIndex = page <= 1 ? 0 : firstPageSize + (page - 2) * pageSize;
  const endIndex = Math.min(
    conversations.length,
    page < 1 ? 0 : page === 1 ? firstPageSize : startIndex + pageSize,
  );
  const paginatedConversations = conversations.slice(startIndex, endIndex);

  return (
    <ConversationGrid
      isLoading={false}
      basePath={basePath}
      conversations={paginatedConversations.map((conversation) => ({
        ...conversation,
      }))}
    />
  );
};
