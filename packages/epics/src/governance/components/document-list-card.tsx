import { Skeleton, Card } from '@hypha-platform/ui';
import { type Creator } from '../../people/components/person-label';
import { type BadgeItem, BadgesList } from '@hypha-platform/ui';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Text } from '@radix-ui/themes';

interface DocumentListCardProps {
  isLoading?: boolean;
  creator: Creator;
  badges?: BadgeItem[];
  interactions?: React.ReactNode;
}

interface Document {
  id: number;
  creatorId: number;
  title: string;
  description?: string;
  slug: string;
  state: 'agreement' | 'discussion' | 'proposal';
  createdAt: Date;
  updatedAt: Date;
}

export const DocumentListCard: React.FC<DocumentListCardProps & Document> = ({
  isLoading,
  title,
  state,
  creator,
  badges,
  interactions,
}) => {
  return (
    <Card className="w-full h-full p-5 flex items-center">
      <PersonAvatar
        className="mr-3"
        avatarSrc={creator?.avatarUrl}
        userName={`${creator?.name} ${creator?.surname}`}
        isLoading={isLoading}
        size="lg"
      />
      <div className="flex justify-between items-center w-full">
        <div className="grid">
          <BadgesList isLoading={isLoading} badges={badges ?? []} />
          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Text className="text-4 text-ellipsis overflow-hidden text-nowrap mr-3">
              {title}
            </Text>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <Text className="text-1 text-neutral-11">
              {creator?.name} {creator?.surname}
            </Text>
          </Skeleton>
        </div>
        <div className="lex justify-end">{interactions}</div>
      </div>
    </Card>
  );
};
