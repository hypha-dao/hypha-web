import { Text } from '@radix-ui/themes';
import { Skeleton, Image } from '@hypha-platform/ui';

export type CreatorType = {
  avatar?: string;
  name?: string;
  surname?: string;
};

export type DiscussionHeadProps = {
  creator?: CreatorType;
  title?: string;
  isLoading: boolean;
};

export const DiscussionHead = ({
  creator,
  title,
  isLoading,
}: DiscussionHeadProps) => {
  return (
    <div className="flex flex-col">
      <Skeleton height="16px" width="200px" loading={isLoading}>
        <Text className="text-4 text-primary">{title}</Text>
      </Skeleton>
      <div className="flex row items-center">
        <Skeleton
          width="12px"
          height="12px"
          loading={isLoading}
          className="rounded-lg mr-2"
        >
          <Image
            className="rounded-lg mr-2 max-h-[12px]"
            src={creator?.avatar ?? ''}
            height={12}
            width={12}
            alt={
              creator?.name && creator?.surname
                ? `${creator.name} ${creator.surname}`
                : 'Creator Avatar'
            }
          />
        </Skeleton>
        <Skeleton height="16px" width="80px" loading={isLoading}>
          <Text className="text-1 text-gray-500">
            {creator?.name} {creator?.surname}
          </Text>
        </Skeleton>
      </div>
    </div>
  );
};
