import { Skeleton, Button } from '@hypha-platform/ui';

type VoteButtonProps = {
  isLoading?: boolean;
  isVoted?: boolean;
};

export const VoteButton = ({ isLoading, isVoted }: VoteButtonProps) => (
  <Skeleton
    height="32px"
    width="200px"
    loading={isLoading}
    className="rounded-lg"
  >
    <div>
      {isVoted ? (
        <Button
          colorVariant="accent"
          className="rounded-lg w-full"
          variant="outline"
        >
          You voted
        </Button>
      ) : (
        <Button
          colorVariant="accent"
          className="rounded-lg w-full"
          variant="outline"
        >
          Vote now
        </Button>
      )}
    </div>
  </Skeleton>
);
