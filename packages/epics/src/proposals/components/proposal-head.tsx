import { Text } from '@radix-ui/themes';
import { Badge, Skeleton } from '@hypha-platform/ui';
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
  proposalStatus?: string | null;
};

export const ProposalHead = ({
  creator,
  title,
  isLoading = false,
  label,
  createDate,
  proposalStatus,
}: ProposalHeadProps) => {
  const displayName =
    creator?.type === 'space'
      ? creator.name
      : `${creator?.name} ${creator?.surname}`.trim();

  const getStatusBadgeProps = (): {
    text: string;
    colorVariant:
      | 'success'
      | 'error'
      | 'warn'
      | 'neutral'
      | 'accent'
      | null
      | undefined;
  } => {
    switch (proposalStatus) {
      case 'accepted':
        return { text: 'Accepted', colorVariant: 'success' };
      case 'rejected':
        return { text: 'Rejected', colorVariant: 'error' };
      case 'onVoting':
        return { text: 'On Voting', colorVariant: 'warn' };
      default:
        return { text: '', colorVariant: 'neutral' };
    }
  };

  const { text: statusText, colorVariant: statusColor } = getStatusBadgeProps();

  return (
    <div className="flex gap-3 w-full">
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
              <Badge
                variant="solid"
                colorVariant="accent"
                isLoading={isLoading}
              >
                {label}
              </Badge>
              {creator?.type === 'space' && (
                <Badge
                  variant="outline"
                  colorVariant="neutral"
                  isLoading={isLoading}
                >
                  Space
                </Badge>
              )}
              {proposalStatus && (
                <Badge
                  variant="outline"
                  colorVariant={statusColor}
                  isLoading={isLoading}
                >
                  {statusText}
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
    </div>
  );
};
