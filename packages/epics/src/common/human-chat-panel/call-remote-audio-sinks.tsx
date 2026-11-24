'use client';

import { useEffect, useReducer, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { CallFeedEvent } from 'matrix-js-sdk/lib/webrtc/callFeed';
import {
  callAudioStreamSignature,
  resolveCallAudioPortalTarget,
  type RemoteCallAudioSinkEntry,
} from './call-feed-tile-audio';
import { registerCallPlaybackElement } from './call-playback-registry';

function CallRemoteAudioSink({
  feed,
  inMainDocument,
}: {
  feed: CallFeed;
  /** Document PiP open: dock chrome lives in the PiP window, audio stays on the main page. */
  inMainDocument: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, rebind] = useReducer((n: number) => n + 1, 0);
  const stream = feed.stream ?? null;
  const signature = callAudioStreamSignature(stream);
  const streamRef = useRef(stream);
  streamRef.current = stream;

  useEffect(() => {
    feed.on(CallFeedEvent.NewStream, rebind);
    return () => {
      feed.off(CallFeedEvent.NewStream, rebind);
    };
  }, [feed]);

  useEffect(() => {
    const el = audioRef.current;
    const current = streamRef.current;
    if (!el || !current || signature === '') return;
    el.srcObject = current;
    el.play().catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[CallRemoteAudioSink] audio play rejected', err);
      }
    });
    const releasePlayback = registerCallPlaybackElement(el);
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      el.srcObject = streamRef.current;
      void el.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      releasePlayback();
      el.srcObject = null;
    };
  }, [signature, inMainDocument]);

  const audioSink = (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      aria-hidden
      className={
        inMainDocument
          ? 'pointer-events-none fixed size-0 overflow-hidden opacity-0'
          : undefined
      }
    />
  );
  if (inMainDocument && typeof document !== 'undefined') {
    return createPortal(audioSink, resolveCallAudioPortalTarget(document));
  }
  return audioSink;
}

/**
 * Flat list of remote audio sinks, one per remote feed, keyed by `userId:purpose`.
 * Rendered once at the stage root so layout or active-speaker changes never
 * unmount or re-parent an `<audio>` element (#2708).
 */
export function CallRemoteAudioSinks({
  entries,
  isDocumentPipOpen,
}: {
  entries: RemoteCallAudioSinkEntry<CallFeed>[];
  isDocumentPipOpen: boolean;
}) {
  return (
    <>
      {entries.map((entry) => (
        <CallRemoteAudioSink
          key={entry.key}
          feed={entry.feed}
          inMainDocument={isDocumentPipOpen}
        />
      ))}
    </>
  );
}
