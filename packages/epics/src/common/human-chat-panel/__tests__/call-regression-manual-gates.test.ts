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
              } as unknown as MediaStreamTrack,
            ],
          },
        } as never,
      ],
      isScreensharing: false,
      isVideoCall: true,
    });
    expect(layout.hasPendingRemoteShare).toBe(true);
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
    expect(source).toContain('preferCurrentTab: true');
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
  });
});
