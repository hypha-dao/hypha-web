'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useJwt, useMatrix } from '@hypha-platform/core/client';
import { HumanChatPanelCallJoinStrip } from '../../common/human-chat-panel/human-chat-panel-call-join-strip';
import { useGlobalCallDock } from '../../common/global-call-dock-context';
import {
  UserSpaceState,
  useUserSpaceState,
} from '../hooks/use-user-space-state';

type SpaceCallJoinHeroBannerProps = {
  spaceSlug: string;
  chatRoomId?: string | null;
  web3SpaceId?: number;
  spaceTitle?: string | null;
};

export function SpaceCallJoinHeroBanner({
  spaceSlug,
  chatRoomId,
  web3SpaceId,
  spaceTitle,
}: SpaceCallJoinHeroBannerProps) {
  const { jwt: authToken } = useJwt();
  const {
    isMatrixAvailable,
    isAuthenticated: isMatrixAuthenticated,
    isMatrixSyncLeader,
  } = useMatrix();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthentication();
  const { userState, isLoading: isUserSpaceStateLoading } = useUserSpaceState({
    spaceSlug,
    spaceId: web3SpaceId,
  });
  const {
    bindRoomContext,
    showRoomCallInProgress,
    roomGroupCallDeviceCount,
    callState,
    captureConsent,
    startAudioForRoom,
    startVideoForRoom,
    pinnedCallSpaceSlug,
    activeRoomId,
  } = useGlobalCallDock();

  const canonicalRoomId = chatRoomId?.trim() || null;
  const slug = spaceSlug.trim();

  useEffect(() => {
    if (!canonicalRoomId || !slug) return;
    bindRoomContext(canonicalRoomId, slug, authToken?.trim() || null);
  }, [authToken, bindRoomContext, canonicalRoomId, slug]);

  const isSpaceMember = userState === UserSpaceState.LOGGED_IN_SPACE;
  const callUiEnabled =
    Boolean(canonicalRoomId) &&
    isMatrixAvailable &&
    isMatrixAuthenticated &&
    isSpaceMember &&
    isMatrixSyncLeader;

  const inSpaceCall =
    callState === 'connected' ||
    callState === 'connecting' ||
    callState === 'awaiting_media' ||
    callState === 'initializing';

  const spaceCallBusyJoining =
    callState === 'connecting' || callState === 'initializing';

  const appliesToThisSpace = useMemo(() => {
    const pinned = pinnedCallSpaceSlug?.trim() || null;
    if (!pinned) return true;
    return pinned === slug;
  }, [pinnedCallSpaceSlug, slug]);

  const roomMatches =
    !activeRoomId?.trim() ||
    !canonicalRoomId ||
    activeRoomId.trim() === canonicalRoomId;

  const showBanner =
    !isAuthLoading &&
    !isUserSpaceStateLoading &&
    callUiEnabled &&
    appliesToThisSpace &&
    roomMatches &&
    showRoomCallInProgress &&
    roomGroupCallDeviceCount > 0 &&
    !inSpaceCall;

  const launchContext = useMemo(() => {
    const roomTitle = spaceTitle?.trim();
    return roomTitle ? { roomTitle } : undefined;
  }, [spaceTitle]);

  const handleJoinAudio = useCallback(() => {
    void startAudioForRoom(
      canonicalRoomId,
      slug,
      undefined,
      authToken,
      launchContext,
    );
  }, [authToken, canonicalRoomId, launchContext, slug, startAudioForRoom]);

  const handleJoinVideo = useCallback(() => {
    void startVideoForRoom(
      canonicalRoomId,
      slug,
      undefined,
      authToken,
      launchContext,
    );
  }, [authToken, canonicalRoomId, launchContext, slug, startVideoForRoom]);

  if (!showBanner || !isAuthenticated) {
    return null;
  }

  return (
    <HumanChatPanelCallJoinStrip
      variant="hero"
      deviceCount={roomGroupCallDeviceCount}
      disabled={!callUiEnabled}
      busy={spaceCallBusyJoining}
      captureConsent={captureConsent}
      roomId={canonicalRoomId}
      onJoinAudio={handleJoinAudio}
      onJoinVideo={handleJoinVideo}
    />
  );
}
