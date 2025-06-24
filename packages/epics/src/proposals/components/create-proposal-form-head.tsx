import { Text } from '@radix-ui/themes';
import { Badge, Skeleton, Image, Input } from '@hypha-platform/ui';
import { Creator } from '@hypha-platform/graphql/rsc';

export type CreateProposalFormHeadProps = {
  creator?: Creator;
  isLoading?: boolean;
};

export const CreateProposalFormHead = ({
  creator,
  isLoading,
}: CreateProposalFormHeadProps) => {
  return (
    <div className="flex items-center">
      <Skeleton
        width="64px"
        height="64px"
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="rounded-lg mr-3"
          src={creator?.avatar ?? ''}
          height={64}
          width={64}
          alt={
            creator?.name && creator?.surname
              ? `${creator.name} ${creator.surname}`
              : 'Creator Avatar'
          }
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <div className="flex gap-x-1">
            <Badge variant="solid" colorVariant="accent" isLoading={isLoading}>
              Proposal
            </Badge>
          </div>

          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Input
              className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
              placeholder="Type a title..."
            />
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <Text className="text-1 text-gray-500">
              {creator?.name} {creator?.surname}
            </Text>
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
