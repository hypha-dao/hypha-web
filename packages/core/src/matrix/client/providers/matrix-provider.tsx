'use client';

import React from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { useAuthentication } from '@hypha-platform/authentication';
import { MatrixTokenData, useMatrixToken } from '../hooks';
import { isMatrixRateLimitedError } from '../hooks/space-group-call-utils';
import type { Message, MessageMediaInfo } from '../../types';
import { attachReactionsToMessage, isValidReactionKey } from '../../reactions';
import {
  buildRichReplyMatrixContent,
  matrixTextEventContentWithOptionalFormatting,
} from '../../chat-markup';
import {
  HYPHA_MEDIA_BUNDLE_FIELD,
  HYPHA_SPOILER_FIELD,
  MATRIX_CUSTOM_HTML_FORMAT,
  awaitNonProvisionalMatrixEventId,
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  messageFromRoomMessageEvent,
  resolveReplyTargetForSend,
  type HyphaMediaBundleItemWire,
} from '../../rich-reply';
import { applyMediaEditCaptionAndReply } from '../../edit-room-message-media-caption';
import {
  mergeMatrixMentionsIntoContent,
  resolveMentionUserIdsForSend,
} from '../../mentions';
import {
  matrixWebRtcFallbackIceAllowedFromEnv,
  matrixWebRtcForceTurnFromEnv,
  matrixWebRtcIceCandidatePoolSizeFromEnv,
} from '../matrix-webrtc-env';
import { createHyphaMatrixClientLogger } from '../matrix-client-logger';

import { isScreenshareTakeoverEvent } from '../hooks/screenshare-takeover';

const CALL_CAPTURE_NOTICE_TYPE = 'io.hypha.call_capture_notice.v1';

function isCallCaptureNoticeEvent(event: MatrixSdk.MatrixEvent): boolean {
  if (event.getType() !== MatrixSdk.EventType.RoomMessage) return false;
  const content = event.getContent() as {
    [CALL_CAPTURE_NOTICE_TYPE]?: boolean;
  };
  return content[CALL_CAPTURE_NOTICE_TYPE] === true;
}

export interface SendAttachmentInput {
  file: File;
  /** Drives Matrix `msgtype`: `m.image` vs `m.file` vs `m.audio`. */
  kind: 'file' | 'image' | 'audio';
  /** Blur in timeline until clicked (`org.hypha.spoiler` on the event). */
  spoiler?: boolean;
}

export type SendMessageUploadProgress = {
  completed: number;
  total: number;
};

export interface SendMessageInput {
  roomId: string;
  message: string;
  /** Explicit MXIDs for Matrix `m.mentions` (optional; otherwise parsed from plaintext `@mxid`). */
  mentionUserIds?: string[];
  /** Rich reply: target m.room.message event id (space chat; not m.thread). */
  replyToEventId?: string;
  /** Uploaded to the homeserver and sent as separate `m.file` / `m.image` events before optional text. */
  attachments?: SendAttachmentInput[];
  /** Fires after each attachment finishes uploading (before the room message is sent). */
  onUploadProgress?: (p: SendMessageUploadProgress) => void;
  /** Aborts upload/send between attachment steps (UI cancel). */
  signal?: AbortSignal;
}

export interface SendMessageResult {
  eventId?: string;
}

/** Existing attachment slot when editing a media `m.room.message` (mxc stays on server). */
export type EditRoomMessageExistingSlot = {
  mxcUrl: string;
  msgtype: 'm.file' | 'm.image' | 'm.audio';
  filename?: string;
  mediaInfo?: MessageMediaInfo;
  spoiler?: boolean;
};

export interface EditRoomMessageInput {
  roomId: string;
  /** Timeline id of the `m.room.message` to replace (not an edit event id). */
  targetEventId: string;
  message: string;
  /** Explicit MXIDs for Matrix `m.mentions` when editing body/caption. */
  mentionUserIds?: string[];
  /**
   * When editing a media message: ordered slots to keep (first = root event).
   * New files are uploaded and appended after these (see `newAttachments`).
   */
  existingMediaSlots?: EditRoomMessageExistingSlot[];
  /** New files to append when editing a media message (uploaded after `existingMediaSlots`). */
  newAttachments?: SendAttachmentInput[];
  /** Aborts new attachment uploads before the replace event is sent. */
  signal?: AbortSignal;
}

export interface RedactRoomEventInput {
  roomId: string;
  eventId: string;
}
/**
 * Thrown when some attachment events were committed but a later send step failed.
 * Callers should restore only `attachments.slice(sentAttachmentCount)` and optionally caption text.
 */
export class SendMessagePartialFailureError extends Error {
  constructor(
    message: string,
    /** Number of `m.file` / `m.image` events successfully sent before the failure. */
    public readonly sentAttachmentCount: number,
    /** True when non-empty caption text should be restored (not yet committed). */
    public readonly restoreCaption: boolean,
  ) {
    super(message);
    this.name = 'SendMessagePartialFailureError';
  }
}

/** Thrown when `AbortSignal` aborts an in-flight `sendMessage` / media edit upload. */
export class SendMessageCancelledError extends Error {
  constructor() {
    super('Send cancelled');
    this.name = 'SendMessageCancelledError';
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new SendMessageCancelledError();
  }
}

/** Matrix `uploadContent` exceeded the configured timeout (see `MATRIX_UPLOAD_TIMEOUT_MS`). */
export class MatrixUploadTimeoutError extends Error {
  constructor(message = 'Matrix media upload timed out') {
    super(message);
    this.name = 'MatrixUploadTimeoutError';
  }
}

/** Default max wait for `client.uploadContent` per attachment (ms). */
export const MATRIX_UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Gap between sequential `uploadContent` calls when sending multiple attachments.
 * Parallel uploads hit homeserver rate limits (429); spacing keeps one in-flight upload.
 */
const MATRIX_UPLOAD_STAGGER_MS = 400;

const MATRIX_UPLOAD_RATE_LIMIT_MAX_ATTEMPTS = 4;
/** Gap between paginated `scrollback` calls to avoid homeserver 429 bursts. */
const MATRIX_SCROLLBACK_STAGGER_MS = 350;
const MATRIX_SCROLLBACK_RATE_LIMIT_MAX_ATTEMPTS = 4;
const MATRIX_GROUP_CALL_EVENT_TYPE = 'org.matrix.msc3401.call';
const MATRIX_GROUP_CALL_MEMBER_EVENT_TYPE = 'org.matrix.msc3401.call.member';
const MATRIX_LEGACY_CALL_MEMBER_EVENT_TYPE = 'm.call.member';

function myRoomPowerLevel(
  client: MatrixSdk.MatrixClient,
  roomId: string,
  powerLevels: {
    users?: Record<string, number>;
    users_default?: number;
  },
): number {
  const userId = client.getUserId();
  if (!userId) return powerLevels.users_default ?? 0;
  const fromEvent = powerLevels.users?.[userId];
  if (typeof fromEvent === 'number') return fromEvent;
  const fromRoom = client.getRoom(roomId)?.getMember(userId)?.powerLevel;
  return typeof fromRoom === 'number'
    ? fromRoom
    : powerLevels.users_default ?? 0;
}

async function ensureRoomCallPowerLevels(
  client: MatrixSdk.MatrixClient,
  roomId: string,
): Promise<void> {
  try {
    const current =
      (client
        .getRoom(roomId)
        ?.currentState.getStateEvents(MatrixSdk.EventType.RoomPowerLevels, '')
        ?.getContent() as
        | {
            events?: Record<string, number>;
            state_default?: number;
            users?: Record<string, number>;
            users_default?: number;
          }
        | undefined) ??
      ((await client.getStateEvent(
        roomId,
        MatrixSdk.EventType.RoomPowerLevels,
        '',
      )) as {
        events?: Record<string, number>;
        state_default?: number;
        users?: Record<string, number>;
        users_default?: number;
      });
    const myLevel = myRoomPowerLevel(client, roomId, current);
    const requiredToEditPowerLevels =
      current.events?.[MatrixSdk.EventType.RoomPowerLevels] ??
      current.state_default ??
      50;
    if (myLevel < requiredToEditPowerLevels) {
      return;
    }
    const events = { ...(current.events ?? {}) };
    if (
      events[MATRIX_GROUP_CALL_EVENT_TYPE] === 0 &&
      events[MATRIX_GROUP_CALL_MEMBER_EVENT_TYPE] === 0 &&
      events[MATRIX_LEGACY_CALL_MEMBER_EVENT_TYPE] === 0
    ) {
      return;
    }
    await client.sendStateEvent(
      roomId,
      MatrixSdk.EventType.RoomPowerLevels,
      {
        ...current,
        events: {
          ...events,
          [MATRIX_GROUP_CALL_EVENT_TYPE]: 0,
          [MATRIX_GROUP_CALL_MEMBER_EVENT_TYPE]: 0,
          [MATRIX_LEGACY_CALL_MEMBER_EVENT_TYPE]: 0,
        },
      },
      '',
    );
  } catch (error) {
    const e = error as
      | {
          errcode?: string;
          name?: string;
          message?: string;
          data?: { errcode?: string };
          httpStatus?: number;
        }
      | undefined;
    const isPermissionDenied =
      e?.errcode === 'M_FORBIDDEN' ||
      e?.data?.errcode === 'M_FORBIDDEN' ||
      e?.httpStatus === 403 ||
      e?.name === 'ForbiddenError';
    if (isPermissionDenied) {
      console.warn(
        'Cannot ensure Matrix call power levels due to permissions:',
        error,
      );
      return;
    }
    console.warn('Cannot ensure Matrix call power levels:', error);
    throw error;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getEventIdFromSendResponse(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const eventId = (response as { event_id?: unknown }).event_id;
  return typeof eventId === 'string' && eventId.trim() ? eventId : undefined;
}

function isMatrixUnknownTokenError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    errcode?: string;
    httpStatus?: number;
    message?: string;
    data?: { errcode?: string; soft_logout?: boolean };
  };
  if (
    e.errcode === 'M_UNKNOWN_TOKEN' ||
    e.data?.errcode === 'M_UNKNOWN_TOKEN'
  ) {
    return true;
  }
  if (e.httpStatus === 401 && e.data?.soft_logout === true) return true;
  const msg = `${e.message ?? ''}`.toLowerCase();
  return msg.includes('unknown token') || msg.includes('m_unknown_token');
}

function matrixRateLimitBackoffMs(
  err: unknown,
  zeroBasedAttempt: number,
): number {
  const e = err as { data?: { retry_after_ms?: number } };
  const ra = e.data?.retry_after_ms;
  if (typeof ra === 'number' && Number.isFinite(ra) && ra > 0) {
    return Math.min(Math.max(Math.ceil(ra), 500), 45_000);
  }
  return Math.min(1500 * 2 ** zeroBasedAttempt, 30_000);
}

/** Matrix room message with optional Hypha spoiler + multi-attach bundle extension. */
type HyphaMediaEventContent = RoomMessageEventContent & {
  [HYPHA_SPOILER_FIELD]?: boolean;
  [HYPHA_MEDIA_BUNDLE_FIELD]?: HyphaMediaBundleItemWire[];
  /** Caption with markup on the same event as media (not in Matrix's narrow image/file union). */
  format?: typeof MATRIX_CUSTOM_HTML_FORMAT;
  formatted_body?: string;
};

function loadAudioDurationMs(file: File): Promise<number | undefined> {
  if (
    !file.type.startsWith('audio/') &&
    !/\.(ogg|opus|mp3|m4a|wav)$/i.test(file.name)
  ) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement('audio');
    const done = (ms?: number) => {
      URL.revokeObjectURL(url);
      el.src = '';
      resolve(ms);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d > 0) {
        done(Math.round(d * 1000));
      } else {
        done(undefined);
      }
    };
    el.onerror = () => done(undefined);
    el.src = url;
  });
}

function loadImageDimensions(
  file: File,
): Promise<{ w: number; h: number } | undefined> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new globalThis.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    img.src = url;
  });
}

async function prepareUploadedAttachmentMediaPayload(
  client: MatrixSdk.MatrixClient,
  att: SendAttachmentInput,
): Promise<HyphaMediaEventContent> {
  const abortController = new AbortController();
  const timeoutMs = MATRIX_UPLOAD_TIMEOUT_MS;
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);
  let upload: { content_uri: string };
  try {
    upload = await client.uploadContent(att.file, {
      name: att.file.name,
      type: att.file.type || undefined,
      abortController,
    });
  } catch (e) {
    if (abortController.signal.aborted) {
      throw new MatrixUploadTimeoutError(
        `Matrix media upload timed out after ${timeoutMs}ms`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  const mxc = upload.content_uri;
  const msgtype =
    att.kind === 'image'
      ? MatrixSdk.MsgType.Image
      : att.kind === 'audio'
      ? MatrixSdk.MsgType.Audio
      : MatrixSdk.MsgType.File;
  let info: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
    duration?: number;
  } = {
    mimetype: att.file.type || undefined,
    size: att.file.size,
  };
  if (msgtype === MatrixSdk.MsgType.Image) {
    const dims = await loadImageDimensions(att.file);
    if (dims) {
      info = { ...info, w: dims.w, h: dims.h };
    }
  } else if (msgtype === MatrixSdk.MsgType.Audio) {
    const dur = await loadAudioDurationMs(att.file);
    if (dur != null) {
      info = { ...info, duration: dur };
    }
  }

  const caption = att.file.name;
  const base: HyphaMediaEventContent = {
    msgtype,
    body: caption,
    filename: att.file.name,
    url: mxc,
    info,
  } as HyphaMediaEventContent;
  if (att.spoiler) {
    base[HYPHA_SPOILER_FIELD] = true;
  }
  return base;
}

export interface ToggleReactionInput {
  roomId: string;
  targetEventId: string;
  key: string;
}

export type MatrixEventListener = (
  event: MatrixSdk.MatrixEvent,
) => Promise<void>;
export type RoomMessageListener = (message: Message) => Promise<void>;
export type RoomMessagePinnedListener = (pinned: string[]) => Promise<void>;

interface RoomMessageListenerRecord {
  roomId: string;
  listener: MatrixEventListener;
}

export interface ChatMember {
  userId: string;
  presence: boolean;
}

interface MatrixContextType {
  client: MatrixSdk.MatrixClient | null;
  isMatrixAvailable: boolean;
  isAuthenticated: boolean;
  createRoom: (title: string) => Promise<{ roomId: string }>;
  sendMessage: (params: SendMessageInput) => Promise<SendMessageResult>;
  editRoomMessage: (params: EditRoomMessageInput) => Promise<void>;
  redactRoomEvent: (params: RedactRoomEventInput) => Promise<void>;
  toggleReaction: (params: ToggleReactionInput) => Promise<void>;
  getRoomMessages: (roomId: string) => Message[] | null;
  loadRoomHistory: (
    roomId: string,
    options?: { pageSize?: number; maxBatches?: number; force?: boolean },
  ) => Promise<void>;
  getPinnedMessageIds: (roomId: string) => string[];
  togglePinnedMessage: (roomId: string, messageId: string) => Promise<void>;
  getRoomMembers: (roomId: string) => Promise<ChatMember[]>;
  /** Resolves aliases; returns canonical room id once the room is visible to `client.getRoom`. */
  joinRoom: (roomIdOrAlias: string) => Promise<string>;
  registerRoomListener: (
    roomId: string,
    messageListener: RoomMessageListener,
    pinnedListener: RoomMessagePinnedListener,
  ) => void;
  unregisterRoomListener: (roomId: string) => void;
  registeredRoomListeners: RoomMessageListenerRecord[];
  /**
   * Advance the user's read receipt + fully-read marker to `eventId` (Matrix
   * “mark as read” for Human Chat).
   */
  markRoomRead: (roomId: string, eventId: string) => Promise<void>;
  /** Force refresh Matrix auth/session after UNKNOWN_TOKEN or soft logout. */
  refreshSession: () => Promise<boolean>;
}

const MatrixContext = React.createContext<MatrixContextType | null>(null);

interface MatrixProviderProps {
  children: React.ReactNode;
}

export const MatrixProvider: React.FC<MatrixProviderProps> = ({ children }) => {
  const { user } = useAuthentication();
  const [client, setClient] = React.useState<MatrixSdk.MatrixClient | null>(
    null,
  );
  const [isMatrixAvailable, setIsMatrixAvailable] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [activeMatrixUserId, setActiveMatrixUserId] = React.useState<
    string | null
  >(null);
  const clientRef = React.useRef<MatrixSdk.MatrixClient | null>(null);
  const sessionRecoveryPromiseRef = React.useRef<Promise<boolean> | null>(null);
  const registeredRoomListenersRef = React.useRef<RoomMessageListenerRecord[]>(
    [],
  );
  const roomHistoryLoadRef = React.useRef<Map<string, Promise<void>>>(
    new Map(),
  );
  const roomHistoryLoadedRef = React.useRef<Set<string>>(new Set());
  const [registeredRoomListeners, setRegisteredRoomListeners] = React.useState<
    RoomMessageListenerRecord[]
  >([]);
  const {
    matrixToken,
    isLoading: isMatrixTokenLoading,
    error: matrixTokenError,
    refreshMatrixToken,
  } = useMatrixToken();

  const initializeMatrixClient = React.useCallback(
    async (matrixToken: MatrixTokenData) => {
      if (!matrixToken) {
        return;
      }
      try {
        const { accessToken, userId, homeserverUrl, deviceId } = matrixToken;
        // Voice and video (group calls): keep VoIP enabled; TURN/ICE for WebRTC. See
        // docs/requirements/voice-video-call-implementation-spec.md §2.1
        const matrixClient = MatrixSdk.createClient({
          baseUrl: homeserverUrl,
          accessToken,
          userId,
          deviceId,
          /** Default matrix-js-sdk log level is extremely chatty in the browser. */
          logger: createHyphaMatrixClientLogger(),
          disableVoip: false,
          /** matrix-js-sdk v40 Rust crypto path cannot send encrypted group-call to-device VoIP events. */
          useE2eForGroupCall: false,
          useLivekitForGroupCalls: false,
          forceTURN: matrixWebRtcForceTurnFromEnv(),
          fallbackICEServerAllowed: matrixWebRtcFallbackIceAllowedFromEnv(),
          iceCandidatePoolSize: matrixWebRtcIceCandidatePoolSizeFromEnv(),
        });

        await matrixClient.startClient();

        await matrixClient.setPresence({ presence: 'online' });

        clientRef.current = matrixClient;
        setClient(matrixClient);
        setActiveMatrixUserId(userId);
        setIsMatrixAvailable(matrixClient !== null);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to initialize Matrix client:', error);
        clientRef.current = null;
        setClient(null);
      }
    },
    [],
  );

  const recoverMatrixSession = React.useCallback(async (): Promise<boolean> => {
    if (sessionRecoveryPromiseRef.current) {
      return sessionRecoveryPromiseRef.current;
    }
    const recovery = (async () => {
      try {
        const refreshed = await refreshMatrixToken();
        const freshToken =
          refreshed &&
          typeof refreshed === 'object' &&
          'accessToken' in refreshed
            ? (refreshed as MatrixTokenData)
            : null;
        if (!freshToken) {
          return false;
        }
        const existingClient = clientRef.current;
        if (existingClient) {
          try {
            existingClient.stopClient();
          } catch {
            // ignore stop errors during auth recovery
          }
        }
        clientRef.current = null;
        setClient(null);
        setIsAuthenticated(false);
        setIsMatrixAvailable(false);
        setActiveMatrixUserId(null);
        await initializeMatrixClient(freshToken);
        return true;
      } catch (error) {
        console.error(
          '[MatrixProvider] Failed to recover Matrix session:',
          error,
        );
        return false;
      } finally {
        sessionRecoveryPromiseRef.current = null;
      }
    })();
    sessionRecoveryPromiseRef.current = recovery;
    return recovery;
  }, [initializeMatrixClient, refreshMatrixToken]);

  React.useEffect(() => {
    if (!client) {
      return;
    }
    if (matrixToken && activeMatrixUserId === matrixToken.userId) {
      return;
    }

    client.stopClient();
    registeredRoomListenersRef.current = [];
    setRegisteredRoomListeners([]);
    setClient(null);
    setActiveMatrixUserId(null);
    setIsAuthenticated(false);
    setIsMatrixAvailable(false);
  }, [activeMatrixUserId, client, matrixToken]);

  React.useEffect(() => {
    clientRef.current = client;
  }, [client]);

  React.useEffect(() => {
    if (client) {
      //NOTE: already initialized
      return;
    }
    if (isMatrixTokenLoading) {
      return;
    }
    if (matrixTokenError) {
      console.warn('Cannot initialize client due error:', matrixTokenError);
      return;
    }
    if (!matrixToken) {
      return;
    }
    initializeMatrixClient(matrixToken);
  }, [
    matrixToken,
    isMatrixTokenLoading,
    matrixTokenError,
    initializeMatrixClient,
  ]);

  React.useEffect(() => {
    if (!client) return;
    const matrixClientWithSessionEvent = client as MatrixSdk.MatrixClient & {
      on: (
        event: 'Session.logged_out',
        listener: (event: unknown) => void,
      ) => void;
      removeListener: (
        event: 'Session.logged_out',
        listener: (event: unknown) => void,
      ) => void;
    };
    const handleSessionLoggedOut = (event: unknown) => {
      if (!isMatrixUnknownTokenError(event)) return;
      void recoverMatrixSession();
    };
    const handleSyncState = (
      state: unknown,
      _prevState: unknown,
      data?: { error?: unknown },
    ) => {
      if (state !== 'ERROR') return;
      if (!isMatrixUnknownTokenError(data?.error)) return;
      void recoverMatrixSession();
    };
    matrixClientWithSessionEvent.on(
      'Session.logged_out',
      handleSessionLoggedOut,
    );
    client.on(MatrixSdk.ClientEvent.Sync, handleSyncState);
    return () => {
      matrixClientWithSessionEvent.removeListener(
        'Session.logged_out',
        handleSessionLoggedOut,
      );
      client.removeListener(MatrixSdk.ClientEvent.Sync, handleSyncState);
    };
  }, [client, recoverMatrixSession]);

  React.useEffect(() => {
    return () => {
      if (client) {
        const matrixClient = client as MatrixSdk.MatrixClient;
        matrixClient.setPresence({ presence: 'offline' });
        matrixClient.stopClient();
        clientRef.current = null;
        setClient(null);
      }
    };
  }, [client]);

  const createRoom = React.useCallback(
    async (title: string) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      const { room_id: roomId } = await client.createRoom({
        preset: RoomPreset.PublicChat,
        name: title,
        topic: title,
      });
      await ensureRoomCallPowerLevels(client, roomId);
      return { roomId };
    },
    [client],
  );

  const toggleReaction = React.useCallback(
    async ({ roomId, targetEventId, key }: ToggleReactionInput) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      if (!isValidReactionKey(key)) {
        throw new Error('Invalid reaction key');
      }
      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      const uid = client.getUserId();
      const rel = room.relations.getChildEventsForEvent(
        targetEventId,
        MatrixSdk.RelationType.Annotation,
        MatrixSdk.EventType.Reaction,
      );
      const ownReactionEventIds = new Set<string>();
      if (rel && uid) {
        const byKey = rel.getSortedAnnotationsByKey();
        if (byKey) {
          for (const [k, eventSet] of byKey) {
            if (k !== key) continue;
            for (const ev of eventSet) {
              if (ev.isRedacted()) continue;
              if (ev.getSender() === uid) {
                const id = ev.getId();
                if (id) ownReactionEventIds.add(id);
              }
            }
          }
        }
      }

      if (ownReactionEventIds.size > 0) {
        await Promise.all(
          [...ownReactionEventIds].map((reactionEventId) =>
            client.redactEvent(roomId, reactionEventId),
          ),
        );
        return;
      }

      await client.sendEvent(roomId, MatrixSdk.EventType.Reaction, {
        'm.relates_to': {
          event_id: targetEventId,
          key,
          rel_type: MatrixSdk.RelationType.Annotation,
        },
      });
    },
    [client],
  );

  const sendMessage = React.useCallback(
    async ({
      roomId,
      message,
      mentionUserIds,
      replyToEventId,
      attachments,
      onUploadProgress,
      signal,
    }: SendMessageInput): Promise<SendMessageResult> => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      if (!roomId?.trim()) {
        return {};
      }

      const trimmed = message.trim();
      const list = attachments?.length ? attachments : [];
      const hasAttachments = list.length > 0;
      if (!trimmed && !hasAttachments) {
        return {};
      }

      const mentionIds = resolveMentionUserIdsForSend(trimmed, mentionUserIds);

      throwIfAborted(signal);

      let replyContext:
        | {
            resolvedTargetId: string;
            sender: string;
            targetBody: string;
          }
        | undefined;

      if (replyToEventId?.trim()) {
        throwIfAborted(signal);
        const resolved = await resolveReplyTargetForSend(
          client,
          roomId,
          replyToEventId,
        );
        replyContext = {
          resolvedTargetId: resolved.eventId,
          sender: resolved.sender,
          targetBody: resolved.body,
        };
      }

      if (hasAttachments) {
        const mediaPayloads: HyphaMediaEventContent[] = [];
        for (let i = 0; i < list.length; i++) {
          throwIfAborted(signal);
          if (i > 0) {
            await delay(MATRIX_UPLOAD_STAGGER_MS);
          }
          const att = list[i]!;
          let attempt = 0;
          while (true) {
            try {
              mediaPayloads.push(
                await prepareUploadedAttachmentMediaPayload(client, att),
              );
              onUploadProgress?.({
                completed: mediaPayloads.length,
                total: list.length,
              });
              break;
            } catch (e) {
              if (
                !isMatrixRateLimitedError(e) ||
                attempt >= MATRIX_UPLOAD_RATE_LIMIT_MAX_ATTEMPTS - 1
              ) {
                throw e;
              }
              await delay(matrixRateLimitBackoffMs(e, attempt));
              attempt += 1;
            }
          }
        }

        throwIfAborted(signal);

        if (trimmed) {
          const first = mediaPayloads[0]!;
          if (replyContext) {
            const rich = buildRichReplyMatrixContent(
              replyContext.sender,
              replyContext.targetBody,
              trimmed,
            );
            mediaPayloads[0] = mergeMatrixMentionsIntoContent(
              {
                ...first,
                body: rich.body,
                format: MATRIX_CUSTOM_HTML_FORMAT,
                formatted_body: rich.formatted_body,
              },
              mentionIds,
            ) as HyphaMediaEventContent;
          } else {
            const textExtras =
              matrixTextEventContentWithOptionalFormatting(trimmed);
            mediaPayloads[0] = mergeMatrixMentionsIntoContent(
              {
                ...first,
                ...textExtras,
                body: trimmed,
              },
              mentionIds,
            ) as HyphaMediaEventContent;
          }
        }

        let sentMediaCount = 0;
        try {
          if (mediaPayloads.length === 1) {
            const base = mediaPayloads[0]!;
            const eventContent = replyContext
              ? {
                  ...base,
                  'm.relates_to': {
                    'm.in_reply_to': {
                      event_id: replyContext.resolvedTargetId,
                    },
                  },
                }
              : base;
            throwIfAborted(signal);
            const sendResult = await client.sendEvent(
              roomId,
              EventType.RoomMessage,
              mergeMatrixMentionsIntoContent(
                eventContent,
                mentionIds,
              ) as RoomMessageEventContent,
            );
            sentMediaCount = 1;
            return { eventId: getEventIdFromSendResponse(sendResult) };
          } else if (mediaPayloads.length > 1) {
            const [first, ...rest] = mediaPayloads;
            const bundleItems: HyphaMediaBundleItemWire[] = rest.map((item) => {
              const spoiler = item[HYPHA_SPOILER_FIELD] === true;
              const c = item as HyphaMediaBundleItemWire;
              const { msgtype, body, filename, url, info } = c;
              return {
                msgtype,
                body,
                filename,
                url,
                info,
                ...(spoiler ? { [HYPHA_SPOILER_FIELD]: true } : {}),
              };
            });
            const combined: HyphaMediaEventContent = {
              ...first!,
              [HYPHA_MEDIA_BUNDLE_FIELD]: bundleItems,
            };
            const eventContent = replyContext
              ? {
                  ...combined,
                  'm.relates_to': {
                    'm.in_reply_to': {
                      event_id: replyContext.resolvedTargetId,
                    },
                  },
                }
              : combined;
            throwIfAborted(signal);
            const sendResult = await client.sendEvent(
              roomId,
              EventType.RoomMessage,
              mergeMatrixMentionsIntoContent(
                eventContent,
                mentionIds,
              ) as RoomMessageEventContent,
            );
            sentMediaCount = list.length;
            return { eventId: getEventIdFromSendResponse(sendResult) };
          }
        } catch (mediaErr) {
          throw new SendMessagePartialFailureError(
            mediaErr instanceof Error
              ? mediaErr.message
              : 'Failed to send attachment',
            sentMediaCount,
            true,
          );
        }
        return {};
      }

      if (!trimmed) {
        return {};
      }

      throwIfAborted(signal);

      try {
        if (replyContext && !hasAttachments) {
          const payload = buildRichReplyMatrixContent(
            replyContext.sender,
            replyContext.targetBody,
            message,
          );
          throwIfAborted(signal);
          const sendResult = await client.sendEvent(
            roomId,
            EventType.RoomMessage,
            mergeMatrixMentionsIntoContent(
              {
                msgtype: MsgType.Text,
                ...payload,
                'm.relates_to': {
                  'm.in_reply_to': {
                    event_id: replyContext.resolvedTargetId,
                  },
                },
              } as RoomMessageEventContent,
              mentionIds,
            ),
          );
          return { eventId: getEventIdFromSendResponse(sendResult) };
        }

        if (replyContext && hasAttachments) {
          const textPayload =
            matrixTextEventContentWithOptionalFormatting(message);
          throwIfAborted(signal);
          const sendResult = await client.sendEvent(
            roomId,
            EventType.RoomMessage,
            mergeMatrixMentionsIntoContent(
              {
                msgtype: MsgType.Text,
                ...textPayload,
                'm.relates_to': {
                  'm.in_reply_to': {
                    event_id: replyContext.resolvedTargetId,
                  },
                },
              } as RoomMessageEventContent,
              mentionIds,
            ),
          );
          return { eventId: getEventIdFromSendResponse(sendResult) };
        }

        const textPayload =
          matrixTextEventContentWithOptionalFormatting(message);
        throwIfAborted(signal);
        const sendResult = await client.sendEvent(
          roomId,
          EventType.RoomMessage,
          mergeMatrixMentionsIntoContent(
            {
              msgtype: MsgType.Text,
              ...textPayload,
            } as RoomMessageEventContent,
            mentionIds,
          ),
        );
        return { eventId: getEventIdFromSendResponse(sendResult) };
      } catch (textErr) {
        throw new SendMessagePartialFailureError(
          textErr instanceof Error
            ? textErr.message
            : 'Failed to send message text',
          list.length,
          true,
        );
      }
    },
    [client],
  );

  const editRoomMessage = React.useCallback(
    async ({
      roomId,
      targetEventId,
      message,
      mentionUserIds,
      existingMediaSlots,
      newAttachments,
      signal,
    }: EditRoomMessageInput) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      const trimmed = message.trim();
      const mentionIds = resolveMentionUserIdsForSend(trimmed, mentionUserIds);
      const newList = newAttachments?.length ? newAttachments : [];
      if (!trimmed && newList.length === 0 && !existingMediaSlots?.length) {
        return;
      }
      if (!roomId?.trim() || !targetEventId?.trim()) {
        return;
      }

      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const targetEv =
        room.findEventById(targetEventId) ??
        (typeof room.getPendingEvent === 'function'
          ? room.getPendingEvent(targetEventId)
          : null);

      if (!targetEv) {
        throw new Error('Message to edit not found');
      }
      await awaitNonProvisionalMatrixEventId(targetEv);
      const resolvedTargetId = targetEv.getId();
      if (!resolvedTargetId?.trim()) {
        throw new Error('Message to edit not found');
      }
      if (targetEv.getType() !== EventType.RoomMessage) {
        throw new Error('Only chat messages can be edited');
      }
      if (targetEv.isRedacted()) {
        throw new Error('Cannot edit a redacted message');
      }
      const sender = targetEv.getSender();
      const uid = client.getUserId();
      if (!sender || !uid || sender !== uid) {
        throw new Error('Cannot edit events you do not own');
      }

      const originalContent = targetEv.getContent() as {
        msgtype?: string;
        body?: string;
        url?: string;
        filename?: string;
        info?: Record<string, unknown>;
        [key: string]: unknown;
      };
      const origMsgtype = originalContent.msgtype;

      const replyToId = targetEv.getWireContent()?.['m.relates_to']?.[
        'm.in_reply_to'
      ]?.event_id as string | undefined;

      const isMediaEdit =
        Array.isArray(existingMediaSlots) &&
        existingMediaSlots.length > 0 &&
        (origMsgtype === MsgType.File ||
          origMsgtype === MsgType.Image ||
          origMsgtype === MsgType.Audio);

      if (isMediaEdit) {
        const slots = existingMediaSlots!;
        const slotToPayload = (
          slot: EditRoomMessageExistingSlot,
        ): HyphaMediaEventContent => {
          const base: HyphaMediaEventContent = {
            msgtype: slot.msgtype,
            body: slot.filename ?? 'attachment',
            filename: slot.filename,
            url: slot.mxcUrl,
            info: slot.mediaInfo,
          } as HyphaMediaEventContent;
          if (slot.spoiler) {
            base[HYPHA_SPOILER_FIELD] = true;
          }
          return base;
        };

        const rootFromSlot = slotToPayload(slots[0]!);
        const restSlots = slots.slice(1).map(slotToPayload);
        const uploaded: HyphaMediaEventContent[] = [];
        for (let i = 0; i < newList.length; i++) {
          throwIfAborted(signal);
          if (i > 0) {
            await delay(MATRIX_UPLOAD_STAGGER_MS);
          }
          let attempt = 0;
          while (true) {
            try {
              uploaded.push(
                await prepareUploadedAttachmentMediaPayload(
                  client,
                  newList[i]!,
                ),
              );
              break;
            } catch (e) {
              if (
                !isMatrixRateLimitedError(e) ||
                attempt >= MATRIX_UPLOAD_RATE_LIMIT_MAX_ATTEMPTS - 1
              ) {
                throw e;
              }
              await delay(matrixRateLimitBackoffMs(e, attempt));
              attempt += 1;
            }
          }
        }

        const allAfterRoot = [...restSlots, ...uploaded];
        let combined: HyphaMediaEventContent;
        if (allAfterRoot.length === 0) {
          combined = { ...rootFromSlot };
        } else {
          const bundleItems: HyphaMediaBundleItemWire[] = allAfterRoot.map(
            (item) => {
              const spoiler = item[HYPHA_SPOILER_FIELD] === true;
              const c = item as HyphaMediaBundleItemWire;
              const { msgtype, body, filename, url, info } = c;
              return {
                msgtype,
                body,
                filename,
                url,
                info,
                ...(spoiler ? { [HYPHA_SPOILER_FIELD]: true } : {}),
              };
            },
          );
          combined = {
            ...rootFromSlot,
            [HYPHA_MEDIA_BUNDLE_FIELD]: bundleItems,
          };
        }

        const filenameFallback =
          slots[0]?.filename?.trim() ||
          String(rootFromSlot.body ?? 'attachment');
        throwIfAborted(signal);
        combined = await applyMediaEditCaptionAndReply(
          combined,
          trimmed,
          replyToId,
          (id) => resolveReplyTargetForSend(client, roomId, id),
          filenameFallback,
          mentionUserIds,
        );

        const newBody =
          'body' in combined ? String(combined.body) : trimmed || 'attachment';
        const fallbackBody = `* ${newBody}`;

        throwIfAborted(signal);

        await client.sendEvent(roomId, EventType.RoomMessage, {
          ...combined,
          body: fallbackBody,
          'm.new_content': combined,
          'm.relates_to': {
            rel_type: MatrixSdk.RelationType.Replace,
            event_id: resolvedTargetId,
          },
        } as RoomMessageEventContent);
        return;
      }

      if (origMsgtype !== MsgType.Text) {
        throw new Error('Only text messages can be edited in this client');
      }
      if (!trimmed) {
        return;
      }

      let newContentPayload: RoomMessageEventContent;

      if (replyToId?.trim()) {
        const {
          eventId: resolvedReplyTargetId,
          sender: replyTargetSender,
          body: targetBody,
        } = await resolveReplyTargetForSend(client, roomId, replyToId);
        const rich = buildRichReplyMatrixContent(
          replyTargetSender,
          targetBody,
          message,
        );
        newContentPayload = mergeMatrixMentionsIntoContent(
          {
            msgtype: MsgType.Text,
            ...rich,
            'm.relates_to': {
              'm.in_reply_to': {
                event_id: resolvedReplyTargetId,
              },
            },
          } as RoomMessageEventContent,
          mentionIds,
        );
      } else {
        newContentPayload = mergeMatrixMentionsIntoContent(
          {
            msgtype: MsgType.Text,
            ...matrixTextEventContentWithOptionalFormatting(message),
          } as RoomMessageEventContent,
          mentionIds,
        );
      }

      const newBody =
        'body' in newContentPayload ? newContentPayload.body : message;
      const fallbackBody = `* ${newBody}`;

      await client.sendEvent(roomId, EventType.RoomMessage, {
        ...newContentPayload,
        body: fallbackBody,
        'm.new_content': newContentPayload,
        'm.relates_to': {
          rel_type: MatrixSdk.RelationType.Replace,
          event_id: resolvedTargetId,
        },
      } as RoomMessageEventContent);
    },
    [client],
  );

  const redactRoomEvent = React.useCallback(
    async ({ roomId, eventId }: RedactRoomEventInput) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      if (!roomId?.trim() || !eventId?.trim()) {
        return;
      }
      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      const ev =
        room.findEventById(eventId) ??
        (typeof room.getPendingEvent === 'function'
          ? room.getPendingEvent(eventId)
          : null);
      if (!ev) {
        throw new Error('Message not found');
      }
      const uid = client.getUserId();
      const sender = ev.getSender();
      if (!uid || !sender || sender !== uid) {
        throw new Error('Cannot redact events you do not own');
      }
      await client.redactEvent(roomId, eventId);
    },
    [client],
  );
  const getPinnedMessageIds = React.useCallback(
    (roomId: string): string[] => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const state = room
        .getLiveTimeline()
        .getState(MatrixSdk.EventTimeline.FORWARDS);

      if (!state) {
        return [];
      }

      const pinnedEvent = state.getStateEvents(EventType.RoomPinnedEvents, '');
      return pinnedEvent?.getContent()?.pinned ?? [];
    },
    [client],
  );

  const getRoomMessages = React.useCallback(
    (roomId: string): Message[] | null => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const pinned = getPinnedMessageIds(roomId);
      const uid = client.getUserId();
      const messages = room
        ? room
            .getLiveTimeline()
            .getEvents()
            .filter((event) => event.getType() === EventType.RoomMessage)
            .filter((event) => !isCallCaptureNoticeEvent(event))
            .filter((event) => !isScreenshareTakeoverEvent(event))
            .filter((event) => !isRedactedRoomMessageEvent(event))
            .filter((event) => event.getId() && event.getSender())
            .filter((event) => getMessageReplaceTargetEventId(event) == null)
            .map((event) => {
              const base = messageFromRoomMessageEvent(
                client,
                roomId,
                event,
                pinned.includes(event.getId()!),
              );
              return attachReactionsToMessage(room, base, uid);
            })
        : null;
      return messages;
    },
    [client, getPinnedMessageIds],
  );

  const loadRoomHistory = React.useCallback(
    async (
      roomId: string,
      options?: { pageSize?: number; maxBatches?: number; force?: boolean },
    ): Promise<void> => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      if (!options?.force && roomHistoryLoadedRef.current.has(roomId)) {
        return;
      }

      const existingLoad = roomHistoryLoadRef.current.get(roomId);
      if (existingLoad) {
        await existingLoad;
        return;
      }

      const pageSize = Math.max(10, options?.pageSize ?? 50);
      const maxBatches = Math.max(1, options?.maxBatches ?? 10);
      const loadPromise = (async () => {
        for (let i = 0; i < maxBatches; i++) {
          if (i > 0) {
            await delay(MATRIX_SCROLLBACK_STAGGER_MS);
          }
          const beforeCount = room.getLiveTimeline().getEvents().length;
          let scrollbackSucceeded = false;
          for (
            let attempt = 0;
            attempt < MATRIX_SCROLLBACK_RATE_LIMIT_MAX_ATTEMPTS;
            attempt += 1
          ) {
            try {
              await client.scrollback(room, pageSize);
              scrollbackSucceeded = true;
              break;
            } catch (error) {
              if (isMatrixRateLimitedError(error)) {
                if (attempt >= MATRIX_SCROLLBACK_RATE_LIMIT_MAX_ATTEMPTS - 1) {
                  console.warn(
                    '[MatrixProvider] Paused room history scrollback after rate limit (will retry later):',
                    error,
                  );
                  return;
                }
                await delay(matrixRateLimitBackoffMs(error, attempt));
                continue;
              }
              console.warn(
                '[MatrixProvider] Failed while loading room history:',
                error,
              );
              return;
            }
          }
          if (!scrollbackSucceeded) {
            return;
          }
          const afterCount = room.getLiveTimeline().getEvents().length;
          if (afterCount <= beforeCount) {
            break;
          }
        }
        roomHistoryLoadedRef.current.add(roomId);
      })();

      roomHistoryLoadRef.current.set(roomId, loadPromise);
      try {
        await loadPromise;
      } finally {
        roomHistoryLoadRef.current.delete(roomId);
      }
    },
    [client],
  );

  const togglePinnedMessage = React.useCallback(
    async (roomId: string, messageId: string) => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      try {
        const pinnedInitial = getPinnedMessageIds(roomId);
        const pinned = pinnedInitial.includes(messageId)
          ? pinnedInitial.filter((pinnedId: string) => pinnedId !== messageId)
          : [...pinnedInitial, messageId];
        await client.sendStateEvent(roomId, EventType.RoomPinnedEvents, {
          pinned,
        });
      } catch (error) {
        console.error('Cannot update pinned message:', error);
      }
    },
    [client],
  );

  const getRoomMembers = React.useCallback(
    async (roomId: string): Promise<ChatMember[]> => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      const room = client.getRoom(roomId);
      const members = room ? room.getJoinedMembers() : null;
      const memberObjects =
        members?.map(async (member) => {
          try {
            const status = await client.getPresence(member.userId);
            /** `currently_active` is often unset; `presence: online` means the user is connected. */
            const online =
              status.presence === 'online' || Boolean(status.currently_active);
            return {
              userId: member.userId,
              presence: online,
            } as ChatMember;
          } catch {
            return {
              userId: member.userId,
              presence: false,
            } as ChatMember;
          }
        }) ?? null;
      return memberObjects ? await Promise.all(memberObjects) : [];
    },
    [client],
  );

  const joinRoom = React.useCallback(
    async (roomIdOrAlias: string): Promise<string> => {
      if (!client) {
        throw new Error('Client should be specified');
      }

      try {
        const joined = await client.joinRoom(roomIdOrAlias);
        const resolvedId = joined.roomId;
        await ensureRoomCallPowerLevels(client, resolvedId);
        // `joinRoom` resolves before the lazy room store always exposes `getRoom`
        // (race with sync / canonical id). Wait briefly for `getRoom` parity with listeners.
        for (let i = 0; i < 40; i++) {
          if (client.getRoom(resolvedId)) {
            return resolvedId;
          }
          await new Promise((r) => setTimeout(r, 50));
        }
        if (!client.getRoom(resolvedId)) {
          throw new Error('Room not available in Matrix client after join');
        }
        return resolvedId;
      } catch (error) {
        console.warn('Cannot join to room:', error);
        throw error;
      }
    },
    [client],
  );

  const unregisterRoomListener = React.useCallback(
    (roomId: string) => {
      if (!client) {
        console.warn('Matrix client is not initialized');
        return;
      }
      type Records = RoomMessageListenerRecord[];
      const { found, rest } = registeredRoomListenersRef.current.reduce(
        (acc, item) => {
          if (item.roomId === roomId) {
            acc.found.push(item);
          } else {
            acc.rest.push(item);
          }
          return acc;
        },
        { found: [] as Records, rest: [] as Records },
      );
      for (const item of found) {
        if (item) {
          client.removeListener(RoomEvent.Timeline, item.listener);
        }
      }
      registeredRoomListenersRef.current = rest;
      setRegisteredRoomListeners(rest);
    },
    [client],
  );

  const markRoomRead = React.useCallback(
    async (roomId: string, eventId: string) => {
      if (!client) {
        throw new Error('Client should be specified');
      }
      const room = client.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      await client.setRoomReadMarkersHttpRequest(roomId, eventId, eventId);
    },
    [client],
  );

  const registerRoomListener = React.useCallback(
    (
      roomId: string,
      messageListener: RoomMessageListener,
      messagePinnedListener: RoomMessagePinnedListener,
    ) => {
      if (!client) {
        console.warn('Matrix client is not initialized');
        return;
      }
      unregisterRoomListener(roomId);
      const eventListener: MatrixEventListener = async (
        event: MatrixSdk.MatrixEvent,
      ) => {
        if (event.getRoomId() !== roomId) {
          return;
        }
        const type = event.getType();
        /**
         * `RoomEvent.Timeline` fires for **every** persisted event in the room during
         * incremental sync (membership, typing, power levels, …). Human chat only cares
         * about a handful — skipping early avoids heavy `findEventById` / reaction work
         * per event and stops React from saturating on large backfills.
         */
        if (
          type !== MatrixSdk.EventType.RoomMessage &&
          type !== MatrixSdk.EventType.RoomPinnedEvents &&
          type !== MatrixSdk.EventType.Reaction &&
          type !== MatrixSdk.EventType.RoomRedaction
        ) {
          return;
        }
        const room = client.getRoom(roomId);

        if (type === EventType.RoomMessage) {
          if (isCallCaptureNoticeEvent(event)) {
            return;
          }
          if (isScreenshareTakeoverEvent(event)) {
            return;
          }
          if (isRedactedRoomMessageEvent(event)) {
            const id = event.getId();
            if (id) {
              await messageListener({
                id,
                sender: event.getSender() ?? '',
                content: '',
                timestamp: new Date(event.getTs()),
                redacted: true,
              });
            }
            return;
          }
          const replaceTargetId = getMessageReplaceTargetEventId(event);
          if (replaceTargetId && room) {
            const targetEv =
              room.findEventById(replaceTargetId) ??
              (typeof room.getPendingEvent === 'function'
                ? room.getPendingEvent(replaceTargetId)
                : null);
            if (!targetEv || targetEv.getType() !== EventType.RoomMessage) {
              return;
            }
            const pinnedIds = getPinnedMessageIds(roomId);
            const targetEventId = targetEv.getId();
            const targetSender = targetEv.getSender();
            if (!targetEventId || !targetSender) return;
            targetEv.makeReplaced(event);
            let message = messageFromRoomMessageEvent(
              client,
              roomId,
              targetEv,
              pinnedIds.includes(targetEventId),
            );
            message = attachReactionsToMessage(
              room,
              message,
              client.getUserId(),
            );
            await messageListener(message);
            return;
          }

          const eventId = event.getId();
          const sender = event.getSender();
          if (!eventId || !sender) return;
          const pinnedIds = room ? getPinnedMessageIds(roomId) : [];
          let message = messageFromRoomMessageEvent(
            client,
            roomId,
            event,
            pinnedIds.includes(eventId),
          );
          if (room) {
            message = attachReactionsToMessage(
              room,
              message,
              client.getUserId(),
            );
          }
          await messageListener(message);
        } else if (type === EventType.RoomPinnedEvents) {
          const pinned = event.getContent().pinned;
          await messagePinnedListener(pinned);
        } else if (type === EventType.Reaction) {
          const targetId = event.getWireContent()?.['m.relates_to']?.[
            'event_id'
          ] as string | undefined;
          if (!targetId || !room) return;
          const targetEv = room.findEventById(targetId);
          if (!targetEv || targetEv.getType() !== EventType.RoomMessage) {
            return;
          }
          const pinnedIds = getPinnedMessageIds(roomId);
          const eventId = targetEv.getId();
          const targetSender = targetEv.getSender();
          if (!eventId || !targetSender) return;
          let message = messageFromRoomMessageEvent(
            client,
            roomId,
            targetEv,
            pinnedIds.includes(eventId),
          );
          message = attachReactionsToMessage(room, message, client.getUserId());
          await messageListener(message);
        } else if (type === EventType.RoomRedaction) {
          const redacts =
            (event.getAssociatedId() as string | undefined) ??
            (event.getContent()?.redacts as string | undefined);
          if (!redacts || !room) return;
          const redacted = room.findEventById(redacts);
          if (!redacted) return;
          if (redacted.getType() === EventType.Reaction) {
            const targetId = redacted.getWireContent()?.['m.relates_to']?.[
              'event_id'
            ] as string | undefined;
            if (!targetId) return;
            const targetEv = room.findEventById(targetId);
            if (!targetEv || targetEv.getType() !== EventType.RoomMessage) {
              return;
            }
            const pinnedIds = getPinnedMessageIds(roomId);
            const tevId = targetEv.getId();
            const tevSender = targetEv.getSender();
            if (!tevId || !tevSender) return;
            let message = messageFromRoomMessageEvent(
              client,
              roomId,
              targetEv,
              pinnedIds.includes(tevId),
            );
            message = attachReactionsToMessage(
              room,
              message,
              client.getUserId(),
            );
            await messageListener(message);
          } else if (redacted.getType() === EventType.RoomMessage) {
            const replaceTargetId = getMessageReplaceTargetEventId(redacted);

            if (replaceTargetId) {
              const targetEv =
                room.findEventById(replaceTargetId) ??
                (typeof room.getPendingEvent === 'function'
                  ? room.getPendingEvent(replaceTargetId)
                  : null);
              if (!targetEv || targetEv.getType() !== EventType.RoomMessage) {
                return;
              }
              const pinnedIds = getPinnedMessageIds(roomId);
              const targetEventId = targetEv.getId();
              const targetSender = targetEv.getSender();
              if (!targetEventId || !targetSender) return;
              targetEv.makeReplaced(undefined);
              let message = messageFromRoomMessageEvent(
                client,
                roomId,
                targetEv,
                pinnedIds.includes(targetEventId),
              );
              message = attachReactionsToMessage(
                room,
                message,
                client.getUserId(),
              );
              await messageListener(message);
              return;
            }

            const pinnedIds = getPinnedMessageIds(roomId);
            const mid = redacted.getId();
            const ms = redacted.getSender();
            if (!mid || !ms) return;
            let message = messageFromRoomMessageEvent(
              client,
              roomId,
              redacted,
              pinnedIds.includes(mid),
            );
            message = attachReactionsToMessage(
              room,
              message,
              client.getUserId(),
            );
            await messageListener(message);
          }
        }
      };
      client.addListener(RoomEvent.Timeline, eventListener);
      const newRecord = { roomId, listener: eventListener };
      registeredRoomListenersRef.current = [
        ...registeredRoomListenersRef.current,
        newRecord,
      ];
      setRegisteredRoomListeners([...registeredRoomListenersRef.current]);
    },
    [client, unregisterRoomListener, getPinnedMessageIds],
  );

  const value: MatrixContextType = {
    client,
    isMatrixAvailable,
    isAuthenticated,
    createRoom,
    sendMessage,
    editRoomMessage,
    redactRoomEvent,
    toggleReaction,
    getRoomMessages,
    loadRoomHistory,
    getPinnedMessageIds,
    togglePinnedMessage,
    getRoomMembers,
    joinRoom,
    registerRoomListener,
    unregisterRoomListener,
    registeredRoomListeners,
    markRoomRead,
    refreshSession: recoverMatrixSession,
  };
  return (
    <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>
  );
};

const noopMatrixContext: MatrixContextType = {
  client: null,
  isMatrixAvailable: false,
  isAuthenticated: false,
  createRoom: async () => {
    throw new Error('Matrix unavailable');
  },
  sendMessage: async () => {
    throw new Error('Matrix unavailable');
  },
  editRoomMessage: async () => {
    throw new Error('Matrix unavailable');
  },
  redactRoomEvent: async () => {
    throw new Error('Matrix unavailable');
  },
  toggleReaction: async () => {
    throw new Error('Matrix unavailable');
  },
  getRoomMessages: () => null,
  loadRoomHistory: async () => {},
  joinRoom: async (): Promise<string> => {
    throw new Error('Matrix unavailable');
  },
  registerRoomListener: () => {},
  unregisterRoomListener: () => {},
  registeredRoomListeners: [],
  getPinnedMessageIds: () => [],
  togglePinnedMessage: async () => {},
  getRoomMembers: async () => [],
  markRoomRead: async () => {
    throw new Error('Matrix unavailable');
  },
  refreshSession: async () => false,
};

export const useMatrix = () => {
  const context = React.useContext(MatrixContext);
  if (!context) {
    return noopMatrixContext;
  }
  return context;
};

export const RoomEvent = MatrixSdk.RoomEvent;
export const EventType = MatrixSdk.EventType;
export const MsgType = MatrixSdk.MsgType;
export const RoomPreset = MatrixSdk.Preset;
