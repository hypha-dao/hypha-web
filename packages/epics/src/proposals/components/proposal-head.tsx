import { Text } from '@radix-ui/themes';
import { Badge, StatusBadge, Skeleton } from '@hypha-platform/ui';
import { PersonAvatar } from '../../people/components/person-avatar';

export type CreatorType = {
  avatar?: string;
  name?: string;
  surname?: string;
  type?: 'person' | 'space';
};

export type ProposalHeadProps = {
  creator?: CreatorType;
  title?: string;
  commitment?: number;
  status?: string;
  isLoading?: boolean;
  label?: string;
  createDate?: string;
};

export const ProposalHead = ({
  creator,
  title,
  commitment,
  status,
  isLoading,
  label,
  createDate,
}: ProposalHeadProps) => {
  const displayName =
    creator?.type === 'space'
      ? creator.name
      : `${creator?.name} ${creator?.surname}`.trim();

  return (
    <div className="flex items-center space-x-3">
      <PersonAvatar
        size="lg"
        isLoading={isLoading}
        avatarSrc={creator?.avatar}
        userName={displayName}
      />
      <div className="flex justify-between items-center w-full">
        <div className="grid">
          <div className="flex gap-x-1">
            <Badge variant="solid" colorVariant="accent" isLoading={isLoading}>
              {label}
            </Badge>
            {creator?.type === 'space' && (
              <Badge variant="outline" colorVariant="neutral">
                Space
              </Badge>
            )}
          </div>

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
            <Text className="text-1 text-gray-500">
              {displayName} · {createDate}
            </Text>
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
