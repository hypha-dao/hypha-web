import { Button, ConfirmDialog } from '@hypha-platform/ui';
import { useExitSpace, useSpaceMember } from '../hooks';
import { useAuthentication } from '@hypha-platform/authentication';
import React from 'react';

type ExitSpaceProps = {
  web3SpaceId: number;
  exitButton?: React.ReactNode;
};

export const ExitSpace = ({ web3SpaceId, exitButton }: ExitSpaceProps) => {
  const { isAuthenticated } = useAuthentication();

  const { exitSpace, isExitingSpace, isDisabled } = useExitSpace({
    spaceId: web3SpaceId,
  });
  const { isMember, isMemberLoading, revalidateIsMember } = useSpaceMember({
    spaceId: web3SpaceId,
  });

  const disabled =
    !isAuthenticated ||
    isExitingSpace ||
    isMemberLoading ||
    isDisabled ||
    !isMember;

  const handleExitSpace = React.useCallback(async () => {
    try {
      await exitSpace();
      await revalidateIsMember();
    } catch (err) {
      console.error('Failed to exit space:', err);
    }
  }, [exitSpace, revalidateIsMember]);

  const button = exitButton ? (
    exitButton
  ) : (
    <Button
      colorVariant="accent"
      variant="outline"
      title={
        disabled
          ? 'You need to be authorized and to be a member of current space to be able to exit'
          : undefined
      }
      disabled={disabled}
    >
      Exit Space
    </Button>
  );

  return (
    <ConfirmDialog
      title="Exit Space"
      description="Do you really want to exit this space?"
      customAcceptButtonText="Yes, leave"
      customRejectButtonText="No, stay"
      onAcceptClicked={handleExitSpace}
    >
      {button}
    </ConfirmDialog>
  );
};
