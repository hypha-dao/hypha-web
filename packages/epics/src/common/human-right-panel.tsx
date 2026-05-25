'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ClientEvent,
  RoomStateEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { Check, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  useSidebar,
  Button,
  Skeleton,
} from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  useMatrix,
  useCoherenceMutationsWeb2Rsc,
  useHookRegistry,
  useJwt,
  useMatrixUserIdsByPrivySubs,
  useMe,
  useSpaceBySlug,
  useSpaceMutationsWeb2Rsc,
  Message,
  firstLineForReplyPreview,
  stripMatrixReplyFallback,
  RoomEvent,
  EventType,
  MsgType,
  MatrixUploadTimeoutError,
  SendMessageCancelledError,
  SendMessagePartialFailureError,
  isMatrixRateLimitedError,
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  type MessageReaction,
  type Person,
} from '@hypha-platform/core/client';
import {
  isChatPanelAudioFile,
  isChatPanelVideoFile,
} from './human-chat-panel/chat-panel-media-types';
import { UseMembers } from '../spaces';
import {
  UserSpaceState,
  useUserSpaceState,
} from '../spaces/hooks/use-user-space-state';
import { useSpaceDiscoverability } from '../spaces/hooks/use-space-discoverability';
import { checkAccess } from '../spaces/utils/transparency-access';
import { SpaceAccessDenied } from '../spaces/components/space-access-denied';

import {
  HumanChatPanelHeader,
  HumanChatPanelMessages,
  HumanChatPanelChatBar,
  HumanChatPanelTabs,
  HumanChatPanelMembers,
  HumanChatPanelMentionBell,
  HumanChatPanelMentionTab,
  HumanChatPanelCallToolbar,
  HumanChatPanelCallBanner,
  HumanChatPanelScreenshareTakeoverDialog,
  HumanChatPanelCallJoinStrip,
  HumanChatPanelCallStage,
  type ChatDraftAttachment,
  type ChatMentionCandidate,
  type ChatPanelAttachmentMedia,
} from './human-chat-panel';
import {
  type MentionPickCandidate,
  useResolvedMentionCandidateLabel,
} from './human-chat-panel/use-resolved-mention-candidate-label';
import type { ChatPanelTab } from './human-chat-panel';
import { useHumanChatPanel } from './human-chat-panel-context';
import {
  computeAggregateUnreadMentionCount,
  computeHumanChatUnreadState,
} from './human-chat-panel/matrix-chat-unread';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabel,
  matrixUserIdToCanonicalPrivySub,
  shortenMatrixIdForDisplay,
} from './human-chat-panel/matrix-room-member-display';
import { getActiveTabFromPath } from './get-active-tab-from-path';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { getLocaleFromPath } from './get-locale-from-path';
import { useCallJoinChime } from './human-chat-panel/use-call-join-chime';
import {
  sanitizeMentionDisplayLabel,
  wireComposerPlainForMatrixSend,
} from './human-chat-panel/human-chat-display-mention';
import { Empty } from './empty';
import { useGlobalCallDock } from './global-call-dock-context';

function personRosterLabel(p: Person, unknownLabel: string): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (p.nickname?.trim()) return p.nickname.trim();
  return unknownLabel;
}

function disposeDraftAttachmentUrls(drafts: ChatDraftAttachment[]) {
  for (const a of drafts) {
    if (a.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(a.previewUrl);
    }
  }
}

function SignalTeamResolvedMemberLabel({
  candidate,
  fallbackLabel,
  isOwner = false,
  unknownMemberLabel,
}: {
  candidate: MentionPickCandidate;
  fallbackLabel: string;
  isOwner?: boolean;
  unknownMemberLabel: string;
}) {
  const { resolvedLabel, busy } = useResolvedMentionCandidateLabel(candidate);
  const syncFallback = looksLikeTechnicalMatrixDisplayName(
    fallbackLabel,
    candidate.userId,
  )
    ? ''
    : fallbackLabel.trim();
  const finalLabel = resolvedLabel?.trim() || syncFallback;
  const showSkeleton =
    busy ||
    !finalLabel ||
    looksLikeTechnicalMatrixDisplayName(finalLabel, candidate.userId);

  if (showSkeleton) {
    return (
      <Skeleton
        className="inline-block align-baseline"
        loading
        width={140}
        height={16}
      />
    );
  }

  return (
    <span className="truncate">
      {finalLabel || unknownMemberLabel}
      {isOwner ? ' 👑' : ''}
    </span>
  );
}

/** Sanitized labels shared by multiple members need a disambiguated composer token + map key. */
function computeDuplicateSanitizedDisplayKeys(
  mentionLabelByUserId: ReadonlyMap<string, string>,
): Set<string> {
  const counts = new Map<string, number>();
  for (const label of mentionLabelByUserId.values()) {
    const k = sanitizeMentionDisplayLabel(label);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const dup = new Set<string>();
  for (const [k, n] of counts) {
    if (n > 1) dup.add(k);
  }
  return dup;
}

function disambiguatedMentionTokenKey(
  userId: string,
  displayLabel: string,
  duplicateKeys: ReadonlySet<string>,
): string {
  let key = sanitizeMentionDisplayLabel(displayLabel);
  if (!key) return '';
  if (!duplicateKeys.has(key)) return key;
  const stem = shortenMatrixIdForDisplay(userId).replace(/^@/, '').trim();
  const short =
    stem.length <= 26 ? stem : `${stem.slice(0, 12)}…${stem.slice(-8)}`;
  key = sanitizeMentionDisplayLabel(`${displayLabel} (${short})`);
  if (!key) return sanitizeMentionDisplayLabel(userId);
  return key;
}

type UIMessage = {
  id: string;
  role: 'user' | 'member';
  /** True for non-Matrix rows (e.g. welcome); disables reply/reactions. */
  isSynthetic?: boolean;
  /** Optimistic row while uploads run (cleared when send completes or fails). */
  sendPending?: {
    attachmentCount: number;
    captionPreview: string;
    uploadedCount?: number;
  };
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  /** Matrix file/image attachment (timeline); first slot when `mediaSlots` is set. */
  media?: ChatPanelAttachmentMedia;
  /** All attachment slots for one Matrix message (bundle). */
  mediaSlots?: ChatPanelAttachmentMedia[];
  senderName?: string;
  avatarUrl?: string;
  /** Matrix event time (origin_server_ts), for header timestamp */
  timestamp?: Date;
  /** MSC3952 intentional mentions on this event (`m.mentions.user_ids`). */
  mentionedUserIds?: string[];
  /** Matrix custom HTML for visible body (when sent with formatting). */
  formattedContentHtml?: string;
  /** MXID of the message author (for reply target resolution). */
  senderMatrixId?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    includesCurrentUser?: boolean;
    reactorUserIds?: string[];
  }>;
  replyTo?: {
    authorLabel: string;
    excerpt?: string;
    /** Quoted author MXID when known (for label refresh). */
    sourceUserId?: string;
    /** Matrix avatar thumbnail for reply header */
    authorAvatarUrl?: string;
  };
};

type ReplyDraft = {
  messageId: string;
  authorLabel: string;
  excerpt: string;
  sourceUserId?: string;
  isYou?: boolean;
};

type EditDraft = {
  messageId: string;
  excerpt: string;
  /** Editing a bundled / media Matrix message (caption + attachments). */
  editMediaMode?: boolean;
};

const ROOM_STORAGE_KEY = 'hypha-chat-room-';

const SESSION_ROOM_TO_SPACE_PREFIX = 'hypha-room-to-space-';
const SESSION_ROOM_TO_COHERENCE_SLUG_PREFIX = 'hypha-room-to-coherence-slug-';
const SESSION_ROOM_TO_COHERENCE_TITLE_PREFIX = 'hypha-room-to-coherence-title-';
const COHERENCE_ROOM_REVERSE_PREFIX = 'hypha-room-id-to-coherence-';
const CHAT_HISTORY_SESSION_PREFIX = 'hypha-chat-history-v1-';
const CHAT_HISTORY_MAX_ITEMS = 250;
const SIGNAL_TEAM_EVENT_KIND = 'io.hypha.signal.team.v1';
const SIGNAL_TEAM_REQUEST_EVENT_KIND = 'io.hypha.signal.team.request.v1';
const SIGNAL_TEAM_EVENT_BODY_MARKER = '[hypha:signal-team]';
const SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER = '[hypha:signal-team-request]';

function toUserFriendlySignalSystemBody(body: string): string {
  const trimmed = body.trim();
  const withoutMarker = trimmed
    .replace(SIGNAL_TEAM_EVENT_BODY_MARKER, '')
    .replace(SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER, '')
    .trim();
  if (!withoutMarker) return 'Signal team updated';
  if (withoutMarker === 'signal team members updated') {
    return 'Signal team updated';
  }
  if (withoutMarker === 'signal team access requested') {
    return 'Signal team access requested';
  }
  if (withoutMarker === 'signal team access approved') {
    return 'Signal team access approved';
  }
  return withoutMarker;
}

type PersistedUIMessage = Omit<UIMessage, 'timestamp'> & {
  timestamp?: string;
};

type SignalTeamTimelineState = {
  memberMatrixUserIds: string[];
  pendingRequesterIds: string[];
  ownerMatrixUserId: string | null;
};

type SignalTeamEventContent = {
  msgtype: RoomMessageEventContent['msgtype'];
  body: RoomMessageEventContent['body'];
  coherenceSlug: string | null;
  memberMatrixUserIds?: string[];
  ownerMatrixUserId?: string | null;
  requesterMatrixUserId?: string;
  status?: 'pending' | 'approved';
  addedMemberMatrixUserIds?: string[];
  removedMemberMatrixUserIds?: string[];
  updatedAt: string;
} & RoomMessageEventContent;

function normalizeMatrixUserIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function roomPowerLevelForUser(
  room: Room | undefined,
  userId: string | null,
): number {
  if (!room || !userId) return 0;
  const powerLevels = room.currentState.getStateEvents(
    EventType.RoomPowerLevels,
    '',
  );
  const content = (powerLevels?.getContent() ?? {}) as {
    users?: Record<string, number>;
    users_default?: number;
  };
  const perUser = content.users?.[userId];
  if (typeof perUser === 'number') return perUser;
  const fromMember = room.getMember(userId)?.powerLevel;
  if (typeof fromMember === 'number') return fromMember;
  return typeof content.users_default === 'number' ? content.users_default : 0;
}

function deriveSignalTeamStateFromEvents(
  events: MatrixEvent[],
  coherenceSlug?: string | null,
  room?: Room,
): SignalTeamTimelineState {
  let memberMatrixUserIds: string[] = [];
  const pending = new Set<string>();
  let ownerMatrixUserId: string | null = null;
  const targetSlug = coherenceSlug?.trim() || null;

  for (const ev of events) {
    const eventType = ev.getType();
    if (eventType !== EventType.RoomMessage) continue;
    const content = ev.getContent() as Record<string, unknown> | null;
    if (!content || typeof content !== 'object') continue;
    const msgtype =
      typeof content.msgtype === 'string' ? content.msgtype.trim() : '';
    const body = typeof content.body === 'string' ? content.body.trim() : '';
    const eventKind = body.startsWith(SIGNAL_TEAM_EVENT_BODY_MARKER)
      ? SIGNAL_TEAM_EVENT_KIND
      : body.startsWith(SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER)
      ? SIGNAL_TEAM_REQUEST_EVENT_KIND
      : msgtype;
    const eventSlug =
      typeof content.coherenceSlug === 'string'
        ? content.coherenceSlug.trim()
        : '';
    if (targetSlug && eventSlug && eventSlug !== targetSlug) continue;
    const senderId = ev.getSender()?.trim() || null;
    const isKnownTrustedSender = Boolean(
      senderId &&
        (senderId === ownerMatrixUserId ||
          memberMatrixUserIds.includes(senderId)),
    );
    const hasElevatedRoomPower = roomPowerLevelForUser(room, senderId) >= 50;
    const isTrustedActor = isKnownTrustedSender || hasElevatedRoomPower;

    if (eventKind === SIGNAL_TEAM_EVENT_KIND) {
      if (!isTrustedActor) continue;
      memberMatrixUserIds = normalizeMatrixUserIds(content.memberMatrixUserIds);
      const nextOwnerId =
        typeof content.ownerMatrixUserId === 'string'
          ? content.ownerMatrixUserId.trim()
          : '';
      if (nextOwnerId) {
        ownerMatrixUserId = nextOwnerId;
      }
      continue;
    }

    if (eventKind !== SIGNAL_TEAM_REQUEST_EVENT_KIND) continue;
    const requesterId =
      typeof content.requesterMatrixUserId === 'string'
        ? content.requesterMatrixUserId.trim()
        : '';
    if (!requesterId) continue;
    const status =
      typeof content.status === 'string' ? content.status.trim() : 'pending';
    const requesterIsSender = senderId === requesterId;
    if (!requesterIsSender && !isTrustedActor) continue;
    if (status === 'pending') {
      pending.add(requesterId);
    } else {
      pending.delete(requesterId);
    }
  }

  return {
    memberMatrixUserIds,
    pendingRequesterIds: [...pending],
    ownerMatrixUserId,
  };
}

function readPersistedChatHistory(roomId: string): UIMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(
      `${CHAT_HISTORY_SESSION_PREFIX}${roomId}`,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedUIMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-CHAT_HISTORY_MAX_ITEMS).map((m) => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
    }));
  } catch {
    return [];
  }
}

function writePersistedChatHistory(
  roomId: string,
  messages: UIMessage[],
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedUIMessage[] = messages
      .slice(-CHAT_HISTORY_MAX_ITEMS)
      .map((m) => ({
        ...m,
        timestamp: m.timestamp?.toISOString(),
      }));
    window.sessionStorage.setItem(
      `${CHAT_HISTORY_SESSION_PREFIX}${roomId}`,
      JSON.stringify(payload),
    );
  } catch {
    // ignore
  }
}

/** Reverse map for navigating from Matrix room id → DHO space slug (localStorage). */
function readRoomIdToSpaceSlugFromStorage(): Map<string, string> {
  const m = new Map<string, string>();
  if (typeof window === 'undefined') return m;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(ROOM_STORAGE_KEY)) continue;
      const slug = key.slice(ROOM_STORAGE_KEY.length);
      if (!slug) continue;
      const rid = window.localStorage.getItem(key)?.trim();
      if (rid) m.set(rid, slug);
    }
  } catch {
    // ignore
  }
  return m;
}

function rememberRoomToSpaceSlugSession(roomId: string, slug: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${SESSION_ROOM_TO_SPACE_PREFIX}${roomId}`,
      slug,
    );
  } catch {
    // ignore
  }
}

function rememberRoomToCoherenceSession(
  roomId: string,
  slug: string,
  title?: string | null,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${SESSION_ROOM_TO_COHERENCE_SLUG_PREFIX}${roomId}`,
      slug,
    );
    if (title?.trim()) {
      window.sessionStorage.setItem(
        `${SESSION_ROOM_TO_COHERENCE_TITLE_PREFIX}${roomId}`,
        title.trim(),
      );
    }
    window.localStorage.setItem(
      `${COHERENCE_ROOM_REVERSE_PREFIX}${roomId}`,
      JSON.stringify({ slug, title: title?.trim() || null }),
    );
  } catch {
    // ignore
  }
}

function readRoomToCoherenceSession(roomId: string): {
  slug: string | null;
  title: string | null;
} {
  if (typeof window === 'undefined') return { slug: null, title: null };
  try {
    const slug = window.sessionStorage
      .getItem(`${SESSION_ROOM_TO_COHERENCE_SLUG_PREFIX}${roomId}`)
      ?.trim();
    const title = window.sessionStorage
      .getItem(`${SESSION_ROOM_TO_COHERENCE_TITLE_PREFIX}${roomId}`)
      ?.trim();
    if (slug) {
      return { slug, title: title || null };
    }
    const persisted = window.localStorage
      .getItem(`${COHERENCE_ROOM_REVERSE_PREFIX}${roomId}`)
      ?.trim();
    if (persisted) {
      const parsed = JSON.parse(persisted) as {
        slug?: string;
        title?: string | null;
      };
      const persistedSlug = parsed.slug?.trim();
      if (persistedSlug) {
        return {
          slug: persistedSlug,
          title: parsed.title?.trim() || null,
        };
      }
    }
    return { slug: null, title: null };
  } catch {
    return { slug: null, title: null };
  }
}

/**
 * Get a persisted room ID for a space slug from localStorage.
 */
function getStoredRoomId(spaceSlug: string): string | null {
  try {
    return localStorage.getItem(`${ROOM_STORAGE_KEY}${spaceSlug}`);
  } catch {
    return null;
  }
}

function storeRoomId(spaceSlug: string, roomId: string): void {
  try {
    localStorage.setItem(`${ROOM_STORAGE_KEY}${spaceSlug}`, roomId);
  } catch {
    // localStorage not available
  }
}

function clearStoredRoomId(spaceSlug: string): void {
  try {
    localStorage.removeItem(`${ROOM_STORAGE_KEY}${spaceSlug}`);
  } catch {
    // localStorage not available
  }
}

/**
 * Matrix room member avatar → HTTP thumbnail for `<img>` (unauthenticated media URL).
 */
function matrixMemberAvatarSquare(
  client: MatrixClient | null | undefined,
  roomId: string | null | undefined,
  userId: string | undefined,
  px: number,
): string | undefined {
  if (!client || !roomId || !userId) return undefined;
  const room = client.getRoom(roomId);
  const member = room?.getMember(userId);
  if (!member) return undefined;
  const mxc = member.getMxcAvatarUrl();
  if (!mxc || !mxc.startsWith('mxc://')) return undefined;
  return (
    client.mxcUrlToHttp(mxc, px, px, 'crop', true, false, false) ?? undefined
  );
}

/**
 * Convert a Matrix Message to the UIMessage format expected by panel components.
 */
function toUIMessage(
  msg: Message,
  currentUserId: string | null | undefined,
  resolveMemberLabel: (userId: string | undefined) => string,
  currentUserAvatarUrl?: string,
  resolveMemberAvatar?: (userId: string | undefined) => string | undefined,
  roomIdForAvatars?: string | null,
  clientForAvatars?: MatrixClient | null,
): UIMessage {
  const resolveAvatarForUser = (userId: string | undefined) => {
    if (!userId) return undefined;
    return (
      resolveMemberAvatar?.(userId) ??
      matrixMemberAvatarSquare(
        clientForAvatars ?? null,
        roomIdForAvatars ?? null,
        userId,
        96,
      )
    );
  };

  const isCurrentUser = currentUserId ? msg.sender === currentUserId : false;

  const isMedia =
    msg.msgtype === 'm.file' ||
    msg.msgtype === 'm.image' ||
    msg.msgtype === 'm.audio';

  const strippedMediaBody = isMedia
    ? stripMatrixReplyFallback(msg.content).trim()
    : '';
  const mediaFilenameForCaption = (msg.filename ?? msg.content).trim();
  const captionForMedia =
    isMedia &&
    strippedMediaBody.length > 0 &&
    strippedMediaBody !== mediaFilenameForCaption
      ? strippedMediaBody
      : '';

  let replyTo: UIMessage['replyTo'];
  if (msg.inReplyToEventId) {
    const authorLabel = resolveMemberLabel(msg.inReplyToSender);
    const excerpt =
      msg.inReplyToBodyPreview != null && msg.inReplyToBodyPreview !== ''
        ? msg.inReplyToBodyPreview
        : undefined;
    const replyAuthorId = msg.inReplyToSender;
    const replyAvatar =
      currentUserId &&
      replyAuthorId &&
      replyAuthorId === currentUserId &&
      currentUserAvatarUrl
        ? currentUserAvatarUrl
        : matrixMemberAvatarSquare(
            clientForAvatars ?? null,
            roomIdForAvatars ?? null,
            replyAuthorId,
            64,
          ) ?? resolveAvatarForUser(replyAuthorId);
    replyTo = {
      authorLabel,
      excerpt,
      sourceUserId: msg.inReplyToSender,
      authorAvatarUrl: replyAvatar,
    };
  }

  const reactions =
    msg.reactions?.map((r: MessageReaction) => ({
      emoji: r.key,
      count: r.count,
      includesCurrentUser: r.includesCurrentUser,
      reactorUserIds: r.reactorUserIds,
    })) ?? undefined;

  const mediaSingle =
    isMedia && msg.msgtype
      ? {
          msgtype: msg.msgtype as 'm.file' | 'm.image' | 'm.audio',
          mxcUrl: msg.mxcUrl,
          filename: msg.filename ?? msg.content,
          mediaInfo: msg.mediaInfo,
          spoiler: msg.spoiler,
        }
      : undefined;

  const mediaSlots: ChatPanelAttachmentMedia[] | undefined =
    isMedia && msg.msgtype && msg.mediaBundle && msg.mediaBundle.length > 1
      ? msg.mediaBundle.map((b) => ({
          msgtype: b.msgtype,
          mxcUrl: b.mxcUrl,
          filename: b.filename ?? '',
          mediaInfo: b.mediaInfo,
          spoiler: b.spoiler,
        }))
      : undefined;

  const media = mediaSingle;
  const normalizedTextContent = isMedia
    ? msg.content
    : toUserFriendlySignalSystemBody(msg.content);

  const memberAvatar =
    !isCurrentUser && msg.sender ? resolveAvatarForUser(msg.sender) : undefined;

  return {
    id: msg.id,
    role: isCurrentUser ? 'user' : 'member',
    isSynthetic: false,
    parts: isMedia
      ? captionForMedia
        ? [{ type: 'text', text: captionForMedia }]
        : []
      : [{ type: 'text', text: normalizedTextContent }],
    media,
    mediaSlots,
    formattedContentHtml:
      isMedia && !captionForMedia ? undefined : msg.formattedContentHtml,
    senderName: isCurrentUser ? undefined : resolveMemberLabel(msg.sender),
    senderMatrixId: msg.sender,
    avatarUrl: isCurrentUser ? currentUserAvatarUrl : memberAvatar,
    timestamp: msg.timestamp,
    reactions,
    replyTo,
    ...(msg.mentionedUserIds?.length
      ? { mentionedUserIds: msg.mentionedUserIds }
      : {}),
  };
}

/**
 * Empty `File` used only as a composer metadata carrier for existing Matrix
 * slots (content stays on the homeserver via MXC).
 */
function dummyEditFile(filename: string, mime?: string): File {
  return new File([], filename || 'attachment', {
    type: mime || 'application/octet-stream',
  });
}

function buildEditMediaDraftAttachments(
  m: UIMessage,
  previewForMxc: (mxc: string) => string | null,
): ChatDraftAttachment[] {
  const slots: NonNullable<UIMessage['media']>[] = [];
  if (m.media?.mxcUrl) {
    slots.push(m.media);
  }
  if (m.mediaSlots && m.mediaSlots.length > 1) {
    for (const s of m.mediaSlots.slice(1)) {
      if (s.mxcUrl) slots.push(s);
    }
  }
  const out: ChatDraftAttachment[] = [];
  for (const slot of slots) {
    const mxc = slot.mxcUrl!;
    const thumb = previewForMxc(mxc) ?? EDIT_IMAGE_PLACEHOLDER;
    const isVid = slot.msgtype === 'm.file' && isChatPanelVideoFile(slot);
    const isAud = isChatPanelAudioFile(slot);
    const kind: ChatDraftAttachment['kind'] =
      slot.msgtype === 'm.image'
        ? 'image'
        : isAud
        ? 'audio'
        : isVid
        ? 'video'
        : 'file';
    out.push({
      id: newChatDraftAttachmentId(),
      file: dummyEditFile(
        slot.filename ?? 'attachment',
        slot.mediaInfo?.mimetype,
      ),
      kind,
      previewUrl: thumb || mxc,
      spoiler: Boolean(slot.spoiler),
      editSlot: {
        mxcUrl: mxc,
        msgtype: slot.msgtype,
        filename: slot.filename,
        mediaInfo: slot.mediaInfo,
        spoiler: slot.spoiler,
      },
    });
  }
  return out;
}

const EDIT_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function newChatDraftAttachmentId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getMessagePlainText(m: UIMessage): string {
  const textParts =
    m.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  const fromParts = textParts.map((p) => p.text).join('');
  if (fromParts.trim()) return fromParts;
  if (m.mediaSlots && m.mediaSlots.length > 0) {
    const names = m.mediaSlots
      .map((s) => s.filename)
      .filter(Boolean) as string[];
    if (names.length) return names.join(', ');
  }
  if (m.media?.filename) return m.media.filename;
  return '';
}

type HumanRightPanelProps = {
  useMembers: UseMembers;
};

export function HumanRightPanel({ useMembers }: HumanRightPanelProps) {
  const t = useTranslations('HumanChatPanel');
  const tSpaces = useTranslations('Spaces');
  const params = useParams<{ id?: string }>();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceSlug = params?.id;

  const matrix = useMatrix();
  const {
    client,
    isMatrixAvailable,
    isAuthenticated: isMatrixAuthenticated,
    markRoomRead,
  } = matrix;

  // Store matrix methods in a ref to avoid infinite re-render loops.
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;

  const {
    mode,
    coherenceRoomId,
    coherenceTitle,
    coherenceSlug,
    closeCoherenceChat,
    openCoherenceChat,
    openHumanChatPanel,
  } = useHumanChatPanel();
  const { jwt: authToken } = useJwt();
  const { useSendNotifications } = useHookRegistry();
  const { notifyChatMention } = useSendNotifications({ authToken });
  const { person: me } = useMe();
  const { persons: spaceMembersResult } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });
  const spaceMembers = useMemo(
    () => spaceMembersResult?.data ?? [],
    [spaceMembersResult?.data],
  );
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug ?? '');
  const effectiveSpaceWeb3Id = space?.web3SpaceId ?? undefined;
  const { access: spaceActivityAccess, isLoading: isDiscoverabilityLoading } =
    useSpaceDiscoverability({
      spaceId: effectiveSpaceWeb3Id ? BigInt(effectiveSpaceWeb3Id) : undefined,
    });
  const { userState: userSpaceState, isLoading: isUserSpaceStateLoading } =
    useUserSpaceState({
      spaceSlug,
      space,
      spaceId: effectiveSpaceWeb3Id,
    });
  const { updateSpaceBySlug } = useSpaceMutationsWeb2Rsc(authToken);
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);

  const hasSpaceActivityAccess = checkAccess(
    spaceActivityAccess,
    userSpaceState,
  );
  const isSpaceMember = userSpaceState === UserSpaceState.LOGGED_IN_SPACE;
  const blockSpaceChatForActivityAccess =
    mode === 'space' &&
    !isUserSpaceStateLoading &&
    !isDiscoverabilityLoading &&
    !hasSpaceActivityAccess;
  const blockSpaceChatComposer =
    mode === 'space' && !isUserSpaceStateLoading && !isSpaceMember;

  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;
  const updateSpaceBySlugRef = useRef(updateSpaceBySlug);
  updateSpaceBySlugRef.current = updateSpaceBySlug;
  const updateCoherenceBySlugRef = useRef(updateCoherenceBySlug);
  updateCoherenceBySlugRef.current = updateCoherenceBySlug;
  const { open: sidebarOpen, isMobile: isSidebarMobile } = useSidebar();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    login,
  } = useAuthentication();

  const currentUserAvatarUrl = me?.avatarUrl;
  const currentUserAvatarUrlRef = useRef(currentUserAvatarUrl);
  currentUserAvatarUrlRef.current = currentUserAvatarUrl;

  const [input, setInput] = useState('');
  /** Hypha-resolved names from the mention picker (may differ from Matrix fallback displayLabel). */
  const [mentionDisplayOverride, setMentionDisplayOverride] = useState<
    Record<string, string>
  >({});

  const [draftAttachments, setDraftAttachments] = useState<
    ChatDraftAttachment[]
  >([]);
  const draftAttachmentsRef = useRef(draftAttachments);
  draftAttachmentsRef.current = draftAttachments;
  /** Latest in-flight send; used so error recovery does not clobber edits from a newer send. */
  const sendOperationTokenRef = useRef<symbol | null>(null);
  const sendAbortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  /** Coalesce Matrix timeline bursts into one React commit per frame (sync backfills). */
  const timelineFlushRafRef = useRef<number | null>(null);
  const pendingTimelineRedactIdsRef = useRef<Set<string>>(new Set());
  const pendingTimelineMessagesRef = useRef<Map<string, Message>>(new Map());
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const replyDraftRef = useRef(replyDraft);
  replyDraftRef.current = replyDraft;
  const editDraftRef = useRef(editDraft);
  editDraftRef.current = editDraft;
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    setMentionDisplayOverride({});
  }, [roomId]);

  useEffect(() => {
    if (mode !== 'coherence') {
      setSignalTeamPanelOpen(false);
    }
  }, [mode]);

  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatPanelTab>('chat');
  const [scrollToEventId, setScrollToEventId] = useState<string | null>(null);
  const [mentionNavigationNotice, setMentionNavigationNotice] = useState<
    string | null
  >(null);
  /** Shown in timeline after a short delay while large attachment sends run. */
  const [sendingPending, setSendingPending] = useState<null | {
    id: string;
    attachmentCount: number;
    captionPreview: string;
    uploadedCount?: number;
  }>(null);
  const joinedRef = useRef<string | null>(null);
  const [unreadBump, setUnreadBump] = useState(0);
  const [aggregateMentionBump, setAggregateMentionBump] = useState(0);
  const lastAutoMarkReadAtRef = useRef(0);
  const [signalTeamMemberIds, setSignalTeamMemberIds] = useState<string[]>([]);
  const [signalTeamOwnerId, setSignalTeamOwnerId] = useState<string | null>(
    null,
  );
  const [signalTeamPendingRequesterIds, setSignalTeamPendingRequesterIds] =
    useState<string[]>([]);
  const [signalTeamPanelOpen, setSignalTeamPanelOpen] = useState(false);
  const [signalTeamDraftMemberIds, setSignalTeamDraftMemberIds] = useState<
    string[] | null
  >(null);
  const [signalTeamBusy, setSignalTeamBusy] = useState(false);
  const signalTeamAutoSeededRoomIdsRef = useRef<Set<string>>(new Set());

  const currentUserId = client?.getUserId?.() ?? null;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const matrixClientRef = useRef(client);
  matrixClientRef.current = client;
  const resetChatStateOnAuthDrop = useCallback(() => {
    const activeRoomId = roomIdRef.current;
    if (activeRoomId) {
      matrixRef.current.unregisterRoomListener(activeRoomId);
    }
    joinedRef.current = null;
    setRoomId(null);
    setMessages([]);
    setInput('');
    disposeDraftAttachmentUrls(draftAttachmentsRef.current);
    setDraftAttachments([]);
    setReplyDraft(null);
    setEditDraft(null);
    setError(null);
    setReactionError(null);
    setComposerError(null);
    setDeleteError(null);
    setSendingPending(null);
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAuthenticated) return;
    resetChatStateOnAuthDrop();
  }, [isAuthLoading, isAuthenticated, resetChatStateOnAuthDrop]);

  useEffect(() => {
    if (!isMatrixAvailable) return;
    if (isMatrixAuthenticated) return;
    resetChatStateOnAuthDrop();
  }, [isMatrixAvailable, isMatrixAuthenticated, resetChatStateOnAuthDrop]);

  const {
    bindRoomContext,
    callState: spaceCallState,
    errorCode: spaceCallError,
    callKind: spaceCallKind,
    startAudioForRoom,
    startVideoForRoom,
    leave: leaveSpaceCall,
    setMicrophoneMuted: setSpaceCallMicMuted,
    setCameraMuted: setSpaceCallCameraMuted,
    participantSummary: spaceCallParticipantSummary,
    roomGroupCallDeviceCount: spaceCallRoomGroupDeviceCount,
    othersInRoomCallCount: spaceCallOthersInRoom,
    inCallUserIdsForRoster: spaceCallInCallUserIds,
    showRoomCallInProgress: spaceCallShowJoinStrip,
    isMicrophoneMuted: spaceCallMicMuted,
    isLocalVideoMuted: spaceCallVideoMuted,
    isScreensharing: spaceCallScreensharing,
    groupCall: spaceGroupCall,
    feedVersion: spaceCallFeedVersion,
    screenshareErrorCode: spaceCallScreenshareError,
    captureMode: spaceCallCaptureMode,
    capturePreference: spaceCallCapturePreference,
    capturePreferenceSelected: spaceCallCapturePreferenceSelected,
    setCapturePreference: setSpaceCallCapturePreference,
    startCapture: startSpaceCallCapture,
    pauseCapture: pauseSpaceCallCapture,
    resumeCapture: resumeSpaceCallCapture,
    stopCapture: stopSpaceCallCapture,
    recordingStatus: spaceCallRecordingStatus,
    recordingError: spaceCallRecordingError,
    recordingWarning: spaceCallRecordingWarning,
    canRetryRecordingUpload: spaceCallCanRetryRecordingUpload,
    retryRecordingUpload: retrySpaceCallRecordingUpload,
    captureConsent: spaceCallCaptureConsent,
    dismissScreenshareError: dismissSpaceCallScreenshareError,
    screenshareTakeoverIncoming: spaceCallScreenshareTakeoverIncoming,
    screenshareTakeoverPendingId: spaceCallScreenshareTakeoverPendingId,
    screenshareTakeoverDenied: spaceCallScreenshareTakeoverDenied,
    approveScreenshareTakeover: approveSpaceCallScreenshareTakeover,
    denyScreenshareTakeover: denySpaceCallScreenshareTakeover,
    cancelScreenshareTakeoverRequest: cancelSpaceCallScreenshareTakeoverRequest,
    dismissScreenshareTakeoverPrompt: dismissSpaceCallScreenshareTakeoverPrompt,
    activeSpeakerKey: spaceCallActiveSpeakerKey,
    setScreensharingEnabled: setSpaceCallScreensharing,
    voiceProcessingPreset: spaceCallVoiceProcessingPreset,
    setVoiceProcessingPreset: setSpaceCallVoiceProcessingPreset,
    tabBackgroundWhileInCall: spaceCallTabBackground,
    retryFromError: retrySpaceCall,
    dismissCallError: dismissSpaceCallError,
    remoteMediaStall: spaceCallRemoteMediaStall,
    dismissRemoteMediaStallBanner: dismissSpaceCallRemoteMediaStall,
    showFloatingDock,
  } = useGlobalCallDock();

  useEffect(() => {
    const activeRoomId = roomId?.trim() || null;
    const activeSpaceSlug = spaceSlug?.trim() || null;
    const activeAuthToken = authToken?.trim() || null;

    if (activeRoomId) {
      bindRoomContext(activeRoomId, activeSpaceSlug, activeAuthToken);
    } else {
      bindRoomContext(null, null, null);
    }

    return () => {
      bindRoomContext(null, null, null);
    };
  }, [authToken, bindRoomContext, roomId, spaceSlug]);

  const callUiEnabled = useMemo(
    () =>
      Boolean(roomId) &&
      isMatrixAvailable &&
      isMatrixAuthenticated &&
      isSpaceMember,
    [roomId, isMatrixAvailable, isMatrixAuthenticated, isSpaceMember],
  );

  const inSpaceCall =
    spaceCallState === 'connected' ||
    spaceCallState === 'connecting' ||
    spaceCallState === 'awaiting_media' ||
    spaceCallState === 'initializing';

  const spaceCallToolbarJoinHint = callUiEnabled && spaceCallShowJoinStrip;
  const showAuthedUi = !isAuthLoading && isAuthenticated;
  const showAuthPrompt = !isAuthLoading && !isAuthenticated;
  const sidebarContentRef = useRef<HTMLDivElement | null>(null);
  const sidebarWidthBeforeAuthPromptRef = useRef<string | null>(null);

  useEffect(() => {
    const contentEl = sidebarContentRef.current;
    if (!contentEl) return;
    const providerEl = contentEl.closest(
      '[data-sidebar="wrapper"]',
    ) as HTMLElement | null;
    if (!providerEl) return;
    const restoreSidebarWidth = () => {
      if (sidebarWidthBeforeAuthPromptRef.current != null) {
        const previous = sidebarWidthBeforeAuthPromptRef.current;
        if (previous) {
          providerEl.style.setProperty('--sidebar-width', previous);
        } else {
          providerEl.style.removeProperty('--sidebar-width');
        }
        sidebarWidthBeforeAuthPromptRef.current = null;
      }
    };

    // Keep mobile behavior untouched; only normalize desktop unauthenticated width.
    if (isSidebarMobile || !sidebarOpen) {
      restoreSidebarWidth();
      return;
    }

    if (showAuthPrompt) {
      if (sidebarWidthBeforeAuthPromptRef.current == null) {
        sidebarWidthBeforeAuthPromptRef.current =
          providerEl.style.getPropertyValue('--sidebar-width') || '';
      }
      providerEl.style.setProperty('--sidebar-width', '320px');
      return restoreSidebarWidth;
    }

    restoreSidebarWidth();
    return restoreSidebarWidth;
  }, [isSidebarMobile, showAuthPrompt, sidebarOpen]);

  /** Distinct Matrix users in the room call besides the current user (not device count). */
  const spaceCallOtherMemberCount = useMemo(
    () =>
      spaceCallInCallUserIds.filter((id) => id && id !== currentUserId).length,
    [spaceCallInCallUserIds, currentUserId],
  );

  const spaceCallShowJoinChime = useMemo(
    () => callUiEnabled && spaceCallShowJoinStrip && !inSpaceCall,
    [callUiEnabled, spaceCallShowJoinStrip, inSpaceCall],
  );

  const joinChimeNotification = useMemo(
    () => ({
      title: t('callJoinNotificationTitle'),
      body: t('callJoinNotificationBody', {
        count: spaceCallRoomGroupDeviceCount,
      }),
    }),
    [t, spaceCallRoomGroupDeviceCount],
  );

  const { joinAlertSoundEnabled, setJoinAlertSoundEnabled } = useCallJoinChime({
    callUiEnabled,
    roomId,
    showJoinOpportunity: spaceCallShowJoinChime,
    roomCallDeviceCount: spaceCallRoomGroupDeviceCount,
    notification: joinChimeNotification,
  });

  const spaceCallBusyJoining =
    spaceCallState === 'initializing' ||
    spaceCallState === 'awaiting_media' ||
    spaceCallState === 'connecting';

  const handleCallAudio = useCallback(() => {
    const launchContext =
      mode === 'coherence' && coherenceTitle?.trim()
        ? {
            signalTitle: coherenceTitle.trim(),
            signalSlug: coherenceSlug?.trim() || undefined,
          }
        : undefined;
    void startAudioForRoom(
      roomId,
      spaceSlug ?? null,
      undefined,
      authToken,
      launchContext,
    );
  }, [
    authToken,
    coherenceSlug,
    coherenceTitle,
    mode,
    startAudioForRoom,
    roomId,
    spaceSlug,
  ]);

  const handleCallVideo = useCallback(() => {
    const launchContext =
      mode === 'coherence' && coherenceTitle?.trim()
        ? {
            signalTitle: coherenceTitle.trim(),
            signalSlug: coherenceSlug?.trim() || undefined,
          }
        : undefined;
    void startVideoForRoom(
      roomId,
      spaceSlug ?? null,
      undefined,
      authToken,
      launchContext,
    );
  }, [
    authToken,
    coherenceSlug,
    coherenceTitle,
    mode,
    startVideoForRoom,
    roomId,
    spaceSlug,
  ]);

  const handleCallLeave = useCallback(() => {
    void leaveSpaceCall();
  }, [leaveSpaceCall]);

  const handleCallToggleMic = useCallback(() => {
    void setSpaceCallMicMuted(!spaceCallMicMuted);
  }, [setSpaceCallMicMuted, spaceCallMicMuted]);

  const handleCallToggleCamera = useCallback(() => {
    void setSpaceCallCameraMuted(!spaceCallVideoMuted);
  }, [setSpaceCallCameraMuted, spaceCallVideoMuted]);

  const handleCallToggleScreenshare = useCallback(() => {
    void setSpaceCallScreensharing(!spaceCallScreensharing);
  }, [setSpaceCallScreensharing, spaceCallScreensharing]);

  const handleCallVoiceProcessingPresetChange = useCallback(
    (preset: 'standard' | 'voice_isolation' | 'music') => {
      void setSpaceCallVoiceProcessingPreset(preset);
    },
    [setSpaceCallVoiceProcessingPreset],
  );

  const handleRetrySpaceCall = useCallback(() => {
    retrySpaceCall();
  }, [retrySpaceCall]);

  /** Bumps when Matrix room membership changes so `@` mention candidates + button state refresh without reload. */
  const [mentionMembershipEpoch, setMentionMembershipEpoch] = useState(0);
  const [matrixProfileLabelByUserId, setMatrixProfileLabelByUserId] = useState<
    Record<string, string>
  >({});
  const profileLookupInFlightRef = useRef<Set<string>>(new Set());
  const profileLookupAttemptedRef = useRef<Set<string>>(new Set());

  const rosterSubs = useMemo(
    () =>
      spaceMembers
        .map((p) => p.sub?.trim())
        .filter((s): s is string => Boolean(s)),
    [spaceMembers],
  );

  const { subToMatrixUserId } = useMatrixUserIdsByPrivySubs({
    privySubs: rosterSubs,
  });

  /** Same source as `@` mention labels: Hypha roster wins over Matrix bridge displaynames. */
  const matrixUserIdToPersonLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of spaceMembers) {
      const sub = p.sub?.trim();
      if (!sub) continue;
      const mxid = subToMatrixUserId[sub]?.trim();
      if (!mxid) continue;
      m.set(mxid, personRosterLabel(p, t('unknownMember')));
    }
    return m;
  }, [spaceMembers, subToMatrixUserId, t]);

  /** Fallback roster lookup using Matrix localpart == Privy sub (same `useMembers` roster source as chat Members tab). */
  const personLabelByPrivySub = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of spaceMembers) {
      const sub = p.sub?.trim();
      if (!sub) continue;
      m.set(sub, personRosterLabel(p, t('unknownMember')));
    }
    return m;
  }, [spaceMembers, t]);

  const matrixLocalpartToPrivySub = useCallback(
    (userId: string): string | null => {
      return matrixUserIdToCanonicalPrivySub(userId);
    },
    [],
  );

  const resolveMemberLabel = useCallback(
    (userId: string | undefined) => {
      if (!userId) return t('unknownMember');
      if (currentUserId && userId === currentUserId) {
        const full = [me?.name, me?.surname].filter(Boolean).join(' ').trim();
        return full || t('you');
      }
      const rosterLabel = matrixUserIdToPersonLabel.get(userId)?.trim();
      if (rosterLabel) return rosterLabel;
      const localpartSub = matrixLocalpartToPrivySub(userId);
      if (localpartSub) {
        const rosterBySub = personLabelByPrivySub.get(localpartSub)?.trim();
        if (rosterBySub) return rosterBySub;
      }
      const profileLabel = matrixProfileLabelByUserId[userId]?.trim();
      if (
        profileLabel &&
        !looksLikeTechnicalMatrixDisplayName(profileLabel, userId)
      ) {
        return profileLabel;
      }
      if (roomId && client) {
        const room = client.getRoom(roomId);
        const member = room?.getMember(userId);
        if (member) {
          const fromMatrix = matrixMemberDisplayLabel(member, userId);
          if (!looksLikeTechnicalMatrixDisplayName(fromMatrix, userId)) {
            return fromMatrix;
          }
        }
      }
      return shortenMatrixIdForDisplay(userId);
    },
    [
      client,
      currentUserId,
      matrixLocalpartToPrivySub,
      matrixProfileLabelByUserId,
      matrixUserIdToPersonLabel,
      me?.name,
      me?.surname,
      personLabelByPrivySub,
      roomId,
      t,
    ],
  );

  const mentionCandidateRoomIds = useMemo(() => {
    const ids = new Set<string>();
    if (roomId?.trim()) {
      ids.add(roomId.trim());
    }
    if (mode === 'coherence' && space?.chatRoomId?.trim()) {
      ids.add(space.chatRoomId.trim());
    }
    return [...ids];
  }, [roomId, mode, space?.chatRoomId]);

  const rawMentionCandidates = useMemo((): ChatMentionCandidate[] => {
    if (!client || mentionCandidateRoomIds.length === 0) return [];

    const byUserId = new Map<
      string,
      { displayLabel: string; avatarUrl?: string; privySub?: string }
    >();

    for (const candidateRoomId of mentionCandidateRoomIds) {
      const room = client.getRoom(candidateRoomId);
      if (!room) continue;
      for (const member of room.getJoinedMembers()) {
        const userId = member.userId;
        if (!userId) continue;
        if (currentUserId && userId === currentUserId) continue;
        byUserId.set(userId, {
          displayLabel: matrixMemberDisplayLabel(member, userId),
          avatarUrl: matrixMemberAvatarSquare(
            client,
            candidateRoomId,
            userId,
            64,
          ),
        });
      }
    }

    /** Same names as Members tab — overrides Matrix-only technical displaynames. */
    for (const p of spaceMembers) {
      const sub = p.sub?.trim();
      if (!sub) continue;
      let mxid = subToMatrixUserId[sub];
      if (!mxid) {
        for (const userId of byUserId.keys()) {
          if (matrixUserIdToCanonicalPrivySub(userId) === sub) {
            mxid = userId;
            break;
          }
        }
      }
      if (!mxid) continue;
      if (currentUserId && mxid === currentUserId) continue;
      const prev = byUserId.get(mxid);
      byUserId.set(mxid, {
        displayLabel: personRosterLabel(p, t('unknownMember')),
        avatarUrl: p.avatarUrl ?? prev?.avatarUrl,
        privySub: sub,
      });
    }

    const list: ChatMentionCandidate[] = [];
    for (const [userId, v] of byUserId) {
      list.push({
        userId,
        displayLabel: v.displayLabel,
        avatarUrl: v.avatarUrl,
        ...(v.privySub ? { privySub: v.privySub } : {}),
      });
    }

    list.sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel, undefined, {
        sensitivity: 'base',
      }),
    );
    return list;
  }, [
    client,
    mentionCandidateRoomIds,
    currentUserId,
    spaceMembers,
    subToMatrixUserId,
    t,
    mentionMembershipEpoch,
  ]);

  useEffect(() => {
    if (!client || rawMentionCandidates.length === 0) return;
    const unresolved = rawMentionCandidates.filter((candidate) => {
      if (profileLookupAttemptedRef.current.has(candidate.userId)) return false;
      if (matrixProfileLabelByUserId[candidate.userId]) return false;
      if (matrixUserIdToCanonicalPrivySub(candidate.userId)) return false;
      if (matrixUserIdToPersonLabel.has(candidate.userId)) return false;
      return looksLikeTechnicalMatrixDisplayName(
        candidate.displayLabel,
        candidate.userId,
      );
    });
    if (unresolved.length === 0) return;

    const batch = unresolved.slice(0, 3);
    for (const candidate of batch) {
      const userId = candidate.userId;
      if (profileLookupInFlightRef.current.has(userId)) continue;
      if (profileLookupAttemptedRef.current.has(userId)) continue;
      profileLookupInFlightRef.current.add(userId);
      profileLookupAttemptedRef.current.add(userId);
      void client
        .getProfileInfo(userId)
        .then((profile) => {
          const displayName =
            typeof profile?.displayname === 'string'
              ? profile.displayname.trim()
              : '';
          if (
            !displayName ||
            looksLikeTechnicalMatrixDisplayName(displayName, userId)
          ) {
            return;
          }
          setMatrixProfileLabelByUserId((prev) => {
            if (prev[userId] === displayName) return prev;
            return { ...prev, [userId]: displayName };
          });
        })
        .catch(() => {
          // Best-effort lookup; keep existing fallback when unavailable.
        })
        .finally(() => {
          profileLookupInFlightRef.current.delete(userId);
        });
    }
  }, [
    client,
    rawMentionCandidates,
    matrixProfileLabelByUserId,
    matrixUserIdToPersonLabel,
  ]);

  const mergeMentionDisplayLabel = useCallback(
    (userId: string, displayLabel: string) => {
      const trimmedLabel = displayLabel.trim();
      if (!trimmedLabel) return;
      setMentionDisplayOverride((prev) => {
        if (prev[userId] === trimmedLabel) return prev;
        return { ...prev, [userId]: trimmedLabel };
      });
    },
    [],
  );

  const isSignalThread = mode === 'coherence' && Boolean(coherenceSlug?.trim());
  const hasSignalTeamPolicy = isSignalThread && signalTeamMemberIds.length > 0;
  const signalTeamMemberIdSet = useMemo(
    () => new Set(signalTeamMemberIds),
    [signalTeamMemberIds],
  );
  const isCurrentUserSignalTeamMember = Boolean(
    currentUserId && signalTeamMemberIdSet.has(currentUserId),
  );
  const canInteractWithSignalThread =
    !isSignalThread || !hasSignalTeamPolicy || isCurrentUserSignalTeamMember;
  const canJoinSignalThreadCall =
    !isSignalThread || !hasSignalTeamPolicy || isCurrentUserSignalTeamMember;

  const mentionCandidates = useMemo((): ChatMentionCandidate[] => {
    if (!isSignalThread) return rawMentionCandidates;
    return rawMentionCandidates.filter((candidate) =>
      signalTeamMemberIdSet.has(candidate.userId),
    );
  }, [isSignalThread, rawMentionCandidates, signalTeamMemberIdSet]);

  const mentionLabelByUserId = useMemo(
    () =>
      new Map(
        mentionCandidates.map((candidate) => {
          const o = mentionDisplayOverride[candidate.userId];
          return [
            candidate.userId,
            o?.trim() ? o : resolveMemberLabel(candidate.userId),
          ] as const;
        }),
      ),
    [mentionCandidates, mentionDisplayOverride, resolveMemberLabel],
  );

  const duplicateSanitizedDisplayKeys = useMemo(
    () => computeDuplicateSanitizedDisplayKeys(mentionLabelByUserId),
    [mentionLabelByUserId],
  );

  /** Sanitized display label → MXID for converting composer `@Name` tokens before Matrix send. */
  const mentionSanitizedLabelToUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const [userId, label] of mentionLabelByUserId) {
      const key = disambiguatedMentionTokenKey(
        userId,
        label,
        duplicateSanitizedDisplayKeys,
      );
      if (!key) continue;
      m.set(key, userId);
    }
    return m;
  }, [mentionLabelByUserId, duplicateSanitizedDisplayKeys]);

  const getMentionComposerLabel = useCallback(
    (member: ChatMentionCandidate, resolvedComposerLabel?: string) => {
      const label =
        resolvedComposerLabel?.trim() ||
        mentionLabelByUserId.get(member.userId)?.trim() ||
        member.displayLabel;
      /** Include this pick's effective label when counting duplicates (resolved name can collide). */
      const effectiveLabels = new Map(mentionLabelByUserId);
      effectiveLabels.set(member.userId, label);
      const dupForPick = computeDuplicateSanitizedDisplayKeys(effectiveLabels);
      return (
        disambiguatedMentionTokenKey(member.userId, label, dupForPick) || label
      );
    },
    [mentionLabelByUserId],
  );

  const resolveMentionMemberLabel = useCallback(
    (userId: string | undefined) => {
      const id = userId?.trim();
      if (!id) return t('unknownMember');
      const mentionLabel = mentionLabelByUserId.get(id)?.trim();
      const resolved = resolveMemberLabel(id);
      if (
        mentionLabel &&
        !looksLikeTechnicalMatrixDisplayName(mentionLabel, id)
      ) {
        return mentionLabel;
      }
      if (!looksLikeTechnicalMatrixDisplayName(resolved, id)) {
        return resolved;
      }
      return mentionLabel || resolved;
    },
    [mentionLabelByUserId, resolveMemberLabel, t],
  );

  /** Same roster merge as pills — timeline sender/reply headers use this first. */
  const resolveSenderDisplayLabel = useCallback(
    (matrixUserId: string | undefined) => {
      const id = matrixUserId?.trim();
      if (!id) return t('unknownMember');
      return resolveMentionMemberLabel(id);
    },
    [resolveMentionMemberLabel, t],
  );

  /** `@` when there is anyone to mention (joined members and/or roster-linked MXIDs). */
  const mentionPickerEnabled =
    canInteractWithSignalThread && mentionCandidates.length > 0;
  const signalTeamSelectableMembers = useMemo((): ChatMentionCandidate[] => {
    const byUserId = new Map<string, ChatMentionCandidate>();
    for (const member of rawMentionCandidates) {
      byUserId.set(member.userId, member);
    }
    if (currentUserId) {
      const currentUserLabel =
        [me?.name, me?.surname].filter(Boolean).join(' ').trim() ||
        me?.nickname?.trim() ||
        t('you');
      if (!byUserId.has(currentUserId)) {
        byUserId.set(currentUserId, {
          userId: currentUserId,
          displayLabel: currentUserLabel,
          avatarUrl: me?.avatarUrl,
        });
      }
    }
    return [...byUserId.values()].sort((a, b) =>
      resolveMentionMemberLabel(a.userId).localeCompare(
        resolveMentionMemberLabel(b.userId),
        undefined,
        {
          sensitivity: 'base',
        },
      ),
    );
  }, [
    rawMentionCandidates,
    currentUserId,
    me?.name,
    me?.surname,
    me?.nickname,
    me?.avatarUrl,
    resolveMentionMemberLabel,
    t,
  ]);
  const effectiveSignalTeamMemberIds = useMemo(
    () =>
      isSignalThread
        ? signalTeamMemberIds
        : signalTeamSelectableMembers.map((member) => member.userId),
    [isSignalThread, signalTeamMemberIds, signalTeamSelectableMembers],
  );
  const signalTeamEditorMemberIds = useMemo(
    () =>
      signalTeamDraftMemberIds != null
        ? signalTeamDraftMemberIds
        : effectiveSignalTeamMemberIds,
    [signalTeamDraftMemberIds, effectiveSignalTeamMemberIds],
  );
  const canManageSignalTeam =
    isSignalThread && (!hasSignalTeamPolicy || isCurrentUserSignalTeamMember);
  const currentUserPendingSignalTeamRequest = Boolean(
    currentUserId && signalTeamPendingRequesterIds.includes(currentUserId),
  );

  const publishSignalTeamMembers = useCallback(
    async (
      nextMemberIds: string[],
      options?: {
        addedMemberMatrixUserIds?: string[];
        removedMemberMatrixUserIds?: string[];
      },
    ) => {
      if (!client || !roomId || !isSignalThread) return;
      try {
        const ownerId =
          signalTeamOwnerId?.trim() || currentUserId?.trim() || null;
        const actorId = currentUserId?.trim() || null;
        const deduped = normalizeMatrixUserIds([
          ...nextMemberIds,
          ...(ownerId ? [ownerId] : []),
          ...(actorId ? [actorId] : []),
        ]);
        const added = normalizeMatrixUserIds(options?.addedMemberMatrixUserIds);
        const removed = normalizeMatrixUserIds(
          options?.removedMemberMatrixUserIds,
        );
        const addedLabels = added.map((id) => resolveMentionMemberLabel(id));
        const removedLabels = removed.map((id) =>
          resolveMentionMemberLabel(id),
        );
        const summaryParts: string[] = [];
        if (addedLabels.length > 0) {
          summaryParts.push(`added ${addedLabels.join(', ')}`);
        }
        if (removedLabels.length > 0) {
          summaryParts.push(`removed ${removedLabels.join(', ')}`);
        }
        const summaryText =
          summaryParts.length > 0 ? `: ${summaryParts.join('; ')}` : '';
        await client.sendEvent(roomId, EventType.RoomMessage, {
          msgtype: MsgType.Notice,
          body: `${SIGNAL_TEAM_EVENT_BODY_MARKER} signal team updated${summaryText}`,
          coherenceSlug: coherenceSlug?.trim() || null,
          memberMatrixUserIds: deduped,
          ownerMatrixUserId: ownerId,
          addedMemberMatrixUserIds: added,
          removedMemberMatrixUserIds: removed,
          updatedAt: new Date().toISOString(),
        } as SignalTeamEventContent);
        setSignalTeamMemberIds(deduped);
        if (ownerId && !signalTeamOwnerId) {
          setSignalTeamOwnerId(ownerId);
        }
        setSignalTeamPendingRequesterIds((prev) =>
          prev.filter((id) => !deduped.includes(id)),
        );
      } catch (error) {
        console.error(
          '[HumanRightPanel] publishSignalTeamMembers failed',
          error,
        );
        setComposerError(t('sendFailed'));
      }
    },
    [
      client,
      roomId,
      isSignalThread,
      coherenceSlug,
      currentUserId,
      signalTeamOwnerId,
      resolveMentionMemberLabel,
      t,
    ],
  );

  const commitSignalTeamDraft = useCallback(async () => {
    if (!signalTeamPanelOpen) return;
    const draftIds = signalTeamDraftMemberIds;
    setSignalTeamPanelOpen(false);
    if (!draftIds) return;

    const currentIds = normalizeMatrixUserIds(effectiveSignalTeamMemberIds);
    const nextIds = normalizeMatrixUserIds(draftIds);
    const addedMemberMatrixUserIds = nextIds.filter(
      (id) => !currentIds.includes(id),
    );
    const removedMemberMatrixUserIds = currentIds.filter(
      (id) => !nextIds.includes(id),
    );
    setSignalTeamDraftMemberIds(null);
    if (
      addedMemberMatrixUserIds.length === 0 &&
      removedMemberMatrixUserIds.length === 0
    ) {
      return;
    }
    await publishSignalTeamMembers(nextIds, {
      addedMemberMatrixUserIds,
      removedMemberMatrixUserIds,
    });
  }, [
    signalTeamPanelOpen,
    signalTeamDraftMemberIds,
    effectiveSignalTeamMemberIds,
    publishSignalTeamMembers,
  ]);

  const requestSignalTeamAccess = useCallback(async () => {
    if (!client || !roomId || !isSignalThread || !currentUserId) return;
    setSignalTeamBusy(true);
    try {
      await client.sendEvent(roomId, EventType.RoomMessage, {
        msgtype: MsgType.Notice,
        body: `${SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER} signal team access requested`,
        coherenceSlug: coherenceSlug?.trim() || null,
        requesterMatrixUserId: currentUserId,
        status: 'pending',
        updatedAt: new Date().toISOString(),
      } as SignalTeamEventContent);
      setSignalTeamPendingRequesterIds((prev) =>
        prev.includes(currentUserId) ? prev : [...prev, currentUserId],
      );
    } catch (error) {
      console.error('[HumanRightPanel] requestSignalTeamAccess failed', error);
      setComposerError(t('sendFailed'));
    } finally {
      setSignalTeamBusy(false);
    }
  }, [client, roomId, isSignalThread, currentUserId, coherenceSlug, t]);

  const approveSignalTeamRequester = useCallback(
    async (requesterMatrixUserId: string) => {
      if (!client || !roomId || !isSignalThread) return;
      const requesterId = requesterMatrixUserId.trim();
      if (!requesterId) return;
      setSignalTeamBusy(true);
      try {
        const ownerId =
          signalTeamOwnerId?.trim() || currentUserId?.trim() || null;
        const actorId = currentUserId?.trim() || null;
        const nextMembers = normalizeMatrixUserIds([
          ...effectiveSignalTeamMemberIds,
          requesterId,
          ...(ownerId ? [ownerId] : []),
          ...(actorId ? [actorId] : []),
        ]);
        await Promise.all([
          client.sendEvent(roomId, EventType.RoomMessage, {
            msgtype: MsgType.Notice,
            body: `${SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER} signal team access approved`,
            coherenceSlug: coherenceSlug?.trim() || null,
            requesterMatrixUserId: requesterId,
            status: 'approved',
            updatedAt: new Date().toISOString(),
          } as SignalTeamEventContent),
          client.sendEvent(roomId, EventType.RoomMessage, {
            msgtype: MsgType.Notice,
            body: `${SIGNAL_TEAM_EVENT_BODY_MARKER} signal team members updated`,
            coherenceSlug: coherenceSlug?.trim() || null,
            memberMatrixUserIds: nextMembers,
            ownerMatrixUserId: ownerId,
            updatedAt: new Date().toISOString(),
          } as SignalTeamEventContent),
        ]);
        setSignalTeamMemberIds(nextMembers);
        setSignalTeamPendingRequesterIds((prev) =>
          prev.filter((id) => id !== requesterId),
        );
      } catch (error) {
        console.error(
          '[HumanRightPanel] approveSignalTeamRequester failed',
          error,
        );
        setComposerError(t('sendFailed'));
      } finally {
        setSignalTeamBusy(false);
      }
    },
    [
      client,
      roomId,
      isSignalThread,
      coherenceSlug,
      effectiveSignalTeamMemberIds,
      currentUserId,
      signalTeamOwnerId,
      t,
    ],
  );

  useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    const parentRoomId =
      mode === 'coherence' ? space?.chatRoomId?.trim() : undefined;

    const bumpMembership = (...args: unknown[]) => {
      const state = args[1] as { roomId?: string } | undefined;
      const changedRoomId = state?.roomId?.trim();
      if (!changedRoomId) return;
      if (changedRoomId !== roomId && changedRoomId !== parentRoomId) return;
      setMentionMembershipEpoch((n) => n + 1);
    };

    client.on(RoomStateEvent.Members, bumpMembership);
    client.on(RoomStateEvent.NewMember, bumpMembership);

    return () => {
      client.off(RoomStateEvent.Members, bumpMembership);
      client.off(RoomStateEvent.NewMember, bumpMembership);
    };
  }, [client, mode, roomId, space?.chatRoomId]);

  const resolveMemberLabelRef = useRef(resolveMemberLabel);
  resolveMemberLabelRef.current = resolveMemberLabel;

  useEffect(() => {
    if (!roomId || !client) return;
    setMessages((prev) => {
      const next = prev.map((m) => {
        const sid = m.senderMatrixId?.trim();
        const isSelfRow = Boolean(
          currentUserIdRef.current && sid && sid === currentUserIdRef.current,
        );

        /**
         * On cold load, `client.getUserId()` can be null when we first map
         * Matrix events to UI — own messages are misclassified as `member` and
         * get a technical Matrix/Privy display label. Re-sync when Matrix id arrives.
         */
        let nextRole = m.role;
        let newSenderName = m.senderName;
        let nextMemberAvatar = m.avatarUrl;
        if (isSelfRow) {
          nextRole = 'user';
          newSenderName = undefined;
          nextMemberAvatar = currentUserAvatarUrlRef.current ?? m.avatarUrl;
        } else if (m.role === 'member' && sid) {
          newSenderName = resolveMemberLabelRef.current(sid);
          nextMemberAvatar =
            matrixMemberAvatarSquare(
              matrixClientRef.current,
              roomIdRef.current,
              sid,
              96,
            ) ?? m.avatarUrl;
        }

        const newAuthorLabel =
          m.replyTo?.sourceUserId != null
            ? resolveMemberLabelRef.current(m.replyTo.sourceUserId)
            : m.replyTo?.authorLabel;

        const nextReply =
          m.replyTo?.sourceUserId != null
            ? {
                ...m.replyTo,
                authorLabel: newAuthorLabel ?? m.replyTo.authorLabel,
                authorAvatarUrl:
                  currentUserIdRef.current &&
                  m.replyTo.sourceUserId === currentUserIdRef.current &&
                  currentUserAvatarUrlRef.current
                    ? currentUserAvatarUrlRef.current
                    : matrixMemberAvatarSquare(
                        matrixClientRef.current,
                        roomIdRef.current,
                        m.replyTo.sourceUserId,
                        64,
                      ) ?? m.replyTo.authorAvatarUrl,
              }
            : m.replyTo;

        if (
          nextRole === m.role &&
          newSenderName === m.senderName &&
          nextReply?.authorLabel === m.replyTo?.authorLabel &&
          nextReply?.authorAvatarUrl === m.replyTo?.authorAvatarUrl &&
          nextMemberAvatar === m.avatarUrl
        ) {
          return m;
        }

        return {
          ...m,
          role: nextRole,
          senderName: newSenderName,
          avatarUrl: nextMemberAvatar,
          replyTo: nextReply,
        };
      });
      // Return the same array reference when nothing changed to avoid a re-render
      return next.every((m, i) => m === prev[i]) ? prev : next;
    });
  }, [
    roomId,
    client,
    currentUserId,
    currentUserAvatarUrl,
    matrixUserIdToPersonLabel,
    me?.name,
    me?.surname,
    t,
  ]);

  // Backfill avatar on self-authored messages after useMe() resolves
  useEffect(() => {
    if (!currentUserAvatarUrl) return;
    setMessages((prev) =>
      prev.map((uiMessage) =>
        uiMessage.role === 'user' && !uiMessage.avatarUrl
          ? { ...uiMessage, avatarUrl: currentUserAvatarUrl }
          : uiMessage,
      ),
    );
  }, [currentUserAvatarUrl]);

  // Track previous sidebar open state to detect close events
  const prevSidebarOpenRef = useRef(sidebarOpen);
  const hasLoadedCoherenceMessagesRef = useRef(false);
  useEffect(() => {
    if (prevSidebarOpenRef.current && !sidebarOpen && mode === 'coherence') {
      closeCoherenceChat();
    }
    prevSidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen, mode, closeCoherenceChat]);

  useEffect(() => {
    hasLoadedCoherenceMessagesRef.current = false;
  }, [coherenceSlug, mode]);

  // Reset chat state when space changes
  useEffect(() => {
    if (joinedRef.current && joinedRef.current !== spaceSlug) {
      if (roomId) {
        matrixRef.current.unregisterRoomListener(roomId);
      }
      joinedRef.current = null;
      setRoomId(null);
      setMessages([]);
      setInput('');
      disposeDraftAttachmentUrls(draftAttachmentsRef.current);
      setDraftAttachments([]);
      setReplyDraft(null);
      setEditDraft(null);
      setError(null);
      setSendingPending(null);
    }
  }, [spaceSlug, roomId]);

  useEffect(() => {
    if (mode !== 'space') return;
    if (isUserSpaceStateLoading) return;
    if (hasSpaceActivityAccess) return;
    if (roomId) {
      matrixRef.current.unregisterRoomListener(roomId);
    }
    joinedRef.current = null;
    setRoomId(null);
    setMessages([]);
    setReplyDraft(null);
    setEditDraft(null);
    setInput('');
    setError(null);
  }, [mode, roomId, hasSpaceActivityAccess, isUserSpaceStateLoading]);

  // Join space room when Matrix is ready (space mode)
  useEffect(() => {
    if (mode !== 'space') return;
    if (
      !isMatrixAvailable ||
      !isMatrixAuthenticated ||
      joinedRef.current === spaceSlug
    )
      return;
    if (!spaceSlug) return;
    if (isSpaceLoading) return;
    if (isUserSpaceStateLoading) return;
    if (!hasSpaceActivityAccess) return;

    let cancelled = false;
    const { joinRoom, createRoom, getRoomMessages, loadRoomHistory, client } =
      matrixRef.current;

    const initRoom = async () => {
      setIsJoining(true);
      setError(null);
      try {
        const canonicalRoomId = space?.chatRoomId?.trim() || null;
        const storedRoomId = getStoredRoomId(spaceSlug);

        if (
          canonicalRoomId &&
          storedRoomId &&
          canonicalRoomId !== storedRoomId
        ) {
          clearStoredRoomId(spaceSlug);
        }

        let targetRoomId: string | null = canonicalRoomId || storedRoomId;

        const ensureJoined = async (roomIdOrAlias: string) => {
          const canonicalId = await joinRoom(roomIdOrAlias);
          const room = client?.getRoom(canonicalId);
          if (!room) {
            throw new Error('Room not available in Matrix client after join');
          }
          return canonicalId;
        };

        if (targetRoomId) {
          try {
            targetRoomId = await ensureJoined(targetRoomId);
            storeRoomId(spaceSlug, targetRoomId);
          } catch (joinErr) {
            if (canonicalRoomId && targetRoomId === canonicalRoomId) {
              throw joinErr;
            }
            clearStoredRoomId(spaceSlug);
            targetRoomId = null;
          }
        }

        if (!targetRoomId) {
          if (canonicalRoomId) {
            throw new Error('Failed to join canonical space chat room');
          }
          const { roomId: newRoomId } = await createRoom(`space-${spaceSlug}`);
          if (!newRoomId) {
            throw new Error('Failed to create room: empty roomId returned');
          }
          targetRoomId = newRoomId;
          storeRoomId(spaceSlug, newRoomId);
          if (authTokenRef.current) {
            try {
              await updateSpaceBySlugRef.current({
                slug: spaceSlug,
                chatRoomId: newRoomId,
              });
            } catch (persistErr) {
              console.warn(
                '[HumanRightPanel] Failed to persist chat room id on space:',
                persistErr,
              );
            }
          }
        }

        if (cancelled) return;
        joinedRef.current = spaceSlug;
        setRoomId(targetRoomId);

        await loadRoomHistory(targetRoomId);
        if (cancelled) return;
        const existing = getRoomMessages(targetRoomId);
        if (existing && !cancelled) {
          setMessages(
            existing.map((m) =>
              toUIMessage(
                m,
                currentUserIdRef.current,
                resolveMemberLabelRef.current,
                currentUserAvatarUrlRef.current,
                undefined,
                targetRoomId,
                matrixRef.current.client ?? null,
              ),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[HumanRightPanel] Failed to join room:', err);
          setError('Failed to join chat room');
        }
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    };

    initRoom();

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    isMatrixAvailable,
    isMatrixAuthenticated,
    spaceSlug,
    isSpaceLoading,
    isUserSpaceStateLoading,
    hasSpaceActivityAccess,
    space?.chatRoomId,
  ]);

  // Track previous mode to detect actual transitions (not initial mount)
  const prevModeRef = useRef(mode);
  useEffect(() => {
    const prevMode = prevModeRef.current;
    prevModeRef.current = mode;

    // Only act on actual mode transitions, not initial mount
    if (prevMode === mode) return;

    if (mode === 'coherence') {
      // Switching FROM space TO coherence — unregister space listener, clear state
      if (roomId) {
        matrixRef.current.unregisterRoomListener(roomId);
      }
      joinedRef.current = null; // allow space room to re-init when returning
      setMessages([]);
      setRoomId(null);
      setReplyDraft(null);
      setEditDraft(null);
      setInput('');
      setComposerError(null);
      disposeDraftAttachmentUrls(draftAttachmentsRef.current);
      setDraftAttachments([]);
      setError(null);
      setSendingPending(null);
    }

    if (mode === 'space' && prevMode === 'coherence') {
      // Switching FROM coherence TO space — clear state, space init will re-run
      if (roomId) {
        matrixRef.current.unregisterRoomListener(roomId);
      }
      setMessages([]);
      setRoomId(null);
      setReplyDraft(null);
      setEditDraft(null);
      setInput('');
      setComposerError(null);
      disposeDraftAttachmentUrls(draftAttachmentsRef.current);
      setDraftAttachments([]);
      setError(null);
      setSendingPending(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Join (or create) coherence room when mode switches to 'coherence'
  useEffect(() => {
    if (mode !== 'coherence' || !isMatrixAvailable || !isMatrixAuthenticated)
      return;

    let cancelled = false;

    const init = async () => {
      setIsJoining(true);
      setError(null);
      setMessages([]);
      setReplyDraft(null);
      setEditDraft(null);
      setInput('');
      setComposerError(null);
      disposeDraftAttachmentUrls(draftAttachmentsRef.current);
      setDraftAttachments([]);
      setSendingPending(null);
      try {
        let targetRoomId = coherenceRoomId;

        // If no room exists yet, only create one when we can link it back
        if (!targetRoomId) {
          if (!coherenceSlug) {
            // Cannot persist without a slug — skip room creation
            setIsJoining(false);
            return;
          }
          console.log(
            '[HumanRightPanel] Creating Matrix room for coherence:',
            coherenceSlug,
          );
          const { roomId: newRoomId } = await matrixRef.current.createRoom(
            coherenceTitle || 'Conversation',
          );
          if (cancelled) return;
          targetRoomId = newRoomId;

          try {
            await updateCoherenceBySlug({
              slug: coherenceSlug,
              roomId: newRoomId,
            });
            // Update context so subsequent opens don't re-create
            openCoherenceChat(newRoomId, coherenceTitle || '', coherenceSlug);
          } catch (err) {
            console.warn(
              '[HumanRightPanel] Failed to persist roomId to coherence:',
              err,
            );
          }
        } else {
          targetRoomId = await matrixRef.current.joinRoom(targetRoomId);
        }

        if (cancelled) return;
        setRoomId(targetRoomId);
        await matrixRef.current.loadRoomHistory(targetRoomId);
        if (cancelled) return;
        const existing = matrixRef.current.getRoomMessages(targetRoomId);
        if (existing) {
          setMessages(
            existing.map((m) =>
              toUIMessage(
                m,
                currentUserIdRef.current,
                resolveMemberLabelRef.current,
                currentUserAvatarUrlRef.current,
                undefined,
                targetRoomId,
                matrixRef.current.client ?? null,
              ),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            '[HumanRightPanel] Failed to join coherence room:',
            err,
          );
          setError(t('failedToJoinRoom'));
        }
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    coherenceRoomId,
    coherenceTitle,
    coherenceSlug,
    isMatrixAvailable,
    isMatrixAuthenticated,
  ]);

  // Register listener for incoming messages
  useEffect(() => {
    if (!roomId || !isMatrixAvailable) return;

    const scheduleTimelineFlush = () => {
      if (timelineFlushRafRef.current != null) return;
      timelineFlushRafRef.current = requestAnimationFrame(() => {
        timelineFlushRafRef.current = null;

        const redacts = pendingTimelineRedactIdsRef.current;
        pendingTimelineRedactIdsRef.current = new Set();
        const upserts = pendingTimelineMessagesRef.current;
        pendingTimelineMessagesRef.current = new Map();

        if (redacts.size === 0 && upserts.size === 0) return;

        setMessages((prev) => {
          let next = prev;
          if (redacts.size > 0) {
            next = next.filter((m) => !redacts.has(m.id));
          }
          for (const message of upserts.values()) {
            const ui = toUIMessage(
              message,
              currentUserIdRef.current,
              resolveMemberLabelRef.current,
              currentUserAvatarUrlRef.current,
              undefined,
              roomId,
              matrixRef.current.client ?? null,
            );
            const idx = next.findIndex((m) => m.id === ui.id);
            if (idx === -1) {
              next = [...next, ui];
            } else {
              next = next.map((m, i) => (i === idx ? ui : m));
            }
          }
          return next;
        });

        for (const message of upserts.values()) {
          if (
            message.sender === currentUserIdRef.current &&
            message.id &&
            !String(message.id).startsWith('hypha-send-pending')
          ) {
            setSendingPending(null);
            break;
          }
        }

        const rId = replyDraftRef.current?.messageId;
        if (rId && redacts.has(rId)) {
          setReplyDraft(null);
        }
        const eId = editDraftRef.current?.messageId;
        if (eId && redacts.has(eId)) {
          disposeDraftAttachmentUrls(draftAttachmentsRef.current);
          setDraftAttachments([]);
          setInput('');
          setEditDraft(null);
        }
      });
    };

    const { registerRoomListener, unregisterRoomListener } = matrixRef.current;

    registerRoomListener(
      roomId,
      async (message: Message) => {
        if (message.redacted) {
          pendingTimelineRedactIdsRef.current.add(message.id);
          scheduleTimelineFlush();
          return;
        }
        pendingTimelineMessagesRef.current.set(message.id, message);
        scheduleTimelineFlush();
      },
      async (_pinned: string[]) => {
        // pinned messages not used in human chat panel
      },
    );

    return () => {
      if (timelineFlushRafRef.current != null) {
        cancelAnimationFrame(timelineFlushRafRef.current);
        timelineFlushRafRef.current = null;
      }
      pendingTimelineRedactIdsRef.current = new Set();
      pendingTimelineMessagesRef.current = new Map();
      unregisterRoomListener(roomId);
    };
  }, [roomId, isMatrixAvailable]);

  useEffect(() => {
    if (!roomId) return;
    const cached = readPersistedChatHistory(roomId);
    if (cached.length === 0) return;
    setMessages((prev) => (prev.length > 0 ? prev : cached));
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    writePersistedChatHistory(roomId, messages);
  }, [roomId, messages]);

  useEffect(() => {
    if (mode !== 'coherence') return;
    if (!isMatrixAvailable || !coherenceSlug || !roomId || isJoining) return;
    // Avoid clobbering persisted counts with transient empty timeline snapshots.
    if (!hasLoadedCoherenceMessagesRef.current && messages.length === 0) return;
    hasLoadedCoherenceMessagesRef.current = true;
    updateCoherenceBySlugRef
      .current({
        slug: coherenceSlug,
        messages: messages.length,
      })
      .catch((error) => {
        console.warn(
          '[HumanRightPanel] Failed to persist coherence message count:',
          error,
        );
      });
  }, [
    mode,
    isMatrixAvailable,
    coherenceSlug,
    roomId,
    isJoining,
    messages.length,
  ]);

  // Keep message ids in sync when the SDK replaces provisional ~… ids with $… after send
  useEffect(() => {
    if (!roomId || !client) return;

    const room = client.getRoom(roomId);
    if (!room) return;

    const onLocalEchoUpdated = (
      ev: MatrixEvent,
      _r: Room,
      oldEventId?: string,
    ) => {
      if (!oldEventId) return;
      const newId = ev.getId();
      if (!newId || oldEventId === newId) return;

      setMessages((prev) =>
        prev.map((m) => (m.id === oldEventId ? { ...m, id: newId } : m)),
      );
      setReplyDraft((draft) =>
        draft?.messageId === oldEventId
          ? { ...draft, messageId: newId }
          : draft,
      );
      setEditDraft((draft) =>
        draft?.messageId === oldEventId
          ? { ...draft, messageId: newId }
          : draft,
      );
    };

    room.on(RoomEvent.LocalEchoUpdated, onLocalEchoUpdated);
    return () => {
      room.off(RoomEvent.LocalEchoUpdated, onLocalEchoUpdated);
    };
  }, [roomId, client]);

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!roomId) return;
      setReactionError(null);
      try {
        await matrixRef.current.toggleReaction({
          roomId,
          targetEventId: messageId,
          key: emoji,
        });
      } catch (err) {
        console.error('[HumanRightPanel] Failed to toggle reaction:', err);
        setReactionError(t('reactionToggleFailed'));
      }
    },
    [roomId, t],
  );

  const notificationCentreHref = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return '/notification-centre';
    const lang = getLocaleFromPath(pathname);

    /** Match `ConnectedButtonProfile` / aside routes under `apps/web/src/app/[lang]/…/@aside/`. */
    if (pathname.includes('/network')) {
      return `/${lang}/network/notification-centre`;
    }
    if (pathname.includes('/my-spaces')) {
      return `/${lang}/my-spaces/notification-centre`;
    }
    if (pathname.includes('/dho/')) {
      const dhoId = spaceSlug ?? params?.id ?? parts[2];
      if (!dhoId) return `/${lang}/notification-centre`;
      const activeTab = getActiveTabFromPath(pathname);
      return `/${lang}/dho/${dhoId}/${activeTab}/notification-centre`;
    }
    if (parts[1] === 'profile' && parts.length >= 3) {
      return `/${lang}/profile/${parts[2]}/notification-centre`;
    }
    if (parts.length >= 2) {
      return `/${lang}/${parts[1]}/notification-centre`;
    }
    return `/${lang}/notification-centre`;
  }, [pathname, params?.id, spaceSlug]);

  const handleSelectMentionFromInbox = useCallback(
    (eventId: string, fromRoomId?: string) => {
      setMentionNavigationNotice(null);
      const targetRoom = fromRoomId?.trim();
      const current = roomId?.trim();
      const langMatch = pathname.match(/^\/([^/]+)\//);
      const lang = langMatch?.[1] ?? 'en';
      const spaceChatRoomId = space?.chatRoomId?.trim() ?? null;
      const pathSlug = getDhoSpaceSlugFromPathname(pathname)?.trim() ?? null;

      if (
        targetRoom &&
        spaceChatRoomId &&
        targetRoom === spaceChatRoomId &&
        spaceSlug &&
        pathSlug === spaceSlug
      ) {
        if (mode === 'coherence') {
          closeCoherenceChat();
        }
        openHumanChatPanel();
        setActiveTab('chat');
        setScrollToEventId(eventId);
        return;
      }

      if (
        targetRoom &&
        targetRoom !== current &&
        typeof window !== 'undefined'
      ) {
        let slug =
          window.sessionStorage
            .getItem(`${SESSION_ROOM_TO_SPACE_PREFIX}${targetRoom}`)
            ?.trim() ?? null;
        if (!slug) {
          const fromLs = readRoomIdToSpaceSlugFromStorage().get(targetRoom);
          slug = fromLs ?? null;
        }
        if (!slug && spaceChatRoomId === targetRoom && spaceSlug) {
          slug = spaceSlug;
        }
        if (slug) {
          router.push(
            `/${lang}/dho/${slug}?msg=${encodeURIComponent(eventId)}`,
          );
          openHumanChatPanel();
          setActiveTab('chat');
          return;
        }

        const coherence = readRoomToCoherenceSession(targetRoom);
        if (coherence.slug) {
          openCoherenceChat(
            targetRoom,
            coherence.title || 'Conversation',
            coherence.slug,
          );
          openHumanChatPanel();
          setActiveTab('chat');
          setScrollToEventId(eventId);
          return;
        }
        setMentionNavigationNotice(t('mentionOpenFallbackRoom'));
      }

      setActiveTab('chat');
      setScrollToEventId(eventId);
    },
    [
      roomId,
      pathname,
      router,
      openCoherenceChat,
      openHumanChatPanel,
      closeCoherenceChat,
      mode,
      space?.chatRoomId,
      spaceSlug,
      t,
    ],
  );

  const handleConsumedScrollTarget = useCallback(() => {
    setScrollToEventId(null);
  }, []);

  const handleScrollTargetNotFound = useCallback(
    (_eventId: string) => {
      setMentionNavigationNotice(t('mentionOpenFallbackMissingMessage'));
      setScrollToEventId(null);
    },
    [t],
  );

  const mergedMessages = useMemo(() => {
    if (!sendingPending) return messages;
    const pendingRow: UIMessage = {
      id: sendingPending.id,
      role: 'user',
      isSynthetic: true,
      parts: [],
      sendPending: {
        attachmentCount: sendingPending.attachmentCount,
        captionPreview: sendingPending.captionPreview,
        uploadedCount: sendingPending.uploadedCount,
      },
      avatarUrl: currentUserAvatarUrl,
    };
    return [...messages, pendingRow];
  }, [messages, sendingPending, currentUserAvatarUrl]);

  useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    /** Timeline fires very often during sync — debounce unread recompute to avoid main-thread thrash. */
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const UNREAD_RECOMPUTE_MS = 400;
    const bumpUnread = () => {
      if (debounce != null) return;
      debounce = setTimeout(() => {
        debounce = null;
        setUnreadBump((n) => n + 1);
      }, UNREAD_RECOMPUTE_MS);
    };

    room.on(RoomEvent.Receipt, bumpUnread);
    room.on(RoomEvent.AccountData, bumpUnread);
    room.on(RoomEvent.UnreadNotifications, bumpUnread);
    room.on(RoomEvent.Timeline, bumpUnread);

    return () => {
      if (debounce != null) clearTimeout(debounce);
      room.off(RoomEvent.Receipt, bumpUnread);
      room.off(RoomEvent.AccountData, bumpUnread);
      room.off(RoomEvent.UnreadNotifications, bumpUnread);
      room.off(RoomEvent.Timeline, bumpUnread);
    };
  }, [client, roomId]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      mode !== 'space' ||
      !spaceSlug?.trim() ||
      !roomId?.trim()
    )
      return;
    rememberRoomToSpaceSlugSession(roomId, spaceSlug.trim());
  }, [mode, spaceSlug, roomId]);

  useEffect(() => {
    const pathSlug = getDhoSpaceSlugFromPathname(pathname)?.trim();
    const rid = roomId?.trim() ?? null;
    if (pathSlug && rid && mode === 'space' && typeof window !== 'undefined') {
      rememberRoomToSpaceSlugSession(rid, pathSlug);
    }
  }, [pathname, roomId, mode]);

  useEffect(() => {
    const rid = roomId?.trim() ?? null;
    const slug = coherenceSlug?.trim() ?? null;
    if (
      !rid ||
      !slug ||
      mode !== 'coherence' ||
      typeof window === 'undefined'
    ) {
      return;
    }
    rememberRoomToCoherenceSession(rid, slug, coherenceTitle);
  }, [roomId, coherenceSlug, coherenceTitle, mode]);

  /**
   * Global mention badge: avoid listening to `ClientEvent.Room` — it fires on almost every
   * room/timeline update and was calling `computeAggregateUnreadMentionCount` (full timeline
   * scan per joined room) hundreds of times per second, freezing the UI and flooding DevTools.
   * Incremental sync covers new @-mentions across rooms; current-room bumps still flow via
   * `unreadBump` from timeline/receipt listeners.
   */
  useEffect(() => {
    if (!client || !currentUserId) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const SCHEDULE_MS = 500;
    const scheduleBump = () => {
      if (debounce != null) return;
      debounce = setTimeout(() => {
        debounce = null;
        setAggregateMentionBump((n) => n + 1);
      }, SCHEDULE_MS);
    };
    client.on(ClientEvent.Sync, scheduleBump);
    return () => {
      if (debounce != null) clearTimeout(debounce);
      client.removeListener(ClientEvent.Sync, scheduleBump);
    };
  }, [client, currentUserId]);

  const unreadChatState = useMemo(() => {
    if (!client || !roomId || !currentUserId) {
      return {
        firstUnreadMessageId: null as string | null,
        unreadNotificationCount: 0,
        unreadCountIsCapped: false,
        unreadMentionCount: 0,
        mentionCountIsCapped: false,
      };
    }
    const room = client.getRoom(roomId);
    /** `mergedMessages.length` omitted — it changed on every timeline row and re-ran a full timeline scan per sync batch. */
    return computeHumanChatUnreadState(room ?? undefined, currentUserId);
  }, [client, roomId, currentUserId, unreadBump]);

  /** `unreadBump` intentionally omitted — it was re-running the all-rooms scan on every timeline event. */
  const aggregateMentionBadge = useMemo(() => {
    if (!client || !currentUserId) {
      return { count: 0, capped: false };
    }
    return computeAggregateUnreadMentionCount(client.getRooms(), currentUserId);
  }, [client, currentUserId, aggregateMentionBump]);

  const bellMentionCount = aggregateMentionBadge.count;
  const bellMentionCapped = aggregateMentionBadge.capped;

  const markChatTimelineRead = useCallback(async () => {
    if (!client || !roomId || !currentUserId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const timeline = room.getLiveTimeline().getEvents();
    for (let i = timeline.length - 1; i >= 0; i--) {
      const ev = timeline[i];
      if (!ev) continue;
      if (ev.getType() !== EventType.RoomMessage) continue;
      const id = ev.getId();
      if (!id || !ev.getSender()) continue;
      if (isRedactedRoomMessageEvent(ev)) continue;
      if (getMessageReplaceTargetEventId(ev) != null) continue;
      try {
        await markRoomRead(roomId, id);
      } catch {
        // ignore
      }
      return;
    }
  }, [client, roomId, currentUserId, markRoomRead]);

  const handleReachedTimelineBottom = useCallback(() => {
    if (!unreadChatState.firstUnreadMessageId) return;
    const now = Date.now();
    if (now - lastAutoMarkReadAtRef.current < 800) return;
    lastAutoMarkReadAtRef.current = now;
    void markChatTimelineRead();
  }, [markChatTimelineRead, unreadChatState.firstUnreadMessageId]);

  const handleMarkAsReadFromBanner = useCallback(() => {
    void markChatTimelineRead();
  }, [markChatTimelineRead]);

  useEffect(() => {
    if (mode !== 'space') return;
    const qpChat = searchParams?.get('chat')?.trim();
    const qpMsg = searchParams?.get('msg')?.trim();
    if (!qpMsg || !roomId) return;
    /** Short link: `?msg=` only (same space room). Legacy: `?chat=` + `msg`. */
    const sameRoom = (!qpChat && roomId) || (qpChat && qpChat === roomId);
    if (!sameRoom) return;

    openHumanChatPanel();
    setActiveTab('chat');

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120;
    let found = false;

    const stripChatQueryFromUrl = () => {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('chat');
      next.delete('msg');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    const highlightRow = (el: HTMLElement) => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add(
        'ring-2',
        'ring-primary',
        'rounded-sm',
        'transition-shadow',
      );
      window.setTimeout(() => {
        el.classList.remove(
          'ring-2',
          'ring-primary',
          'rounded-sm',
          'transition-shadow',
        );
      }, 2400);
      stripChatQueryFromUrl();
    };

    const tryLocate = () => {
      if (cancelled || found) return;
      attempts += 1;
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(qpMsg)
          : qpMsg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const el = document.querySelector(
        `[data-matrix-event-id="${escaped}"]`,
      ) as HTMLElement | null;

      if (el) {
        found = true;
        highlightRow(el);
        return;
      }

      if (attempts < maxAttempts) {
        window.requestAnimationFrame(tryLocate);
      }
    };

    window.requestAnimationFrame(tryLocate);

    return () => {
      cancelled = true;
    };
  }, [mode, roomId, pathname, router, searchParams, openHumanChatPanel]);

  /**
   * When `?msg=` is present, retry locating the row after the timeline grows (initial effect may run
   * before messages arrive). One rAF per `messages.length` change — not merged list length tricks.
   */
  const deepLinkEventId =
    mode === 'space' ? searchParams?.get('msg')?.trim() : undefined;
  useEffect(() => {
    if (!deepLinkEventId || !roomId) return;
    const qpChat = searchParams?.get('chat')?.trim();
    const sameRoom =
      (!qpChat && Boolean(roomId)) || (qpChat && qpChat === roomId);
    if (!sameRoom) return;

    let cancelled = false;
    const tryOnce = () => {
      if (cancelled) return;
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(deepLinkEventId)
          : deepLinkEventId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const el = document.querySelector(
        `[data-matrix-event-id="${escaped}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add(
        'ring-2',
        'ring-primary',
        'rounded-sm',
        'transition-shadow',
      );
      window.setTimeout(() => {
        el.classList.remove(
          'ring-2',
          'ring-primary',
          'rounded-sm',
          'transition-shadow',
        );
      }, 2400);
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('chat');
      next.delete('msg');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    const id = requestAnimationFrame(tryOnce);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [
    deepLinkEventId,
    roomId,
    messages.length,
    mode,
    pathname,
    router,
    searchParams,
  ]);

  const handleReplyToMessage = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target) return;
      const authorLabel =
        target.role === 'user'
          ? t('you')
          : target.role === 'member' && target.senderMatrixId
          ? resolveMemberLabel(target.senderMatrixId)
          : target.senderName ?? t('unknownMember');
      const excerpt = firstLineForReplyPreview(getMessagePlainText(target));
      setEditDraft(null);
      setReplyDraft({
        messageId,
        authorLabel,
        excerpt,
        ...(target.role === 'user' ? { isYou: true } : {}),
        ...(target.role === 'member' && target.senderMatrixId
          ? { sourceUserId: target.senderMatrixId }
          : {}),
      });
    },
    [messages, resolveMemberLabel, t],
  );

  const handleEditMessage = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target || target.role !== 'user') return;
      const textParts =
        target.parts?.filter(
          (p): p is { type: 'text'; text: string } => p.type === 'text',
        ) ?? [];
      const plain = stripMatrixReplyFallback(
        textParts.map((p) => p.text).join(''),
      );
      setReplyDraft(null);
      disposeDraftAttachmentUrls(draftAttachmentsRef.current);
      setDraftAttachments([]);

      const hasMedia =
        Boolean(target.media?.mxcUrl) ||
        (Boolean(target.mediaSlots?.length) &&
          (target.mediaSlots?.length ?? 0) > 1);

      if (hasMedia && !client) {
        console.warn(
          '[HumanRightPanel] Cannot edit media message: Matrix client not available',
        );
        setComposerError(t('editMediaMatrixUnavailable'));
        return;
      }

      if (hasMedia && client) {
        const previewForMxc = (mxc: string) =>
          mxc.startsWith('mxc://')
            ? client.mxcUrlToHttp(mxc, 400, 300, 'scale', true, false, false) ??
              null
            : null;
        setDraftAttachments(
          buildEditMediaDraftAttachments(target, previewForMxc),
        );
        setEditDraft({
          messageId,
          excerpt: firstLineForReplyPreview(plain),
          editMediaMode: true,
        });
        setInput(plain);
        return;
      }

      setDraftAttachments([]);
      setEditDraft({
        messageId,
        excerpt: firstLineForReplyPreview(plain),
      });
      setInput(plain);
    },
    [messages, client, t],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!roomId) return;
      setDeleteError(null);
      try {
        await matrixRef.current.redactRoomEvent({ roomId, eventId: messageId });
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        if (editDraft?.messageId === messageId) {
          setEditDraft(null);
          setInput('');
        }
        if (replyDraft?.messageId === messageId) {
          setReplyDraft(null);
        }
      } catch (err) {
        console.error('[HumanRightPanel] Failed to delete message:', err);
        setDeleteError(t('messageDeleteFailed'));
      }
    },
    [roomId, editDraft?.messageId, replyDraft?.messageId, t],
  );

  const cancelSendInFlight = useCallback(() => {
    sendAbortControllerRef.current?.abort();
  }, []);

  const handleSend = useCallback(async () => {
    if (!roomId) return;
    if (!canInteractWithSignalThread) {
      setComposerError(t('signalTeamInteractionRestricted'));
      return;
    }
    const trimmed = input.trim();
    if (!trimmed && draftAttachments.length === 0) return;
    const text = input;
    const replyToEventId = replyDraft?.messageId;
    const editTargetEventId = editDraft?.messageId;
    const savedDraft = replyDraft;
    const savedEditDraft = editDraft;
    const savedAttachments = draftAttachments;
    sendAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    sendAbortControllerRef.current = abortController;
    const signal = abortController.signal;

    const sendToken = Symbol('send');
    sendOperationTokenRef.current = sendToken;
    setComposerError(null);
    setInput('');
    setDraftAttachments([]);
    const pendingId =
      savedAttachments.length > 0 ? `hypha-send-pending-${Date.now()}` : null;
    const { wirePlain, mentionUserIds } = wireComposerPlainForMatrixSend(
      text,
      mentionSanitizedLabelToUserId,
    );
    if (pendingId) {
      setSendingPending({
        id: pendingId,
        attachmentCount: savedAttachments.length,
        captionPreview: text,
        uploadedCount: 0,
      });
    }
    try {
      if (editTargetEventId) {
        if (savedEditDraft?.editMediaMode) {
          const slots = savedAttachments
            .map((a) => a.editSlot)
            .filter((s): s is NonNullable<ChatDraftAttachment['editSlot']> =>
              Boolean(s),
            );
          if (slots.length === 0) {
            throw new Error(t('editMediaRequiresAttachment'));
          }
          const newFiles = savedAttachments
            .filter((a) => !a.editSlot)
            .map((a) => ({
              file: a.file,
              kind: (a.kind === 'image'
                ? 'image'
                : a.kind === 'audio'
                ? 'audio'
                : 'file') as 'image' | 'audio' | 'file',
              spoiler: a.spoiler,
            }));
          await matrixRef.current.editRoomMessage({
            roomId,
            targetEventId: editTargetEventId,
            message: wirePlain,
            mentionUserIds,
            existingMediaSlots: slots,
            ...(newFiles.length > 0 ? { newAttachments: newFiles } : {}),
            ...(newFiles.length > 0 ? { signal } : {}),
          });
        } else {
          if (savedAttachments.length > 0) {
            throw new Error(t('editAttachmentsNotSupported'));
          }
          await matrixRef.current.editRoomMessage({
            roomId,
            targetEventId: editTargetEventId,
            message: wirePlain,
            mentionUserIds,
          });
        }
      } else {
        const sendResult = await matrixRef.current.sendMessage({
          roomId,
          message: wirePlain,
          mentionUserIds,
          signal,
          ...(replyToEventId ? { replyToEventId } : {}),
          ...(savedAttachments.length > 0
            ? {
                attachments: savedAttachments.map((a) => ({
                  file: a.file,
                  kind: (a.kind === 'image'
                    ? 'image'
                    : a.kind === 'audio'
                    ? 'audio'
                    : 'file') as 'image' | 'audio' | 'file',
                  spoiler: a.spoiler,
                })),
                onUploadProgress: ({ completed, total }) => {
                  setSendingPending((cur) =>
                    cur && cur.id === pendingId
                      ? {
                          ...cur,
                          attachmentCount: total,
                          uploadedCount: completed,
                        }
                      : cur,
                  );
                },
              }
            : {}),
        });
        const mentionTargets = mentionUserIds.filter((matrixId) => {
          if (matrixId === currentUserIdRef.current) return false;
          if (!hasSignalTeamPolicy) return true;
          return signalTeamMemberIdSet.has(matrixId);
        });
        if (
          mentionTargets.length > 0 &&
          sendResult.eventId &&
          mode === 'space'
        ) {
          const params = new URLSearchParams(
            searchParams?.toString() ?? undefined,
          );
          params.set('msg', sendResult.eventId);
          params.set('chat', roomId);
          const query = params.toString();
          const lang = getLocaleFromPath(pathname);
          const mappedSpaceSlug = roomId
            ? window.sessionStorage
                .getItem(`${SESSION_ROOM_TO_SPACE_PREFIX}${roomId}`)
                ?.trim() || readRoomIdToSpaceSlugFromStorage().get(roomId)
            : null;
          const canonicalSpaceSlug = spaceSlug?.trim() || mappedSpaceSlug;
          const canonicalPath = canonicalSpaceSlug
            ? `/${lang}/dho/${canonicalSpaceSlug}`
            : pathname;
          const deepLink =
            typeof window !== 'undefined'
              ? `${window.location.origin}${canonicalPath}${
                  query ? `?${query}` : ''
                }`
              : canonicalPath;
          const actorDisplayName =
            [me?.name, me?.surname].filter(Boolean).join(' ').trim() ||
            me?.nickname?.trim() ||
            t('you');
          void notifyChatMention({
            actorSlug: me?.slug,
            actorDisplayName,
            mentionMatrixUserIds: mentionTargets,
            messagePreview: wirePlain.trim().slice(0, 220),
            url: deepLink,
          }).catch((notifyErr) => {
            console.warn(
              '[HumanRightPanel] Mention notification dispatch failed:',
              notifyErr,
            );
          });
        }
      }
      setSendingPending(null);
      disposeDraftAttachmentUrls(savedAttachments);
      setReplyDraft(null);
      setEditDraft(null);
      if (sendOperationTokenRef.current === sendToken) {
        sendOperationTokenRef.current = null;
      }
      if (sendAbortControllerRef.current === abortController) {
        sendAbortControllerRef.current = null;
      }
    } catch (err) {
      console.error('[HumanRightPanel] Failed to send message:', err);
      if (sendOperationTokenRef.current !== sendToken) {
        disposeDraftAttachmentUrls(savedAttachments);
        setSendingPending(null);
        return;
      }
      sendOperationTokenRef.current = null;
      setSendingPending(null);
      if (sendAbortControllerRef.current === abortController) {
        sendAbortControllerRef.current = null;
      }
      if (err instanceof SendMessageCancelledError) {
        disposeDraftAttachmentUrls(savedAttachments);
        setInput(text);
        setDraftAttachments(savedAttachments);
        setReplyDraft(savedDraft);
        setEditDraft(savedEditDraft);
        return;
      }
      if (err instanceof SendMessagePartialFailureError) {
        const { sentAttachmentCount, restoreCaption, message } = err;
        setComposerError(
          t('sendPartialFailed', {
            sent: sentAttachmentCount,
            detail: message,
          }),
        );
        for (let i = 0; i < sentAttachmentCount; i++) {
          const a = savedAttachments[i];
          if (a) URL.revokeObjectURL(a.previewUrl);
        }
        setDraftAttachments(savedAttachments.slice(sentAttachmentCount));
        setInput(restoreCaption ? text : '');
        setReplyDraft(savedDraft);
        setEditDraft(savedEditDraft);
        return;
      }
      const isUnknownTokenError =
        typeof err === 'object' &&
        err !== null &&
        ((err as { errcode?: string }).errcode === 'M_UNKNOWN_TOKEN' ||
          (err as { data?: { errcode?: string } }).data?.errcode ===
            'M_UNKNOWN_TOKEN' ||
          `${(err as { message?: string }).message ?? ''}`
            .toLowerCase()
            .includes('unknown token'));
      if (isUnknownTokenError) {
        const recovered = await matrixRef.current
          .refreshSession()
          .catch(() => false);
        setComposerError(
          recovered
            ? 'Chat session refreshed. Please send your message again.'
            : 'Chat session expired. Please reload the page and try again.',
        );
        setInput(text);
        setReplyDraft(savedDraft);
        setEditDraft(savedEditDraft);
        setDraftAttachments(savedAttachments);
        return;
      }
      const msg = isMatrixRateLimitedError(err)
        ? t('sendRateLimited')
        : err instanceof MatrixUploadTimeoutError
        ? t('sendUploadTimedOut')
        : err instanceof Error
        ? t('sendFailedWithReason', { message: err.message })
        : t('sendFailed');
      setComposerError(msg);
      setInput(text);
      setReplyDraft(savedDraft);
      setEditDraft(savedEditDraft);
      setDraftAttachments(savedAttachments);
    }
  }, [
    input,
    roomId,
    canInteractWithSignalThread,
    replyDraft,
    editDraft,
    draftAttachments,
    mentionSanitizedLabelToUserId,
    mode,
    searchParams,
    pathname,
    me?.name,
    me?.surname,
    me?.nickname,
    me?.slug,
    spaceSlug,
    notifyChatMention,
    hasSignalTeamPolicy,
    signalTeamMemberIdSet,
    t,
  ]);

  useEffect(() => {
    return () => {
      disposeDraftAttachmentUrls(draftAttachmentsRef.current);
    };
  }, []);

  return (
    <>
      <SidebarHeader className="bg-background-2 gap-0 p-0">
        <HumanChatPanelHeader
          title={mode === 'coherence' ? coherenceTitle ?? undefined : ''}
          onBack={mode === 'coherence' ? closeCoherenceChat : undefined}
          notificationSettingsHref={notificationCentreHref}
          trailingStart={
            showAuthedUi && roomId ? (
              <HumanChatPanelMentionBell
                unreadCount={bellMentionCount}
                countIsCapped={bellMentionCapped}
                mentionsTabActive={activeTab === 'mentions'}
                onOpenMentions={() => setActiveTab('mentions')}
              />
            ) : null
          }
        />
        <HumanChatPanelTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          chatMentionCount={bellMentionCount}
          chatMentionCountCapped={bellMentionCapped}
          mentionTabBadgeCount={bellMentionCount}
          mentionTabBadgeCapped={bellMentionCapped}
          tabRowEnd={
            callUiEnabled && !showFloatingDock ? (
              <HumanChatPanelCallToolbar
                callState={spaceCallState}
                callKind={spaceCallKind}
                disabled={!callUiEnabled}
                roomCallInProgressToJoin={spaceCallToolbarJoinHint}
                onlyLocalInRoomCall={
                  spaceCallShowJoinStrip && spaceCallOtherMemberCount === 0
                }
                onAudio={() => {
                  if (!canJoinSignalThreadCall && isSignalThread) {
                    void requestSignalTeamAccess();
                    return;
                  }
                  handleCallAudio();
                }}
                onVideo={() => {
                  if (!canJoinSignalThreadCall && isSignalThread) {
                    void requestSignalTeamAccess();
                    return;
                  }
                  handleCallVideo();
                }}
              />
            ) : null
          }
        />
        {callUiEnabled &&
          !showFloatingDock &&
          !inSpaceCall &&
          spaceCallShowJoinStrip && (
            <HumanChatPanelCallJoinStrip
              deviceCount={spaceCallRoomGroupDeviceCount}
              disabled={!callUiEnabled}
              busy={spaceCallBusyJoining}
              captureConsent={spaceCallCaptureConsent}
              roomId={roomId}
              callJoinAlertsUnmuted={joinAlertSoundEnabled}
              onCallJoinAlertsUnmutedChange={setJoinAlertSoundEnabled}
              onJoinAudio={() => {
                if (!canJoinSignalThreadCall && isSignalThread) {
                  void requestSignalTeamAccess();
                  return;
                }
                handleCallAudio();
              }}
              onJoinVideo={() => {
                if (!canJoinSignalThreadCall && isSignalThread) {
                  void requestSignalTeamAccess();
                  return;
                }
                handleCallVideo();
              }}
            />
          )}
        {callUiEnabled &&
          (inSpaceCall ||
            spaceCallState === 'error' ||
            spaceCallState === 'disconnecting') && (
            <HumanChatPanelCallBanner
              callState={spaceCallState}
              callKind={spaceCallKind}
              errorCode={spaceCallError}
              isScreensharing={spaceCallScreensharing}
              screenshareErrorCode={spaceCallScreenshareError}
              tabBackgroundWhileInCall={spaceCallTabBackground}
              isMicrophoneMuted={spaceCallMicMuted}
              isLocalVideoMuted={spaceCallVideoMuted}
              participantCount={spaceCallRoomGroupDeviceCount}
              othersInRoomCallCount={spaceCallOthersInRoom}
              remoteMediaStall={spaceCallRemoteMediaStall}
              onDismissRemoteMediaStall={dismissSpaceCallRemoteMediaStall}
              onLeave={handleCallLeave}
              onToggleMic={handleCallToggleMic}
              onToggleCamera={handleCallToggleCamera}
              onToggleScreenshare={handleCallToggleScreenshare}
              voiceProcessingPreset={spaceCallVoiceProcessingPreset}
              onVoiceProcessingPresetChange={
                handleCallVoiceProcessingPresetChange
              }
              captureMode={spaceCallCaptureMode}
              capturePreference={spaceCallCapturePreference}
              capturePreferenceSelected={spaceCallCapturePreferenceSelected}
              onCapturePreferenceChange={setSpaceCallCapturePreference}
              onStartCapture={startSpaceCallCapture}
              onPauseCapture={pauseSpaceCallCapture}
              onResumeCapture={resumeSpaceCallCapture}
              onStopCapture={stopSpaceCallCapture}
              recordingStatus={spaceCallRecordingStatus}
              recordingError={spaceCallRecordingError}
              recordingWarning={spaceCallRecordingWarning}
              canRetryRecordingUpload={spaceCallCanRetryRecordingUpload}
              onRetryRecordingUpload={() => {
                void retrySpaceCallRecordingUpload();
              }}
              captureConsent={spaceCallCaptureConsent}
              roomId={roomId}
              controlsMode="leave_only"
              onDismissScreenshareError={dismissSpaceCallScreenshareError}
              onRetryCall={handleRetrySpaceCall}
              onDismissCallError={dismissSpaceCallError}
            />
          )}
        {!showFloatingDock && callUiEnabled ? (
          <HumanChatPanelScreenshareTakeoverDialog
            incoming={spaceCallScreenshareTakeoverIncoming}
            pending={Boolean(spaceCallScreenshareTakeoverPendingId)}
            denied={spaceCallScreenshareTakeoverDenied}
            onApprove={(request) => {
              void approveSpaceCallScreenshareTakeover(request);
            }}
            onDeny={(request) => {
              void denySpaceCallScreenshareTakeover(request);
            }}
            onCancelPending={() => {
              void cancelSpaceCallScreenshareTakeoverRequest();
            }}
            onDismissDenied={dismissSpaceCallScreenshareTakeoverPrompt}
          />
        ) : null}
      </SidebarHeader>
      {/* overflow-hidden: single scroll inside tab bodies (messages / members / mentions); avoids stacked full-height scrollbars */}
      <SidebarContent
        ref={sidebarContentRef}
        className="flex min-h-0 flex-col overflow-hidden bg-background-2"
      >
        {isAuthLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-sm text-muted-foreground">{t('loading')}</div>
          </div>
        ) : showAuthPrompt ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <Empty>
              <div className="flex flex-col gap-7">
                <p>{tSpaces('accessDeniedNotLoggedIn')}</p>
                <div className="flex items-center justify-center gap-4">
                  <Button variant="outline" onClick={login}>
                    {tSpaces('signIn')}
                  </Button>
                  <Button onClick={login}>{tSpaces('getStarted')}</Button>
                </div>
              </div>
            </Empty>
          </div>
        ) : blockSpaceChatForActivityAccess ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <SpaceAccessDenied
              userState={userSpaceState}
              spaceId={effectiveSpaceWeb3Id}
              spaceSlug={spaceSlug ?? undefined}
            />
          </div>
        ) : (
          <>
            {activeTab === 'chat' && (
              <div
                className="flex min-h-0 flex-1 flex-col"
                role="tabpanel"
                id="chat-tabpanel-chat"
              >
                {callUiEnabled && !showFloatingDock && (
                  <div
                    className={
                      inSpaceCall
                        ? /* cap height so min-heights on tiles (share grid) cannot overlap the message list */
                          'flex min-h-0 min-w-0 max-h-[min(52dvh,520px)] shrink-0 flex-col overflow-hidden'
                        : 'shrink-0'
                    }
                  >
                    <HumanChatPanelCallStage
                      client={client}
                      roomId={roomId}
                      groupCall={spaceGroupCall}
                      callKind={spaceCallKind}
                      isLocalVideoMuted={spaceCallVideoMuted}
                      isMicrophoneMuted={spaceCallMicMuted}
                      isScreensharing={spaceCallScreensharing}
                      callState={spaceCallState}
                      feedVersion={spaceCallFeedVersion}
                      activeSpeakerKey={spaceCallActiveSpeakerKey}
                      currentUserId={currentUserId}
                      inCallUserIds={spaceCallInCallUserIds}
                      currentUserProfileAvatarUrl={currentUserAvatarUrl}
                      resolveMemberLabel={resolveMemberLabel}
                      layout="panel"
                    />
                  </div>
                )}
                {error && (
                  <div
                    role="alert"
                    className="mt-0 w-full border-y border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}
                {composerError && (
                  <div
                    role="alert"
                    className="mt-0 w-full border-y border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {composerError}
                  </div>
                )}
                {mentionNavigationNotice && (
                  <div
                    role="status"
                    className="mt-0 w-full border-y border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
                  >
                    {mentionNavigationNotice}
                  </div>
                )}
                {isSignalThread &&
                  hasSignalTeamPolicy &&
                  !canInteractWithSignalThread && (
                    <div className="mt-0 w-full border-y border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
                      <p>{t('signalTeamBannerReadOnly')}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 min-h-8 border-[color:var(--space-accent)] bg-background px-3 text-[color:var(--space-accent)] hover:bg-accent-3 disabled:border-[color:var(--space-accent)]/45 disabled:text-[color:var(--space-accent)]/55 disabled:opacity-100"
                          disabled={
                            currentUserPendingSignalTeamRequest ||
                            signalTeamBusy
                          }
                          onClick={() => void requestSignalTeamAccess()}
                        >
                          {currentUserPendingSignalTeamRequest
                            ? t('signalTeamRequestPending')
                            : t('signalTeamRequestAccess')}
                        </Button>
                      </div>
                    </div>
                  )}
                {isSignalThread &&
                  canManageSignalTeam &&
                  signalTeamPendingRequesterIds.length > 0 && (
                    <div className="mt-0 w-full border-y border-border/70 bg-muted/40 px-3 py-2">
                      <p className="text-xs font-medium text-foreground">
                        {t('signalTeamPendingRequests')}
                      </p>
                      <div className="mt-2 space-y-1">
                        {signalTeamPendingRequesterIds.map((requesterId) => (
                          <div
                            key={requesterId}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate text-xs text-muted-foreground">
                              <SignalTeamResolvedMemberLabel
                                candidate={{
                                  userId: requesterId,
                                  displayLabel:
                                    resolveMentionMemberLabel(requesterId),
                                }}
                                fallbackLabel={resolveMentionMemberLabel(
                                  requesterId,
                                )}
                                unknownMemberLabel={t('unknownMember')}
                              />
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={signalTeamBusy}
                              onClick={() =>
                                void approveSignalTeamRequester(requesterId)
                              }
                            >
                              {t('signalTeamApproveRequester')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                {isSignalThread && canManageSignalTeam && (
                  <div className="mt-0 w-full border-y border-border/70 bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {t('signalTeamManageTitle')}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        colorVariant="accent"
                        className="h-7 min-h-7 self-center border-[color:var(--space-accent)] px-2.5 py-0 text-xs font-semibold leading-none whitespace-nowrap text-[color:var(--space-accent)] hover:bg-accent-3"
                        onClick={() => {
                          if (signalTeamPanelOpen) {
                            void commitSignalTeamDraft();
                            return;
                          }
                          setSignalTeamDraftMemberIds(
                            normalizeMatrixUserIds(
                              effectiveSignalTeamMemberIds,
                            ),
                          );
                          setSignalTeamPanelOpen(true);
                        }}
                      >
                        {signalTeamPanelOpen
                          ? t('signalTeamManageClose')
                          : t('signalTeamManageOpen')}
                      </Button>
                    </div>
                    {signalTeamPanelOpen && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {t('signalTeamMemberListHint')}
                        </p>
                        <div className="grid gap-1">
                          {signalTeamSelectableMembers.map((member) => {
                            const selected = signalTeamEditorMemberIds.includes(
                              member.userId,
                            );
                            const isCurrentUser =
                              member.userId === currentUserId;
                            const isOwner = member.userId === signalTeamOwnerId;
                            return (
                              <button
                                key={member.userId}
                                type="button"
                                className={`flex items-center justify-between rounded-md px-2 py-1 text-left text-sm ${
                                  selected
                                    ? 'border border-accent-8/55 bg-accent-3/28 ring-1 ring-accent-8/35'
                                    : 'border border-transparent hover:bg-muted/70'
                                }`}
                                disabled={signalTeamBusy}
                                onClick={() => {
                                  if (isCurrentUser && selected) return;
                                  if (isOwner && selected) return;
                                  const next = selected
                                    ? signalTeamEditorMemberIds.filter(
                                        (id) => id !== member.userId,
                                      )
                                    : [
                                        ...signalTeamEditorMemberIds,
                                        member.userId,
                                      ];
                                  setSignalTeamDraftMemberIds(
                                    normalizeMatrixUserIds(next),
                                  );
                                }}
                              >
                                <SignalTeamResolvedMemberLabel
                                  candidate={{
                                    userId: member.userId,
                                    displayLabel: member.displayLabel,
                                    privySub: member.privySub,
                                  }}
                                  fallbackLabel={member.displayLabel}
                                  isOwner={isOwner}
                                  unknownMemberLabel={t('unknownMember')}
                                />
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  {isOwner ? null : selected ? (
                                    <Check className="h-3.5 w-3.5 text-accent-11" />
                                  ) : (
                                    <Plus className="h-3.5 w-3.5" />
                                  )}
                                  {isOwner
                                    ? 'Owner'
                                    : selected
                                    ? t('signalTeamRemoveMember')
                                    : t('signalTeamAddMember')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {reactionError && (
                  <div
                    role="alert"
                    className="mt-0 w-full border-y border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {reactionError}
                  </div>
                )}
                {deleteError && (
                  <div
                    role="alert"
                    className="mt-0 w-full border-y border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {deleteError}
                  </div>
                )}
                {isJoining ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-sm text-muted-foreground">
                      {t('loading')}
                    </div>
                  </div>
                ) : (
                  <HumanChatPanelMessages
                    messages={mergedMessages}
                    roomId={roomId}
                    currentUserId={currentUserId}
                    currentUserAvatarUrl={currentUserAvatarUrl}
                    onReply={handleReplyToMessage}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onToggleReaction={handleToggleReaction}
                    resolveReactionReactorLabel={(userId) =>
                      resolveMemberLabel(userId)
                    }
                    resolveMatrixMemberLabel={resolveMentionMemberLabel}
                    resolveSenderDisplayLabel={resolveSenderDisplayLabel}
                    onCancelSendPending={cancelSendInFlight}
                    firstUnreadMessageId={unreadChatState.firstUnreadMessageId}
                    unreadNotificationCount={
                      unreadChatState.unreadNotificationCount
                    }
                    unreadCountIsCapped={unreadChatState.unreadCountIsCapped}
                    onReachedTimelineBottom={handleReachedTimelineBottom}
                    onMarkAsReadFromBanner={handleMarkAsReadFromBanner}
                    scrollTargetEventId={scrollToEventId}
                    onConsumedScrollTarget={handleConsumedScrollTarget}
                    onScrollTargetNotFound={handleScrollTargetNotFound}
                  />
                )}
              </div>
            )}
            {activeTab === 'members' && (
              <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                role="tabpanel"
                id="chat-tabpanel-members"
              >
                <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto">
                  <HumanChatPanelMembers
                    useMembers={useMembers}
                    spaceSlug={spaceSlug}
                    roomId={roomId}
                    inCallMatrixUserIds={spaceCallInCallUserIds}
                    inOurCallSession={
                      inSpaceCall && spaceCallState === 'connected'
                    }
                    currentUserMatrixId={currentUserId}
                  />
                </div>
              </div>
            )}
            {activeTab === 'mentions' && (
              <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                role="tabpanel"
                id="chat-tabpanel-mentions"
              >
                <HumanChatPanelMentionTab
                  client={client}
                  roomId={roomId}
                  currentUserId={currentUserId}
                  resolveMemberLabel={resolveMentionMemberLabel}
                  onSelectMessage={handleSelectMentionFromInbox}
                  aggregatedMentions={mode === 'space'}
                />
              </div>
            )}
          </>
        )}
      </SidebarContent>
      {activeTab === 'chat' && !blockSpaceChatComposer && (
        <SidebarFooter className="relative z-20 bg-background-2 p-0">
          <div className="rounded-t-2xl border border-border/60 border-b-0 bg-card/35 shadow-[0_-8px_32px_-16px_rgba(15,23,42,0.12)] backdrop-blur-[1px] supports-[backdrop-filter]:bg-card/25 dark:bg-card/45 dark:shadow-[0_-8px_36px_-16px_rgba(0,0,0,0.45)] dark:supports-[backdrop-filter]:bg-card/35">
            <HumanChatPanelChatBar
              value={input}
              onChange={setInput}
              onSend={handleSend}
              mentionCandidates={mentionCandidates}
              mentionPickerEnabled={mentionPickerEnabled}
              composerLocked={!canInteractWithSignalThread}
              composerLockedMessage={t('signalTeamInteractionRestricted')}
              getMentionComposerLabel={getMentionComposerLabel}
              onMergeMentionDisplayLabel={mergeMentionDisplayLabel}
              draftAttachments={draftAttachments}
              onDraftAttachmentsChange={setDraftAttachments}
              replyPreview={
                replyDraft
                  ? {
                      authorLabel: replyDraft.authorLabel,
                      excerpt: replyDraft.excerpt,
                      sourceUserId: replyDraft.sourceUserId,
                      isYou: replyDraft.isYou,
                      onDismiss: () => setReplyDraft(null),
                    }
                  : undefined
              }
              editPreview={
                editDraft
                  ? {
                      excerpt: editDraft.excerpt,
                      onDismiss: () => {
                        setEditDraft(null);
                        setInput('');
                        disposeDraftAttachmentUrls(draftAttachmentsRef.current);
                        setDraftAttachments([]);
                      },
                    }
                  : undefined
              }
              editMediaMode={Boolean(editDraft?.editMediaMode)}
            />
          </div>
        </SidebarFooter>
      )}
    </>
  );
}
