// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  registerCallPlaybackElement,
  resetCallPlaybackRegistryForTests,
  resumeCallPlayback,
} from '../call-playback-registry';

const commonDir = resolve(__dirname, '../..');
const readCommonSource = (file: string) =>
  readFileSync(resolve(commonDir, file), 'utf8');

describe('CSH-QA-1 sidebar banner with floating dock (row 1)', () => {
  it('showSidebarCallChrome does not depend on showFloatingDock', () => {
    const source = readCommonSource('human-right-panel.tsx');
    const match = source.match(/const showSidebarCallChrome = ([^;]+);/);
    expect(match?.[1]).toBeDefined();
    expect(match?.[1]).not.toContain('showFloatingDock');
  });

  it('call join strip uses compact single-line warning-style layout', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-join-strip.tsx',
    );
    expect(source).toContain('callJoinStripLine');
    expect(source).toContain('min-h-9 flex-wrap items-center');
    expect(source).not.toContain('flex-col gap-3');
    expect(source).toContain('size="sm"');
    expect(source).toContain('shrink-0 gap-1');
  });

  it('hides start-call toolbar while in session or when join strip is shown', () => {
    const source = readCommonSource('human-right-panel.tsx');
    expect(source).toContain('!inSpaceCall');
    expect(source).toContain('!spaceCallShowJoinStrip');
    const tabRow = source.slice(
      source.indexOf('tabRowEnd={'),
      source.indexOf('<HumanChatPanelCallJoinStrip'),
    );
    expect(tabRow).toContain('!inSpaceCall');
    expect(tabRow).toContain('!spaceCallShowJoinStrip');
  });

  it('touch dock shows in-call status banner above controls', () => {
    const source = readCommonSource('global-call-dock-overlay.tsx');
    expect(source).toContain('showTouchDockCallStatusBanner');
    expect(source).toContain('participantRowOnly');
  });

  it('sidebar call banner stays visible while the dock is open', () => {
    const source = readCommonSource('human-right-panel.tsx');
    const bannerStart = source.indexOf('{showSidebarCallChrome &&');
    const leaveOnly = source.indexOf('controlsMode="leave_only"', bannerStart);
    expect(bannerStart).toBeGreaterThan(-1);
    expect(leaveOnly).toBeGreaterThan(bannerStart);
    const bannerBlock = source.slice(bannerStart, leaveOnly);
    expect(bannerBlock).not.toContain('!showFloatingDock');
    expect(bannerBlock).toContain(
      'participantCount={spaceCallRoomGroupDeviceCount}',
    );
    expect(bannerBlock).toContain('onLeave={handleCallLeave}');
  });

  it('call banner renders participant count and leave control', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-banner.tsx',
    );
    expect(source).toContain('participantCount');
    expect(source).toContain('onLeave');
    expect(source).toContain('callBannerInCallWithOthers');
    expect(source).toContain('controlsMode');
  });
});

describe('CSH-QA-2 share handoff through warming (row 2)', () => {
  it('keeps share layout while remote feed warms during handoff', async () => {
    const { resolveCallStageShareLayout } = await import(
      '../call-stage-share-layout'
    );
    const layout = resolveCallStageShareLayout({
      rawShareFeeds: [
        {
          isLocal: () => false,
          isVideoMuted: () => false,
          userId: '@presenter:hs',
          deviceId: 'dev',
          stream: {
            id: 'stream-1',
            getVideoTracks: () => [
              {
                readyState: 'new',
                muted: false,
                enabled: true,
              } as unknown as MediaStreamTrack,
            ],
          },
        } as never,
      ],
      isScreensharing: false,
      isVideoCall: true,
    });
    expect(layout.shareFeeds).toHaveLength(1);
    expect(layout.hasPendingRemoteShare).toBe(false);
    expect(layout.hasRenderableShare).toBe(true);
  });

  it('shows warming indicator in call stage when track is not live', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-stage.tsx',
    );
    expect(source).toContain('hasWarmingCallFeedVideoTrack');
    expect(source).toContain('warmingVideoTrack');
  });
});

describe('CSH-SHARE-3 single presenter (one share at a time)', () => {
  it('blocks local share start when another participant is presenting', () => {
    const source = readFileSync(
      resolve(
        commonDir,
        '../../../core/src/matrix/client/hooks/use-space-group-call.ts',
      ),
      'utf8',
    );
    expect(source).toContain('isRemoteScreenshareActive(gc)');
    expect(source).not.toContain(
      "sendScreenshareTakeoverEvent(\n              'request'",
    );
  });

  it('disables share menu while remote share is active', () => {
    const controls = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    const menu = readCommonSource(
      'human-chat-panel/human-chat-panel-call-screenshare-menu.tsx',
    );
    expect(controls).toContain('remoteScreenshareActive');
    expect(menu).toContain('callScreenshareBlockedRemoteActive');
  });
});

describe('WCUX-SHARE-AUDIO tab share + muted badge (row 3)', () => {
  it('requests tab audio in display-media constraints', () => {
    const source = readFileSync(
      resolve(
        commonDir,
        '../../../core/src/matrix/client/hooks/screenshare-capture.ts',
      ),
      'utf8',
    );
    expect(source).toContain('suppressLocalAudioPlayback: false');
    expect(source).toContain('systemAudio:');
    expect(source).toContain("case 'browser':");
    expect(source).toContain('systemAudio:');
  });

  it('mounts remote share audio sinks and suppresses false muted badges', async () => {
    const { shouldMountRemoteCallAudioSink, shouldShowCallFeedMutedBadge } =
      await import('../call-feed-tile-audio');
    const shareFeed = {
      isLocal: () => false,
      isAudioMuted: () => true,
      stream: { getAudioTracks: () => [{}] },
    } as never;
    expect(shouldMountRemoteCallAudioSink(shareFeed, true)).toBe(true);
    expect(
      shouldShowCallFeedMutedBadge({
        isLocal: false,
        isShare: true,
        feedAudioMuted: true,
      }),
    ).toBe(false);
  });
});

describe('WCUX-QUALITY debug overlay and capture (row 9)', () => {
  it('supports hypha.callDebug localStorage for support sessions', () => {
    const source = readFileSync(
      resolve(
        commonDir,
        '../../../core/src/matrix/client/matrix-webrtc-env.ts',
      ),
      'utf8',
    );
    expect(source).toContain('hypha.callDebug');
    expect(source).toContain('isMatrixCallDebugLocalStorageEnabled');
  });

  it('does not render frame dimension labels on video tiles', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-stage.tsx',
    );
    expect(source).not.toContain('useCallFeedVideoDebugDimensions');
    expect(source).not.toContain('videoDebugDimensions');
  });

  it('keeps participant name labels inside tiles without top-edge clipping', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-stage.tsx',
    );
    const feedStart = source.indexOf('const FeedContent =');
    const feedBlock = source.slice(feedStart);
    expect(feedBlock).toContain('resolveCallFeedVideoParticipantLabelLayout');
    expect(feedBlock).not.toMatch(/top-1 flex-row items-center gap-1\.5/);
  });

  it('centers audio-only tile chrome inside the tile box', () => {
    const source = readCommonSource(
      'human-chat-panel/call-feed-tile-chrome.ts',
    );
    expect(source).toContain('items-center justify-center');
    expect(source).not.toContain('items-start justify-start');
  });

  it('enforces minimum video participant label chip height (WCUX-LAYOUT-5)', () => {
    const source = readCommonSource(
      'human-chat-panel/call-feed-tile-chrome.ts',
    );
    expect(source).toContain('min-h-[1.75rem]');
    expect(source).toContain('CALL_FEED_VIDEO_LABEL_CHIP_TONE_CLASS');
    expect(source).toContain('CALL_FEED_VIDEO_LABEL_NAME_CLASS');
    expect(source).toContain('!text-zinc-50');
    expect(source).toContain('w-max');
    expect(source).not.toMatch(/inset-x-0 bottom-0/);
  });

  it('dock resize corners use a single grip path (no double L)', () => {
    const source = readCommonSource('global-call-dock-overlay.tsx');
    const gripBlock = source.slice(
      source.indexOf('function DockCornerGrip'),
      source.indexOf('function DockResizeHandle'),
    );
    expect(gripBlock).toContain('const pathD =');
    expect(gripBlock.match(/<path/g)?.length ?? 0).toBe(1);
    expect(gripBlock).not.toContain('M3.5 10V3.5h6.5');
  });

  it('uses a single inset ring for active speaker (no duplicate corner borders)', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-stage.tsx',
    );
    const feedStart = source.indexOf('const FeedContent =');
    expect(feedStart).toBeGreaterThan(-1);
    const feedBlock = source.slice(feedStart);
    expect(feedBlock).toContain('activeSpeakerRingClass');
    expect(feedBlock).toContain('ring-2 ring-inset');
    expect(feedBlock).toContain('pointer-events-none absolute inset-0 z-[8]');
    expect(feedBlock).toContain('active-speaker ring renders above video');
    expect(feedBlock).not.toContain('absolute inset-0 z-[6] border-2');
  });

  it('requests 720p ideal camera capture on join', () => {
    const source = readFileSync(
      resolve(
        commonDir,
        '../../../core/src/matrix/client/hooks/call-video-capture-constraints.ts',
      ),
      'utf8',
    );
    expect(source).toContain('ideal: 1280');
    expect(source).toContain('ideal: 720');
  });

  it('downscales thumbnail receivers when N ≥ 5', () => {
    const source = readFileSync(
      resolve(
        commonDir,
        '../../../core/src/matrix/client/hooks/call-thumbnail-receiver-downscale.ts',
      ),
      'utf8',
    );
    expect(source).toContain('scaleResolutionDownBy');
  });

  it('logs inbound RTP frame sizes when support debug is enabled', () => {
    const source = readFileSync(
      resolve(
        commonDir,
        '../../../core/src/matrix/client/hooks/group-call-webrtc-diagnostics.ts',
      ),
      'utf8',
    );
    expect(source).toContain('hypha.group_call.inbound_rtp_frame_size');
    expect(source).toContain('frameWidth');
    expect(source).toContain('frameHeight');
  });
});

describe('WCUX-PIP remote audio on PiP open/close (row 11)', () => {
  beforeEach(() => {
    resetCallPlaybackRegistryForTests();
  });

  it('keeps remote audio on the main document, not only in PiP', async () => {
    const { resolveCallAudioPortalTarget } = await import(
      '../call-feed-tile-audio'
    );
    const mainBody = { tagName: 'BODY' } as HTMLBodyElement;
    expect(resolveCallAudioPortalTarget({ body: mainBody })).toBe(mainBody);
  });

  it('resumeCallPlayback() replays registered media elements', async () => {
    const audio = document.createElement('audio');
    audio.srcObject = {} as MediaStream;
    audio.play = vi.fn().mockResolvedValue(undefined);
    registerCallPlaybackElement(audio);
    await resumeCallPlayback();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('keepalive hook resumes playback when PiP visibility changes', () => {
    const source = readCommonSource('use-call-document-keepalive.ts');
    expect(source).toContain('resumeCallPlayback');
    expect(source).toMatch(/\[active, documentPipOpen\]/);
    expect(source).toContain('document.hidden || documentPipOpen');
    expect(source).not.toMatch(
      /void requestWakeLock\(\);\s*\n\s*if \(document\.hidden/,
    );
  });
});

describe('CSH-QA-3–5 stability hardening (W7)', () => {
  it('stall banner distinguishes warming vs connection problem', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-banner.tsx',
    );
    expect(source).toContain('callRemoteMediaWarmingHint');
    expect(source).toContain('callRemoteMediaStallHint');
    expect(source).toContain('callRemoteMediaStallRetry');
  });

  it('scale warning banner is wired in sidebar and dock', () => {
    const sidebar = readCommonSource('human-right-panel.tsx');
    const dock = readCommonSource('global-call-dock-overlay.tsx');
    expect(sidebar).toContain('shouldShowCallScaleWarning');
    expect(sidebar).toContain('showScaleWarning={showCallScaleWarning}');
    expect(dock).toContain('showScaleWarning={showCallScaleWarning}');
  });

  it('join invitation modal opens from Human panel', () => {
    const source = readCommonSource('human-right-panel.tsx');
    expect(source).toContain('HumanChatPanelCallJoinInvitation');
    expect(source).toContain('useCallJoinInvitation');
  });

  it('follower tab shows call-specific leadership prompt', () => {
    const panel = readCommonSource('human-right-panel.tsx');
    const banner = readCommonSource(
      'human-chat-panel/human-chat-panel-connection-banner.tsx',
    );
    expect(panel).toContain('useActiveCallInAnotherTab');
    expect(panel).toContain('activeCallInAnotherTab={activeCallInAnotherTab}');
    expect(banner).toContain('callActiveInAnotherTabTitle');
    expect(banner).toContain('callFollowerSyncPausedDescription');
  });

  it('signal deep-link lookup retries before surfacing errors', () => {
    const source = readCommonSource('human-right-panel.tsx');
    expect(source).toContain('resolveSignalDeepLinkWithRetry');
    expect(source).toContain('signalDeepLinkAuthNotReady');
  });
});

describe('WCUX-LAYOUT local self-view (corner PiP)', () => {
  it('disables corner PiP so local video stays in the main grid', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-stage.tsx',
    );
    const block = source.slice(
      source.indexOf('const showFloatingLocalPip ='),
      source.indexOf('const speakerFeedForTopMode'),
    );
    expect(block).toContain('const showFloatingLocalPip = false');
  });
});

describe('WCUX-REACT in-call reactions and raise hand (W8)', () => {
  it('reuses a shared group-call reaction anchor', () => {
    const source = readFileSync(
      resolve(
        __dirname,
        '../../../../../core/src/matrix/client/hooks/use-space-group-call.ts',
      ),
      'utf8',
    );
    expect(source).toContain('ensureCallReactionAnchor');
    expect(source).toContain('groupCallId: gc.groupCallId');
    expect(source).toContain('callSessionAnchorEventId');
  });

  it('react popover sits before leave in in-call controls', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    expect(source).toContain('HumanChatPanelCallReactPopover');
    expect(source).toContain('HumanChatPanelCallScreenshareMenu');
    expect(source).toContain('callReactionsToolbarVisible');
    expect(source).toContain('reactionsSendReady');
    const toolbarStart = source.indexOf('<HumanChatPanelCallScreenshareMenu');
    const leaveIdx = source.indexOf('onClick={onLeave}', toolbarStart);
    const reactIdx = source.indexOf(
      '<HumanChatPanelCallReactPopover',
      toolbarStart,
    );
    expect(leaveIdx).toBeGreaterThan(toolbarStart);
    expect(reactIdx).toBeGreaterThan(toolbarStart);
    expect(reactIdx).toBeLessThan(leaveIdx);
  });

  it('uses balanced phone grid instead of speaker strip on mobile panel', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-stage.tsx',
    );
    expect(source).toContain('getCallPanelMobileGridLayout');
    expect(source).toContain('participantGridTileCount');
    expect(source).toContain('useMobileBalancedParticipantGrid');
    expect(source).toContain('useMobilePaginatedParticipantGallery');
    expect(source).toContain('!useMobileBalancedParticipantGrid');
    expect(source).toContain('panelMobileLayout');
    expect(source).toMatch(
      /layout === 'panel' && !isFull && isPhonePanelLayout/,
    );
    expect(source).toContain('layoutViewportTier');
    expect(source).toContain(
      "isMobilePanelStage && !isDocumentPipOpen ? 'V-S'",
    );
    expect(source).toContain('shareMobilePanelGrid');
  });

  it('uses symmetrical dock toolbar groups (mic/cam | share/hangup/react | record/sound)', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    expect(source).toContain('useSymmetricalDockToolbar');
    expect(source).toContain('grid-cols-[1fr_auto_1fr]');
    expect(source).toContain('justify-end');
    expect(source).toContain('justify-start');
    expect(source).toContain(
      'flex w-full items-center justify-center gap-2.5 px-2',
    );
    expect(source).not.toContain('useDockSpreadToolbar');
    expect(source).not.toContain('justify-evenly');
  });

  it('closes other toolbar menus when reactions capture or audio opens', () => {
    const controls = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    expect(controls).toContain('closeOtherToolbarMenus');
    expect(controls).toContain('isReactMenuOpen');
    expect(controls).toContain("closeOtherToolbarMenus('react')");
    expect(controls).toContain("closeOtherToolbarMenus('capture')");
    expect(controls).toContain("closeOtherToolbarMenus('audio')");
    expect(controls).toMatch(
      /setIsCaptureMenuOpen\(false\)[\s\S]*setIsReactMenuOpen/,
    );
  });

  it('uses in-banner toolbar chrome on desktop fullscreen dock', () => {
    const source = readCommonSource('global-call-dock-overlay.tsx');
    expect(source).toContain("const dockControlsVariant = 'inBanner'");
    expect(source).not.toContain("? 'inBanner' : 'fullView'");
  });

  it('uses a neutral share button that turns green only while presenting', () => {
    const controls = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    const menu = readCommonSource(
      'human-chat-panel/human-chat-panel-call-screenshare-menu.tsx',
    );
    const prompt = readCommonSource(
      'human-chat-panel/use-screenshare-tab-audio-prompt.tsx',
    );
    const capture = readFileSync(
      resolve(
        commonDir,
        '../../../core/src/matrix/client/hooks/screenshare-capture.ts',
      ),
      'utf8',
    );
    expect(controls).toContain('shareIdleBtn = neutralBtn');
    expect(controls).toContain(
      'isScreensharing ? shareActiveBtn : shareIdleBtn',
    );
    expect(menu).not.toContain('SHARE_MODES');
    expect(menu).not.toContain('ChevronDown');
    expect(menu).not.toContain('callShareModeMenuLabel');
    expect(prompt).toContain("surfaceMode: 'browser'");
    expect(capture).toContain("case 'browser':");
    expect(capture).toContain(
      "DEFAULT_SCREENSHARE_SURFACE_MODE: CallScreenshareSurfaceMode = 'browser'",
    );
  });

  it('hides Document PiP while share UX is stabilized', () => {
    const source = readCommonSource('global-call-dock-overlay.tsx');
    expect(source).toContain('CALL_DOCUMENT_PIP_ENABLED');
    expect(source).toContain('!CALL_DOCUMENT_PIP_ENABLED');
  });

  it('keeps the floating dock outside the screen-share capture root', () => {
    const layout = readFileSync(
      resolve(__dirname, '../../../../../../apps/web/src/app/layout.tsx'),
      'utf8',
    );
    const panelEnd = layout.indexOf('</PanelWrapLayout>');
    const dockMount = layout.indexOf('<ConnectedGlobalCallDock');
    expect(panelEnd).toBeGreaterThan(-1);
    expect(dockMount).toBeGreaterThan(panelEnd);
  });

  it('floating reactions and raised-hand badge render on call tiles', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-stage.tsx',
    );
    expect(source).toContain('CallFloatingReactionOverlay');
    expect(source).toContain('callRaiseHandBadge');
    expect(source).toContain('CallRaiseHandBadge');
    expect(source).toContain('callRaiseHandBadgeOrder');
    expect(source).toContain('getRaiseHandOrder');
    expect(source).toContain('hyphaAvatarUrl');
  });

  it('raised-hands strip is wired above dock controls', () => {
    const source = readCommonSource('global-call-dock-overlay.tsx');
    expect(source).toContain('HumanChatPanelCallRaisedHandsStrip');
    expect(source).toContain('raisedHands.length > 0');
  });

  it('react popover exposes stable e2e test ids', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-react-popover.tsx',
    );
    expect(source).toContain('data-testid="call-react-trigger"');
    expect(source).toContain('data-testid="call-react-popover-content"');
    expect(source).toContain('data-testid="call-raise-hand-button"');
    expect(source).toContain('data-testid="call-be-right-back-button"');
    expect(source).toContain('absolute bottom-full right-0');
    expect(source).not.toContain('PopoverTrigger');
  });

  it('shows pause icon on capture toolbar button when recording is paused', () => {
    const controls = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    expect(controls).toContain(
      "const capturePaused = recordingStatus === 'paused'",
    );
    expect(controls).toMatch(/capturePaused\s*\?[\s\S]*<Pause/);
  });

  it('screenshare dock toolbar exposes only mic camera and share', () => {
    const controls = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    const dock = readCommonSource('global-call-dock-overlay.tsx');
    expect(controls).toContain('screenshare_essential');
    expect(controls).toContain('screenshareEssentialToolbar');
    expect(dock).toContain(
      "isScreensharing ? 'screenshare_essential' : 'full'",
    );
  });

  it('capture and audio menu triggers use circular toolbar footprint', () => {
    const controls = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    expect(controls).toContain('toolbarMenuTriggerBtn');
    expect(controls).toContain('h-8 w-8 px-0');
    expect(controls).toContain('h-10 w-10 min-h-10 min-w-10');
  });

  it('react trigger accents only the heart icon when active', () => {
    const popover = readCommonSource(
      'human-chat-panel/human-chat-panel-call-react-popover.tsx',
    );
    expect(popover).toContain('reactTriggerActive');
    expect(popover).toContain('reactionsSendReady');
    expect(popover).toContain('emojiActionsDisabled');
    expect(popover).toContain('callAccentToolbarHeartActive');
    const accentStyles = readCommonSource(
      'human-chat-panel/call-accent-alert-styles.ts',
    );
    expect(accentStyles).toContain('callAccentToolbarHeartActive');
    expect(accentStyles).toContain('var(--space-accent,var(--color-accent-9');
    expect(popover).toContain('border-border/60 bg-background');
    expect(popover).not.toContain('callAccentToolbarTriggerActive');
    expect(popover).not.toContain('callAccentToolbarTriggerIdle');
    expect(popover).not.toContain('amber-500');
    expect(popover).not.toContain('border-primary/40');
  });

  it('react trigger is icon-only with animated chevron', () => {
    const popover = readCommonSource(
      'human-chat-panel/human-chat-panel-call-react-popover.tsx',
    );
    const controls = readCommonSource(
      'human-chat-panel/human-chat-panel-in-call-controls.tsx',
    );
    expect(popover).not.toContain("font-medium\">{t('callReactButton')}");
    expect(popover).toContain('transition-transform duration-200');
    expect(popover).toContain("open && 'rotate-180'");
    expect(controls).toContain('menuChevronClass');
    expect(controls).toContain('menuChevronClass(isCaptureMenuOpen)');
    expect(controls).toContain('menuChevronClass(isAudioMenuOpen)');
  });

  it('react popover follows Zoom-style sections', () => {
    const source = readCommonSource(
      'human-chat-panel/human-chat-panel-call-react-popover.tsx',
    );
    expect(source).toContain('rounded-xl');
    expect(source).toContain('CallReactMenuSection');
    expect(source).toContain('sectionDivider');
    expect(source).toContain('callReactSendWithEffect');
    expect(source).toContain('callReactReactionsSection');
    expect(source).toContain('CALL_SEND_WITH_EFFECT_EMOJIS');
    expect(source).toContain('min-w-56');
    expect(source).toContain('px-2 py-1.5 text-sm font-semibold');
    expect(source).toContain('CALL_FEEDBACK_REACTIONS');
    expect(source).not.toContain('callReactQuickReactions');
    expect(source).not.toContain('callRaiseHandDescription');
  });

  it('call banner alert i18n keys exist in all locales', () => {
    const keys = [
      'callRemoteMediaWarmingHint',
      'callRemoteMediaStallRetry',
      'callScaleWarningMessage',
      'callSessionRefreshFailedDescription',
      'callSessionRefreshFailedReconnect',
      'callShareTabAudioNotShared',
      'callShareTabAudioPickerHint',
      'callShareTabAudioRetry',
      'callShareTabAudioPromptTitle',
      'callShareTabAudioPromptDescription',
      'callShareTabAudioPromptContinue',
      'callShareTabAudioPromptCancel',
      'callVoiceBoostWhilePresenting',
    ];
    for (const locale of ['en', 'de', 'es', 'fr', 'pt']) {
      const raw = readFileSync(
        resolve(__dirname, `../../../../../i18n/src/messages/${locale}.json`),
        'utf8',
      );
      for (const key of keys) {
        expect(raw).toContain(`"${key}"`);
      }
    }
  });

  it('call toolbar uses fixed 28px buttons so icons do not overlap on mobile', () => {
    const toolbar = readCommonSource(
      'human-chat-panel/human-chat-panel-call-toolbar.tsx',
    );
    expect(toolbar).toContain('h-[28px] w-[28px]');
    expect(toolbar).toContain('flex-none');
    expect(toolbar).not.toMatch(/className=\{cn\([^)]*stroke-2/);
    const tabs = readCommonSource('human-chat-panel/human-chat-panel-tabs.tsx');
    expect(tabs).toContain('min-w-max');
    expect(tabs).toContain('z-10');
  });

  it('reaction i18n keys exist in all locales', () => {
    const keys = [
      'callReactButton',
      'callReactSendWithEffect',
      'callReactBeRightBack',
      'callRaiseHand',
      'callRaisedHandsTitle',
    ];
    for (const locale of ['en', 'de', 'es', 'fr', 'pt']) {
      const raw = readFileSync(
        resolve(__dirname, `../../../../../i18n/src/messages/${locale}.json`),
        'utf8',
      );
      for (const key of keys) {
        expect(raw).toContain(`"${key}"`);
      }
    }
  });
});
