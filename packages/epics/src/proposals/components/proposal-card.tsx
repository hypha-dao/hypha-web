import { Text } from '@radix-ui/themes';
import { Card, Button, Badge, StatusBadge, Skeleton } from '@hypha-platform/ui';
import Image from 'next/image';

type CreatorType = {
  avatar?: string;
  name?: string;
  surname?: string;
};

type ProposalCardProps = {
  creator?: CreatorType;
  title?: string;
  commitment?: number;
  status?: string;
  isLoading?: boolean;
};

const voted = false;

export const ProposalCard: React.FC<ProposalCardProps> = ({
  commitment,
  status,
  title,
  creator,
  isLoading,
}) => {
  return (
    <Card className="w-full h-full p-6 mb-2 flex">
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
            <Skeleton loading={isLoading}>
              <Badge variant="action">Proposal</Badge>
            </Skeleton>
            <Skeleton loading={isLoading}>
              <Badge variant="actionOutline">Recurring</Badge>
            </Skeleton>
            <Skeleton loading={isLoading}>
              <Badge variant="actionOutline">{commitment}%</Badge>
            </Skeleton>
            <StatusBadge isLoading={isLoading} status={status} />
          </div>

          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Text className="text-3">{title}</Text>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            <Text className="text-xs text-gray-500">
              {creator?.name} {creator?.surname}
            </Text>
          </Skeleton>
        </div>

        <div>
          <Skeleton
            height="32px"
            width="86px"
            loading={isLoading}
            className="rounded-lg"
          >
            <div>
              {voted ? (
                <Button
                  className="rounded-lg w-fit"
                  variant="actionOutlineChecked"
                  size="sm"
                >
                  You voted yes
                </Button>
              ) : (
                <Button
                  className="rounded-lg w-fit"
                  variant="actionOutline"
                  size="sm"
                >
                  Vote now
                </Button>
              )}
            </div>
          </Skeleton>
        </div>
      </div>
    </Card>
  );
};
