'use client';

import { Badge, Button, ConfirmDialog } from '@hypha-platform/ui';
import { useExitSpace, useSpaceMember } from '../hooks';
import { useAuthentication } from '@hypha-platform/authentication';
import React from 'react';

type ExitSpaceProps = {
  web3SpaceId: number;
  exitButton?: React.ReactNode;
};

export const ExitSpace = ({ web3SpaceId, exitButton }: ExitSpaceProps) => {
  const { isAuthenticated } = useAuthentication();
  const [showTooltip, setShowTooltip] = React.useState(false);

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
    if (disabled) {
      return;
    }
    try {
      await exitSpace();
      await revalidateIsMember();
    } catch (err) {
      console.error('Failed to exit space:', err);
      setShowTooltip(true);
    }
  }, [exitSpace, revalidateIsMember, disabled]);

  React.useEffect(() => {
    if (!showTooltip) {
      return;
    }
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [showTooltip]);

  interface ExitButtonProps extends React.ReactElement {
    disabled?: boolean;
  }
  const button = exitButton ? (
    exitButton
  ) : (
    <Button
      colorVariant="accent"
      variant="outline"
      className="relative"
      title={
        disabled
          ? 'You need to be authorized and to be a member of current space to be able to exit'
          : undefined
      }
      disabled={disabled}
    >
      Exit Space
      {showTooltip && (
        <Badge
          variant="surface"
          colorVariant="error"
          className="absolute z-[1000] mt-[40px]"
        >
          Could not exit space
        </Badge>
      )}
    </Button>
  );

  if (disabled) {
    return button;
  }

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
