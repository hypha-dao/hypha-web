'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Minimize2 } from 'lucide-react';
import {
  ClientEvent,
  RoomStateEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  useMatrix,
  useCoherenceMutationsWeb2Rsc,
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
  MatrixUploadTimeoutError,
  SendMessageCancelledError,
  SendMessagePartialFailureError,
  isMatrixRateLimitedError,
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  useSpaceGroupCall,
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
  HumanChatPanelCallJoinStrip,
  HumanChatPanelInCallControls,
  HumanChatPanelCallStage,
  canOpenHumanChatCallFullView,
  DEFAULT_CALL_FULL_VIEW_LAYOUT,
  HumanChatPanelCallFullViewLayoutMenu,
  persistCallFullViewLayout,
  readCallFullViewLayoutFromStorage,
  type CallFullViewPaneSplit,
  readCallFullViewPaneSplit,
  persistCallFullViewPaneSplit,
  type ChatDraftAttachment,
  type ChatMentionCandidate,
  type ChatPanelAttachmentMedia,
  type CallFullViewLayoutMode,
} from './human-chat-panel';
import type { ChatPanelTab } from './human-chat-panel';
import { useHumanChatPanel } from './human-chat-panel-context';
import {
  computeAggregateUnreadMentionCount,
  computeHumanChatUnreadState,
} from './human-chat-panel/matrix-chat-unread';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabel,
  shortenMatrixIdForDisplay,
} from './human-chat-panel/matrix-room-member-display';
import { getActiveTabFromPath } from './get-active-tab-from-path';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { useCallJoinChime } from './human-chat-panel/use-call-join-chime';
import {
  sanitizeMentionDisplayLabel,
  wireComposerPlainForMatrixSend,
} from './human-chat-panel/human-chat-display-mention';
import { Empty } from './empty';

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
};

type EditDraft = {
  messageId: string;
  excerpt: string;
  /** Editing a bundled / media Matrix message (caption + attachments). */
  editMediaMode?: boolean;
};

const ROOM_STORAGE_KEY = 'hypha-chat-room-';

const SESSION_ROOM_TO_SPACE_PREFIX = 'hypha-room-to-space-';
const CHAT_HISTORY_SESSION_PREFIX = 'hypha-chat-history-v1-';
const CHAT_HISTORY_MAX_ITEMS = 250;

type PersistedUIMessage = Omit<UIMessage, 'timestamp'> & {
  timestamp?: string;
};

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
      : [{ type: 'text', text: msg.content }],
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
  const { userState: userSpaceState, isLoading: isUserSpaceStateLoading } =
    useUserSpaceState({
      spaceSlug,
      space,
    });
  const { updateSpaceBySlug } = useSpaceMutationsWeb2Rsc(authToken);
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);

  const hasSpaceChatAccess = userSpaceState === UserSpaceState.LOGGED_IN_SPACE;
  const blockSpaceChatForMembership =
    mode === 'space' && !isUserSpaceStateLoading && !hasSpaceChatAccess;

  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;
  const updateSpaceBySlugRef = useRef(updateSpaceBySlug);
  updateSpaceBySlugRef.current = updateSpaceBySlug;
  const { open: sidebarOpen } = useSidebar();
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

  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatPanelTab>('chat');
  const [callFullViewOpen, setCallFullViewOpen] = useState(false);
  const [callFullViewLayoutMode, setCallFullViewLayoutMode] =
    useState<CallFullViewLayoutMode>(DEFAULT_CALL_FULL_VIEW_LAYOUT);
  const [callFullViewPaneSplit, setCallFullViewPaneSplit] = useState<{
    sideBySide: number;
    filmstrip: number;
    speakerOnTop: number;
  }>(() => ({
    sideBySide: readCallFullViewPaneSplit('sideBySide'),
    filmstrip: readCallFullViewPaneSplit('filmstrip'),
    speakerOnTop: readCallFullViewPaneSplit('speakerOnTop'),
  }));
  const [callPopupOffset, setCallPopupOffset] = useState({ x: 0, y: 0 });
  const callPopupDragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [isDraggingCallPopup, setIsDraggingCallPopup] = useState(false);
  const callFullViewSplitContainerRef = useRef<HTMLDivElement | null>(null);
  const callFullViewDialogRef = useRef<HTMLDivElement | null>(null);
  /**
   * `HumanChatPanelCallStage` only mounts the expand control when
   * `layout === "panel" && !fullViewOpen`, so this ref is set on the open
   * button in the sidebar. While the full-view `Dialog` is open the stage
   * uses `layout="hidden"`, so the button unmounts but the ref value is
   * retained for Radix `onCloseAutoFocus` to restore focus to the trigger.
   */
  const callFullViewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [scrollToEventId, setScrollToEventId] = useState<string | null>(null);
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
    setCallFullViewOpen(false);
  }, [setCallFullViewOpen]);

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
    callState: spaceCallState,
    errorCode: spaceCallError,
    callKind: spaceCallKind,
    enterAudio: enterSpaceCallAudio,
    enterVideo: enterSpaceCallVideo,
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
    dismissScreenshareError: dismissSpaceCallScreenshareError,
    activeSpeakerKey: spaceCallActiveSpeakerKey,
    setScreensharingEnabled: setSpaceCallScreensharing,
    tabBackgroundWhileInCall: spaceCallTabBackground,
    retryFromError: retrySpaceCall,
    dismissCallError: dismissSpaceCallError,
    remoteMediaStall: spaceCallRemoteMediaStall,
    dismissRemoteMediaStallBanner: dismissSpaceCallRemoteMediaStall,
  } = useSpaceGroupCall(mode === 'space' ? roomId : null, {
    authToken,
    spaceSlug,
  });

  const callUiEnabled = useMemo(
    () =>
      mode === 'space' &&
      Boolean(roomId) &&
      isMatrixAvailable &&
      isMatrixAuthenticated &&
      hasSpaceChatAccess,
    [
      mode,
      roomId,
      isMatrixAvailable,
      isMatrixAuthenticated,
      hasSpaceChatAccess,
    ],
  );

  const inSpaceCall =
    spaceCallState === 'connected' ||
    spaceCallState === 'connecting' ||
    spaceCallState === 'awaiting_media' ||
    spaceCallState === 'initializing';

  const spaceCallToolbarJoinHint = callUiEnabled && spaceCallShowJoinStrip;
  const showAuthedUi = !isAuthLoading && isAuthenticated;
  const showAuthPrompt = !isAuthLoading && !isAuthenticated;

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
    void enterSpaceCallAudio();
  }, [enterSpaceCallAudio]);

  const handleCallVideo = useCallback(() => {
    void enterSpaceCallVideo();
  }, [enterSpaceCallVideo]);

  const onCallFullViewPaneSplitChange = useCallback(
    (which: CallFullViewPaneSplit, value: number) => {
      persistCallFullViewPaneSplit(which, value);
      setCallFullViewPaneSplit((prev) => ({ ...prev, [which]: value }));
    },
    [],
  );

  const handleCallLeave = useCallback(() => {
    void leaveSpaceCall();
  }, [leaveSpaceCall]);

  /** End ghost sessions: when connected and no other participants for 5 minutes, leave locally. */
  useEffect(() => {
    if (!callUiEnabled || spaceCallState !== 'connected') return;
    if (spaceCallOthersInRoom > 0 || spaceCallRoomGroupDeviceCount === 0)
      return;

    const SOLO_IDLE_LEAVE_MS = 5 * 60 * 1000;
    const id = window.setTimeout(() => {
      void leaveSpaceCall();
    }, SOLO_IDLE_LEAVE_MS);

    return () => window.clearTimeout(id);
  }, [
    callUiEnabled,
    spaceCallState,
    spaceCallOthersInRoom,
    spaceCallRoomGroupDeviceCount,
    leaveSpaceCall,
  ]);

  const handleCallToggleMic = useCallback(() => {
    void setSpaceCallMicMuted(!spaceCallMicMuted);
  }, [setSpaceCallMicMuted, spaceCallMicMuted]);

  const handleCallToggleCamera = useCallback(() => {
    void setSpaceCallCameraMuted(!spaceCallVideoMuted);
  }, [setSpaceCallCameraMuted, spaceCallVideoMuted]);

  const handleCallToggleScreenshare = useCallback(() => {
    void setSpaceCallScreensharing(!spaceCallScreensharing);
  }, [setSpaceCallScreensharing, spaceCallScreensharing]);

  const handleRetrySpaceCall = useCallback(() => {
    retrySpaceCall();
  }, [retrySpaceCall]);

  const canOpenCallFullView = useMemo(
    () =>
      canOpenHumanChatCallFullView(
        spaceGroupCall,
        spaceCallKind,
        spaceCallVideoMuted,
        spaceCallScreensharing,
        spaceCallState,
        currentUserId,
        spaceCallInCallUserIds,
      ),
    [
      spaceGroupCall,
      spaceCallKind,
      spaceCallVideoMuted,
      spaceCallScreensharing,
      spaceCallState,
      currentUserId,
      spaceCallInCallUserIds,
    ],
  );

  const showCallLayoutMenuInFullView = useMemo(() => {
    if (!spaceGroupCall) return false;
    return (
      spaceGroupCall.screenshareFeeds.length > 0 &&
      spaceGroupCall.userMediaFeeds.length > 0
    );
  }, [spaceGroupCall]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCallFullViewLayoutMode(readCallFullViewLayoutFromStorage());
  }, []);

  const onCallFullViewLayoutChange = useCallback(
    (m: CallFullViewLayoutMode) => {
      setCallFullViewLayoutMode(m);
      persistCallFullViewLayout(m);
    },
    [],
  );

  useEffect(() => {
    if (!callFullViewOpen) return;
    if (
      activeTab !== 'chat' ||
      !canOpenCallFullView ||
      spaceCallState !== 'connected'
    ) {
      setCallFullViewOpen(false);
    }
  }, [activeTab, canOpenCallFullView, spaceCallState, callFullViewOpen]);

  useEffect(() => {
    if (!callFullViewOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      callFullViewDialogRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [callFullViewOpen]);

  const handleCallPopupDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!callFullViewOpen) return;
      const target = e.target as HTMLElement;
      if (target.closest('button,[data-call-popup-no-drag]')) {
        return;
      }
      callPopupDragStateRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startOffsetX: callPopupOffset.x,
        startOffsetY: callPopupOffset.y,
      };
      setIsDraggingCallPopup(true);
    },
    [callFullViewOpen, callPopupOffset.x, callPopupOffset.y],
  );

  useEffect(() => {
    if (!isDraggingCallPopup) return;
    const onMove = (e: PointerEvent) => {
      const drag = callPopupDragStateRef.current;
      if (!drag) return;
      if (e.pointerId !== drag.pointerId) return;
      const rawOffsetX = drag.startOffsetX + (e.clientX - drag.startClientX);
      const rawOffsetY = drag.startOffsetY + (e.clientY - drag.startClientY);
      const dialogRect = callFullViewDialogRef.current?.getBoundingClientRect();
      const popupWidth =
        dialogRect?.width ?? Math.min(window.innerWidth * 0.96, 1280);
      const popupHeight =
        dialogRect?.height ?? Math.min(window.innerHeight * 0.9, 900);
      const baseLeft = window.innerWidth / 2 - popupWidth / 2;
      const baseTop = window.innerHeight / 2 - popupHeight / 2;
      const rawLeft = baseLeft + rawOffsetX;
      const rawTop = baseTop + rawOffsetY;
      const maxLeft = Math.max(0, window.innerWidth - popupWidth);
      const maxTop = Math.max(0, window.innerHeight - popupHeight);
      const clampedLeft = Math.min(Math.max(rawLeft, 0), maxLeft);
      const clampedTop = Math.min(Math.max(rawTop, 0), maxTop);
      setCallPopupOffset({
        x: clampedLeft - baseLeft,
        y: clampedTop - baseTop,
      });
    };
    const onEnd = (e: PointerEvent) => {
      const drag = callPopupDragStateRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      callPopupDragStateRef.current = null;
      setIsDraggingCallPopup(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [isDraggingCallPopup]);

  /** Bumps when Matrix room membership changes so `@` mention candidates + button state refresh without reload. */
  const [mentionMembershipEpoch, setMentionMembershipEpoch] = useState(0);

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

  const resolveMemberLabel = useCallback(
    (userId: string | undefined) => {
      if (!userId) return t('unknownMember');
      if (currentUserId && userId === currentUserId) {
        const full = [me?.name, me?.surname].filter(Boolean).join(' ').trim();
        return full || t('you');
      }
      const rosterLabel = matrixUserIdToPersonLabel.get(userId)?.trim();
      if (rosterLabel) return rosterLabel;
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
      matrixUserIdToPersonLabel,
      me?.name,
      me?.surname,
      roomId,
      t,
    ],
  );

  const mentionCandidates = useMemo((): ChatMentionCandidate[] => {
    if (!client || !roomId) return [];
    const room = client.getRoom(roomId);
    if (!room) return [];

    const byUserId = new Map<
      string,
      { displayLabel: string; avatarUrl?: string; privySub?: string }
    >();

    for (const member of room.getJoinedMembers()) {
      const userId = member.userId;
      if (!userId) continue;
      if (currentUserId && userId === currentUserId) continue;
      byUserId.set(userId, {
        displayLabel: matrixMemberDisplayLabel(member, userId),
        avatarUrl: matrixMemberAvatarSquare(client, roomId, userId, 64),
      });
    }

    /** Same names as Members tab — overrides Matrix-only technical displaynames. */
    for (const p of spaceMembers) {
      const sub = p.sub?.trim();
      if (!sub) continue;
      const mxid = subToMatrixUserId[sub];
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
    roomId,
    currentUserId,
    spaceMembers,
    subToMatrixUserId,
    t,
    mentionMembershipEpoch,
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

  const mentionLabelByUserId = useMemo(
    () =>
      new Map(
        mentionCandidates.map((candidate) => {
          const o = mentionDisplayOverride[candidate.userId];
          return [
            candidate.userId,
            o?.trim() ? o : candidate.displayLabel,
          ] as const;
        }),
      ),
    [mentionCandidates, mentionDisplayOverride],
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
      return mentionLabelByUserId.get(id) ?? resolveMemberLabel(id);
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
  const mentionPickerEnabled = mentionCandidates.length > 0;

  useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const bumpMembership = (...args: unknown[]) => {
      const state = args[1] as { roomId?: string } | undefined;
      if (state?.roomId !== roomId) return;
      setMentionMembershipEpoch((n) => n + 1);
    };

    client.on(RoomStateEvent.Members, bumpMembership);
    client.on(RoomStateEvent.NewMember, bumpMembership);

    return () => {
      client.off(RoomStateEvent.Members, bumpMembership);
      client.off(RoomStateEvent.NewMember, bumpMembership);
    };
  }, [client, roomId]);

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
  useEffect(() => {
    if (prevSidebarOpenRef.current && !sidebarOpen && mode === 'coherence') {
      closeCoherenceChat();
    }
    prevSidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen, mode, closeCoherenceChat]);

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
    if (hasSpaceChatAccess) return;
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
    setCallFullViewOpen(false);
  }, [
    mode,
    roomId,
    hasSpaceChatAccess,
    isUserSpaceStateLoading,
    setCallFullViewOpen,
  ]);

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
    if (!hasSpaceChatAccess) return;

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
    hasSpaceChatAccess,
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
    const lang = parts[0];

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
      const targetRoom = fromRoomId?.trim();
      const current = roomId?.trim();
      const langMatch = pathname.match(/^\/([^/]+)\//);
      const lang = langMatch?.[1] ?? 'en';

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
        if (!slug && space?.chatRoomId?.trim() === targetRoom && spaceSlug) {
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
      }

      setActiveTab('chat');
      setScrollToEventId(eventId);
    },
    [
      roomId,
      pathname,
      router,
      openHumanChatPanel,
      space?.chatRoomId,
      spaceSlug,
    ],
  );

  const handleConsumedScrollTarget = useCallback(() => {
    setScrollToEventId(null);
  }, []);

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
          : target.senderName ?? resolveMemberLabel(target.senderMatrixId);
      const excerpt = firstLineForReplyPreview(getMessagePlainText(target));
      setEditDraft(null);
      setReplyDraft({
        messageId,
        authorLabel,
        excerpt,
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
        await matrixRef.current.sendMessage({
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
    replyDraft,
    editDraft,
    draftAttachments,
    mentionSanitizedLabelToUserId,
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
                callJoinRingControlsActive={
                  callUiEnabled && !inSpaceCall && spaceCallShowJoinStrip
                }
                callJoinAlertsUnmuted={joinAlertSoundEnabled}
                onCallJoinAlertsUnmutedChange={setJoinAlertSoundEnabled}
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
            callUiEnabled ? (
              <HumanChatPanelCallToolbar
                callState={spaceCallState}
                callKind={spaceCallKind}
                disabled={!callUiEnabled}
                roomCallInProgressToJoin={spaceCallToolbarJoinHint}
                onlyLocalInRoomCall={
                  spaceCallShowJoinStrip && spaceCallOtherMemberCount === 0
                }
                onAudio={handleCallAudio}
                onVideo={handleCallVideo}
              />
            ) : null
          }
        />
        {callUiEnabled && !inSpaceCall && spaceCallShowJoinStrip && (
          <HumanChatPanelCallJoinStrip
            deviceCount={spaceCallRoomGroupDeviceCount}
            disabled={!callUiEnabled}
            busy={spaceCallBusyJoining}
            onJoinAudio={handleCallAudio}
            onJoinVideo={handleCallVideo}
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
              onDismissScreenshareError={dismissSpaceCallScreenshareError}
              onRetryCall={handleRetrySpaceCall}
              onDismissCallError={dismissSpaceCallError}
            />
          )}
      </SidebarHeader>
      {/* overflow-hidden: single scroll inside tab bodies (messages / members / mentions); avoids stacked full-height scrollbars */}
      <SidebarContent className="flex min-h-0 flex-col overflow-hidden bg-background-2">
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
        ) : (
          <>
            {activeTab === 'chat' && (
              <div
                className="flex min-h-0 flex-1 flex-col"
                role="tabpanel"
                id="chat-tabpanel-chat"
              >
                {callUiEnabled && (
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
                      isScreensharing={spaceCallScreensharing}
                      callState={spaceCallState}
                      feedVersion={spaceCallFeedVersion}
                      activeSpeakerKey={spaceCallActiveSpeakerKey}
                      currentUserId={currentUserId}
                      inCallUserIds={spaceCallInCallUserIds}
                      currentUserProfileAvatarUrl={currentUserAvatarUrl}
                      resolveMemberLabel={resolveMemberLabel}
                      layout={
                        callFullViewOpen && canOpenCallFullView
                          ? 'hidden'
                          : 'panel'
                      }
                      onRequestFullView={
                        canOpenCallFullView
                          ? () => {
                              setCallFullViewOpen(true);
                            }
                          : undefined
                      }
                      fullViewOpen={callFullViewOpen}
                      fullViewTriggerRef={callFullViewTriggerRef}
                    />
                  </div>
                )}
                {error && (
                  <div
                    role="alert"
                    className="mx-3 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}
                {composerError && (
                  <div
                    role="alert"
                    className="mx-3 mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {composerError}
                  </div>
                )}
                {reactionError && (
                  <div
                    role="alert"
                    className="mx-3 mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {reactionError}
                  </div>
                )}
                {deleteError && (
                  <div
                    role="alert"
                    className="mx-3 mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
      {activeTab === 'chat' && !blockSpaceChatForMembership && (
        <SidebarFooter className="relative z-20 bg-background-2 p-0">
          <div className="rounded-t-2xl border border-border/60 border-b-0 bg-card/35 shadow-[0_-8px_32px_-16px_rgba(15,23,42,0.12)] backdrop-blur-[1px] supports-[backdrop-filter]:bg-card/25 dark:bg-card/45 dark:shadow-[0_-8px_36px_-16px_rgba(0,0,0,0.45)] dark:supports-[backdrop-filter]:bg-card/35">
            <HumanChatPanelChatBar
              value={input}
              onChange={setInput}
              onSend={handleSend}
              mentionCandidates={mentionCandidates}
              mentionPickerEnabled={mentionPickerEnabled}
              getMentionComposerLabel={getMentionComposerLabel}
              onMergeMentionDisplayLabel={mergeMentionDisplayLabel}
              draftAttachments={draftAttachments}
              onDraftAttachmentsChange={setDraftAttachments}
              replyPreview={
                replyDraft
                  ? {
                      authorLabel: replyDraft.authorLabel,
                      excerpt: replyDraft.excerpt,
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

      {callUiEnabled && canOpenCallFullView && callFullViewOpen && (
        <div
          ref={callFullViewDialogRef}
          tabIndex={-1}
          className="fixed z-[120] flex h-[min(90dvh,900px)] max-h-[min(90dvh,900px)] w-[min(96vw,80rem)] max-w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-background p-0 text-foreground shadow-2xl"
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${callPopupOffset.x}px), calc(-50% + ${callPopupOffset.y}px))`,
          }}
          role="dialog"
          aria-modal="false"
          aria-label={t('callFullView')}
        >
          <div
            className="relative flex shrink-0 cursor-grab border-b border-border/50 bg-muted/40 px-3 py-2.5 pe-2 text-left active:cursor-grabbing"
            onPointerDown={handleCallPopupDragStart}
          >
            <button
              type="button"
              data-call-popup-no-drag
              onClick={() => {
                setCallFullViewOpen(false);
                callFullViewTriggerRef.current?.focus();
              }}
              className="absolute end-2 top-2 z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('callFullViewClose')}
              title={t('callFullViewClose')}
            >
              <Minimize2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </button>
            <div className="min-w-0 flex-1 space-y-0.5 pe-10">
              <p className="text-sm font-medium tracking-tight text-foreground sm:text-left">
                {t('callFullView')}
              </p>
              <p className="text-xs text-muted-foreground sm:text-left">
                {t('callFullViewDescription')}
              </p>
            </div>
            {showCallLayoutMenuInFullView && (
              <div
                className="mt-1 w-full shrink-0 sm:mt-0 sm:w-auto sm:justify-self-end sm:pe-10"
                data-call-popup-no-drag
              >
                <HumanChatPanelCallFullViewLayoutMenu
                  value={callFullViewLayoutMode}
                  onValueChange={onCallFullViewLayoutChange}
                />
              </div>
            )}
          </div>
          <div
            ref={callFullViewSplitContainerRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col p-0"
            role="presentation"
          >
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <HumanChatPanelCallStage
                client={client}
                roomId={roomId}
                groupCall={spaceGroupCall}
                callKind={spaceCallKind}
                isLocalVideoMuted={spaceCallVideoMuted}
                isScreensharing={spaceCallScreensharing}
                callState={spaceCallState}
                feedVersion={spaceCallFeedVersion}
                activeSpeakerKey={spaceCallActiveSpeakerKey}
                currentUserId={currentUserId}
                inCallUserIds={spaceCallInCallUserIds}
                remoteMediaStall={spaceCallRemoteMediaStall}
                currentUserProfileAvatarUrl={currentUserAvatarUrl}
                resolveMemberLabel={resolveMentionMemberLabel}
                layout="fullView"
                fullViewOpen
                fullViewLayoutMode={callFullViewLayoutMode}
                fullViewPaneSplit={callFullViewPaneSplit}
                onFullViewPaneSplitChange={onCallFullViewPaneSplitChange}
                fullViewSplitContainerRef={callFullViewSplitContainerRef}
              />
            </div>
            {spaceCallScreenshareError && spaceCallState === 'connected' && (
              <div
                role="alert"
                className="flex shrink-0 items-start justify-center gap-2 border-t border-destructive/20 bg-destructive/10 px-3 py-1.5"
              >
                <p className="min-w-0 flex-1 text-center text-xs text-destructive">
                  {spaceCallScreenshareError === 'PERMISSION_DENIED'
                    ? t('callErrorPermission')
                    : t('callErrorScreenshare')}
                </p>
                <button
                  type="button"
                  onClick={dismissSpaceCallScreenshareError}
                  className="shrink-0 text-xs font-medium text-destructive underline-offset-2 hover:underline"
                >
                  {t('callScreenshareDismiss')}
                </button>
              </div>
            )}
            <div className="shrink-0 border-t border-border/50 bg-muted/30 px-3 py-2.5 backdrop-blur-sm">
              <HumanChatPanelInCallControls
                callState={spaceCallState}
                isMicrophoneMuted={spaceCallMicMuted}
                isLocalVideoMuted={spaceCallVideoMuted}
                isScreensharing={spaceCallScreensharing}
                onToggleMic={handleCallToggleMic}
                onToggleCamera={handleCallToggleCamera}
                onToggleScreenshare={handleCallToggleScreenshare}
                onLeave={handleCallLeave}
                variant="fullView"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
