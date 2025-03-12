import { Badge, Skeleton, StatusBadge, CardContent } from '@hypha-platform/ui';
import { Avatar, AvatarImage } from '@radix-ui/react-avatar';
import { ViewsAndComments } from '../../common/views-and-comments';
import { Text } from '@radix-ui/themes';
import { AgreementCardProps } from './agreement-card';

export const RowAgreementView = ({
  commitment,
  status,
  title,
  creator,
  views,
  comments,
  isLoading,
}: AgreementCardProps) => (
  <CardContent className="p-5 relative flex items-center">
    <Skeleton
      width="64px"
      height="64px"
      loading={isLoading}
      className="rounded-lg mr-3"
    >
      <Avatar>
        <AvatarImage
          className="rounded-md mr-3"
          width={64}
          height={64}
          src={creator?.avatar}
          alt="avatar"
        />
      </Avatar>
    </Skeleton>

    <div className="flex justify-between items-center w-full ml-3">
      <div className="grid">
        <div className="flex gap-x-1">
          <Badge variant="surface" colorVariant="accent" isLoading={isLoading}>
            Agreement
          </Badge>
          <Badge variant="surface" colorVariant="accent" isLoading={isLoading}>
            Recurring
          </Badge>
          <Badge variant="surface" colorVariant="accent" isLoading={isLoading}>
            {commitment}%
          </Badge>
          <StatusBadge status={status} isLoading={isLoading} />
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
          <Text className="text-1 text-neutral-11">
            {creator?.name} {creator?.surname}
          </Text>
        </Skeleton>
      </div>
    </div>
    <ViewsAndComments
      views={views}
      comments={comments?.length}
      isLoading={isLoading}
    />
  </CardContent>
);
