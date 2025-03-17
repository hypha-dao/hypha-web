import { Skeleton } from '@hypha-platform/ui';
import { type Creator } from '../../people/components/person-label';
import { type BadgeItem, BadgesList } from '@hypha-platform/ui';
import { PersonAvatar } from '../../people/components/person-avatar';
import { Text } from '@radix-ui/themes';
import { PersonLabel } from '../../people/components/person-label';

export interface DocumentDetailsHeadProps {
  isLoading?: boolean;
  creator?: Creator;
  badges?: BadgeItem[];
}

export interface Document {
  id?: number;
  creatorId?: number;
  title?: string;
  description?: string;
}

export const DocumentDetailsHead: React.FC<
  DocumentDetailsHeadProps & Document
> = ({ isLoading, title, creator, badges }) => {
  return (
    <div className="w-full h-full flex items-center space-x-3">
      <PersonAvatar
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
          <PersonLabel
            isLoading={isLoading}
            creator={creator}
            hasAvatar={false}
          />
        </div>
      </div>
    </div>
  );
};
