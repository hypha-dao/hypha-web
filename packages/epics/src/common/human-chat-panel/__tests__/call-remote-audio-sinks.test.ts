import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import {
  buildRemoteCallAudioSinkEntries,
  callAudioStreamSignature,
  remoteCallAudioSinkKey,
} from '../call-feed-tile-audio';
import { feedKey } from '../call-feed-key';

type TestFeed = {
  userId: string;
  deviceId: string;
  purpose: 'user-media' | 'screenshare';
  isLocal: () => boolean;
  stream: MediaStream | undefined;
};

function stream(audioIds: string[]): MediaStream {
  return {
    getAudioTracks: () => audioIds.map((id) => ({ id })),
  } as unknown as MediaStream;
}

function feed(
  userId: string,
  opts: Partial<TestFeed> & { audio?: string[] } = {},
): CallFeed {
  return {
    userId,
    deviceId: opts.deviceId ?? 'd',
    purpose: opts.purpose ?? 'user-media',
    isLocal: opts.isLocal ?? (() => false),
    stream: opts.stream ?? stream(opts.audio ?? ['a-' + userId]),
  } as unknown as CallFeed;
}

describe('buildRemoteCallAudioSinkEntries', () => {
  it('returns one sink per remote participant keyed by userId:deviceId:purpose', () => {
    const entries = buildRemoteCallAudioSinkEntries(
      [feed('@a:x'), feed('@b:x')],
      [],
      '@me:x',
    );
    expect(entries.map((e) => e.key)).toEqual([
      '@a:x:d:user-media',
      '@b:x:d:user-media',
    ]);
  });

  it('has no sink for local feeds, including a userId match', () => {
    const entries = buildRemoteCallAudioSinkEntries(
      [feed('@me:x', { isLocal: () => true }), feed('@me:x'), feed('@a:x')],
      [],
      '@me:x',
    );
    expect(entries.map((e) => e.key)).toEqual(['@a:x:d:user-media']);
  });

  it('mounts screenshare audio only when the share has an audio track', () => {
    const share = (audio: string[]) =>
      feed('@a:x', { purpose: 'screenshare', audio });
    expect(
      buildRemoteCallAudioSinkEntries([], [share([])], '@me:x'),
    ).toHaveLength(0);
    const entries = buildRemoteCallAudioSinkEntries(
      [],
      [share(['s'])],
      '@me:x',
    );
    expect(entries.map((e) => e.key)).toEqual(['@a:x:d:screenshare']);
  });

  it('keeps camera and share audio of one user as separate stable sinks', () => {
    const entries = buildRemoteCallAudioSinkEntries(
      [feed('@a:x')],
      [feed('@a:x', { purpose: 'screenshare', audio: ['s'] })],
      '@me:x',
    );
    expect(entries.map((e) => e.key)).toEqual([
      '@a:x:d:user-media',
      '@a:x:d:screenshare',
    ]);
  });

  it('keeps a separate sink per session of one user', () => {
    const entries = buildRemoteCallAudioSinkEntries(
      [feed('@a:x', { deviceId: 'old' }), feed('@a:x', { deviceId: 'new' })],
      [],
      '@me:x',
    );
    expect(entries.map((e) => e.key)).toEqual([
      '@a:x:old:user-media',
      '@a:x:new:user-media',
    ]);
  });

  it('keys do not depend on feed order, so speaker/layout reordering keeps them', () => {
    const a = feed('@a:x');
    const b = feed('@b:x');
    const keys = (feeds: CallFeed[]) =>
      buildRemoteCallAudioSinkEntries(feeds, [], '@me:x')
        .map((e) => e.key)
        .sort();
    expect(keys([a, b])).toEqual(keys([b, a]));
    expect(remoteCallAudioSinkKey(a)).toBe(
      remoteCallAudioSinkKey(feed('@a:x')),
    );
  });
});

describe('callAudioStreamSignature', () => {
  it('is stable across rebuilt streams with the same audio tracks', () => {
    expect(callAudioStreamSignature(stream(['t1']))).toBe(
      callAudioStreamSignature(stream(['t1'])),
    );
  });
  it('changes when the audio track changes and is empty without audio', () => {
    expect(callAudioStreamSignature(stream(['t1']))).not.toBe(
      callAudioStreamSignature(stream(['t2'])),
    );
    expect(callAudioStreamSignature(stream([]))).toBe('');
    expect(callAudioStreamSignature(null)).toBe('');
  });
});

const stageSource = readFileSync(
  resolve(__dirname, '../human-chat-panel-call-stage.tsx'),
  'utf8',
);

describe('call stage tile keys and audio sinks (#2708)', () => {
  it('does not put the reactions version (or speaker) in a tile key', () => {
    expect(stageSource).not.toMatch(/key={[^}]*floatingReactionsVersion/);
    expect(stageSource).not.toMatch(/key=\{`[^`]*activeSpeaker/);
  });

  it('feedKey is stable for the same participant and index', () => {
    const f = { userId: '@a:x', deviceId: 'd', purpose: 'user-media' } as never;
    expect(feedKey(f, 2)).toBe('@a:x:d:user-media:2');
  });

  it('mounts no <audio> inside tiles; sinks live in the root list only', () => {
    expect(stageSource).not.toContain('<audio');
    expect(stageSource).toContain('<CallRemoteAudioSinks');
  });
});
