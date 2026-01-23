'use client';

import { Badge, Button, ConfirmDialog } from '@hypha-platform/ui';
import { useExitSpace, useSpaceMember, useMemberWeb3SpaceIds } from '../hooks';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe, useSpaceBySlug, Address } from '@hypha-platform/core/client';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { Locale } from '@hypha-platform/i18n';
import { mutate as mutateCache, type Key } from 'swr';

type ExitSpaceProps = {
  web3SpaceId: number;
  exitButton?: React.ReactNode;
};

export const ExitSpace = ({ web3SpaceId, exitButton }: ExitSpaceProps) => {
  const { isAuthenticated, user } = useAuthentication();
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [justExit, setJustExit] = React.useState(false);
  const [isProcessing, setProcessing] = React.useState(false);
  const router = useRouter();
  const params = useParams<{ id?: string; lang?: Locale }>();
  const { person } = useMe();
  const { space: currentSpace } = useSpaceBySlug(params?.id || '');

  const { exitSpace, isExitingSpace, isDisabled } = useExitSpace({
    spaceId: web3SpaceId,
  });
  const { isMember, isMemberLoading, revalidateIsMember } = useSpaceMember({
    spaceId: web3SpaceId,
  });
  const { mutate: revalidateMemberSpaceIds } = useMemberWeb3SpaceIds({
    personAddress: person?.address as Address | undefined,
  });

  const showLoader = isProcessing || isExitingSpace;
  const disabled =
    !isAuthenticated ||
    isExitingSpace ||
    isMemberLoading ||
    isDisabled ||
    !isMember ||
    justExit;

  const handleExitSpace = React.useCallback(async () => {
    if (disabled) {
      return;
    }
    setProcessing(true);
    try {
      setJustExit(true);
      await exitSpace();
      await revalidateIsMember();

      await revalidateMemberSpaceIds();

      if (user?.wallet?.address && user.wallet.address !== person?.address) {
        await mutateCache(
          (key: Key) => {
            if (!Array.isArray(key)) return false;
            const [address, cacheKey] = key;
            return (
              typeof address === 'string' &&
              address.toLowerCase() === user.wallet?.address?.toLowerCase() &&
              cacheKey === 'getMemberAndDelegatedSpaces'
            );
          },
          undefined,
          { revalidate: true },
        );
      }

      await mutateCache(
        (key: Key) => {
          if (!Array.isArray(key)) return false;
          const [, cacheKey] = key;
          return cacheKey === 'getMemberAndDelegatedSpaces';
        },
        undefined,
        { revalidate: true },
      );

      if (currentSpace?.web3SpaceId === web3SpaceId && params?.lang) {
        router.push(`/${params.lang}/my-spaces`);
      }
    } catch (err) {
      setJustExit(false);
      console.error('Failed to exit space:', err);
      setShowTooltip(true);
    } finally {
      setProcessing(false);
    }
  }, [
    exitSpace,
    revalidateIsMember,
    revalidateMemberSpaceIds,
    currentSpace,
    web3SpaceId,
    params,
    router,
    disabled,
    user,
    person,
  ]);

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

  React.useEffect(() => {
    if (isMemberLoading || typeof isMember === 'undefined') {
      return;
    }
    if (isMember) {
      setJustExit(false);
    }
  }, [isMember, isMemberLoading]);

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
      {showLoader && (
        <Loader2 className="animate-spin" width={16} height={16} />
      )}
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
