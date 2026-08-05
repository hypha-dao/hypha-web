'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useJwt, useMatrix } from '@hypha-platform/core/client';
import { HumanChatPanelCallJoinStrip } from '../../common/human-chat-panel/human-chat-panel-call-join-strip';
import { useCallMembershipRegistry } from '../../common/human-chat-panel/use-call-membership-registry';
import { useGlobalCallDock } from '../../common/global-call-dock-context';
import {
  UserSpaceState,
  useUserSpaceState,
} from '../hooks/use-user-space-state.web3.rpc';

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
    leave: leaveSpaceCall,
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

  /**
   * This space's own room has an active call, but the user is bound to a *different* one
   * (`!roomMatches`) — `showBanner` above stays hidden for that case by design, so this is a
   * separate signal reusing the same registry the cross-context badge/panel use (#2424).
   * Only excludes the user's own bound room; nothing excludes `canonicalRoomId` itself, since
   * that's exactly the room we're checking here.
   */
  const otherActiveCallEntries = useCallMembershipRegistry({
    excludeRoomIds: [activeRoomId],
    getAccessToken: async () => authToken,
  });
  const currentRoomActiveCallElsewhere = useMemo(
    () =>
      otherActiveCallEntries.find(
        (entry) => entry.roomId === canonicalRoomId,
      ) ?? null,
    [otherActiveCallEntries, canonicalRoomId],
  );
  const showBoundElsewhereBanner =
    !isAuthLoading &&
    !isUserSpaceStateLoading &&
    callUiEnabled &&
    Boolean(currentRoomActiveCallElsewhere) &&
    Boolean(activeRoomId?.trim()) &&
    activeRoomId?.trim() !== canonicalRoomId;

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

  /**
   * Same sequencing as the right panel's `handleJoinCurrentRoomCallInstead`
   * (`human-right-panel.tsx`) — `activeRoomId` only clears via a `useEffect` reacting to
   * `callState === 'idle'`, not synchronously when `leave()`'s promise resolves, so awaiting
   * the promise and immediately joining would race that. Record intent, let an effect fire
   * the join once the room has actually cleared.
   */
  const [pendingCallSwitch, setPendingCallSwitch] = useState<{
    kind: 'audio' | 'video';
    roomId: string;
  } | null>(null);

  const handleJoinInsteadOfBoundCall = useCallback(
    (kind: 'audio' | 'video') => {
      if (activeRoomId?.trim() && activeRoomId.trim() !== canonicalRoomId) {
        const targetRoomId = canonicalRoomId;
        if (!targetRoomId) return;
        setPendingCallSwitch({ kind, roomId: targetRoomId });
        leaveSpaceCall().catch(() => {
          setPendingCallSwitch((prev) =>
            prev && prev.roomId === targetRoomId ? null : prev,
          );
        });
        return;
      }
      if (kind === 'audio') {
        handleJoinAudio();
      } else {
        handleJoinVideo();
      }
    },
    [
      activeRoomId,
      canonicalRoomId,
      leaveSpaceCall,
      handleJoinAudio,
      handleJoinVideo,
    ],
  );

  useEffect(() => {
    if (!pendingCallSwitch) return;
    // This banner instance is bound to `canonicalRoomId`; if it no longer matches the
    // room we meant to join (component reused for a different space), abandon the switch.
    if (pendingCallSwitch.roomId !== canonicalRoomId) {
      setPendingCallSwitch(null);
      return;
    }
    if (activeRoomId?.trim() && activeRoomId.trim() !== canonicalRoomId) return;
    const { kind } = pendingCallSwitch;
    setPendingCallSwitch(null);
    if (kind === 'audio') {
      handleJoinAudio();
    } else {
      handleJoinVideo();
    }
  }, [
    pendingCallSwitch,
    activeRoomId,
    canonicalRoomId,
    handleJoinAudio,
    handleJoinVideo,
  ]);

  if (!isAuthenticated) {
    return null;
  }

  if (showBoundElsewhereBanner && currentRoomActiveCallElsewhere) {
    return (
      <HumanChatPanelCallJoinStrip
        variant="hero"
        deviceCount={currentRoomActiveCallElsewhere.participantCount}
        disabled={!callUiEnabled}
        busy={Boolean(pendingCallSwitch)}
        roomId={canonicalRoomId}
        onJoinAudio={() => handleJoinInsteadOfBoundCall('audio')}
        onJoinVideo={() => handleJoinInsteadOfBoundCall('video')}
      />
    );
  }

  if (!showBanner) {
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
