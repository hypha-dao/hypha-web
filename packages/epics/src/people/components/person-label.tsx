import { Skeleton } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { PersonAvatar } from './person-avatar';

export interface Creator {
  name?: string;
  surname?: string;
  avatarUrl?: string;
}

interface PersonLabelProps {
  creator?: Creator;
  isLoading?: boolean;
  hasAvatar?: boolean;
}

export const PersonLabel = ({
  isLoading,
  creator,
  hasAvatar = true,
}: PersonLabelProps) => {
  return (
    <div className="flex items-center space-x-2">
      {hasAvatar ? (
        <PersonAvatar
          isLoading={isLoading}
          size="sm"
          avatarSrc={creator?.avatarUrl}
          userName={`${creator?.name} ${creator?.surname}`}
        />
      ) : null}

      <Skeleton width="50px" height="16px" loading={isLoading}>
        <Text className="text-1 text-neutral-11">
          {creator?.name} {creator?.surname}
        </Text>
      </Skeleton>
    </div>
  );
};
