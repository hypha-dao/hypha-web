'use client';

import { Button } from '@hypha-platform/ui';
import { useJoinSpace } from '../hooks/use-join-space';
import { PersonIcon } from '@radix-ui/react-icons';

type JoinSpaceProps = {
  spaceId: number;
};

export const JoinSpace = ({ spaceId }: JoinSpaceProps) => {
  const { isMember, isLoading, joinSpace } = useJoinSpace({ spaceId });

  return (
    <Button
      disabled={isMember || isLoading}
      onClick={() => joinSpace()}
      className="ml-2 rounded-lg"
      colorVariant={isMember ? 'neutral' : 'accent'}
      variant={isMember ? 'outline' : 'default'}
    >
      <PersonIcon className="mr-2" width={16} height={16} />
      {isMember ? 'Already member' : 'Become member'}
    </Button>
  );
};
