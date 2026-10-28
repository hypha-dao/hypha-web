'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ClientEvent,
  MatrixEventEvent,
  RoomStateEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { Check, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
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
  useIsMobile,
  usePrefersCoarsePointer,
} from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';
import {
  HYPHA_ROOM_TYPES,
  acceptEnsuredPublicRoomId,
  distinctPublicRoomId,
  useMatrix,
  useCoherenceMutationsWeb2Rsc,
  useHookRegistry,
  useJwt,
  useMatrixUserIdsByPrivySubs,
  useMatrixUserIdsByPersonIds,
  useMe,
  usePeopleBySubs,
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
  useSpaceMutationsWeb2Rsc,
  useSpacesBySlugs,
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
  isArchivedGroupRoom,
  looksLikeTechnicalSpaceMemoryName,
  type MemberIntelligence,
  type SignalTeamNotice,
  requestRemoteGroupCallLeave,
  calledSpecialistIds,
  matrixUserIdsForPersonIds,
  applySignalCreatorToChatAuthor,
  isSignalDescriptionAnchorMessage,
  usePersonById,
} from '@hypha-platform/core/client';
import {
  isChatPanelAudioFile,
  isChatPanelVideoFile,
} from './human-chat-panel/chat-panel-media-types';
import { UseMembers } from '../spaces';
import { useSpaceMembersAndDelegates } from '../spaces/hooks/use-space-members-and-delegates';
import {
  UserSpaceState,
  useUserSpaceState,
} from '../spaces/hooks/use-user-space-state.web3.rpc';
import { useSpaceDiscoverability } from '../spaces/hooks/use-space-discoverability';
import {
  checkAccess,
  canInteractInSpace,
} from '../spaces/utils/transparency-access';
import { SpaceAccessDenied } from '../spaces/components/space-access-denied';
import { resolveSpaceDisplayLogoUrl } from '../spaces/utils/resolve-space-display-logo-url';
import { Empty } from './empty';
import { notifyConversationUnreadChanged } from '../people/components/conversation-unread-event';
import {
  rememberPersonDirectRoom,
  rememberSignalThreadRooms,
} from '../people/components/member-connections';
import {
  openOrEnsurePersonRoom,
  OpenPersonRoomFailure,
} from '../people/components/open-person-room';
import { getRootSpace } from './get-root-space';

import {
  HumanChatPanelHeader,
  HumanChatPanelGroupMenu,
  HumanChatPanelLoader,
  HumanChatPanelMessages,
  HumanChatPanelChatBar,
  HumanChatPanelErrorBoundary,
  HumanChatPanelTabs,
  HumanChatPanelMembers,
  HumanChatPanelMentionBell,
  HumanChatPanelMentionTab,
  HumanChatPanelCallToolbar,
  HumanChatPanelCallBanner,
  HumanChatPanelCallJoinStrip,
  HumanChatPanelConnectionBanner,
  HumanChatPanelCallStage,
  HumanChatPanelScreenshareTakeoverDialog,
  type ChatDraftAttachment,
  type ChatMentionAgentIcon,
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
  applyConversationRoomTitle,
  MyConnections,
} from '../people/components/my-connections';
import {
  MemberSpaceIcons,
  memberProfileAsideHref,
  usePersonMemberSpaces,
} from '../people/components/member-space-icons';
import {
  chatRoomAliasLocalpart,
  computeAggregateUnreadMentionCount,
  computeHumanChatUnreadState,
  ECOSYSTEM_CHAT_ALIAS_PREFIX,
  findJoinedRoomIdByAliasLocalpart,
  PUBLIC_CHAT_ALIAS_PREFIX,
  unreadNotificationBadgeForRoom,
} from './human-chat-panel/matrix-chat-unread';
import {
  isHyphaBotMatrixIdentity,
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabel,
  matrixUserIdToCanonicalPrivySub,
  pickUserVisibleMemberLabel,
  shortenMatrixIdForDisplay,
  uniqueCanonicalPrivySubsFromMxids,
  visibleMatrixMemberName,
} from './human-chat-panel/matrix-room-member-display';
import { getActiveTabFromPath } from './get-active-tab-from-path';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { getLocaleFromPath } from './get-locale-from-path';
import { getDhoPathOverview, getSignalPath } from './get-path-function';
import {
  useCallJoinChime,
  buildCallJoinHref,
} from './human-chat-panel/use-call-join-chime';
import { useCallJoinInvitation } from './human-chat-panel/use-call-join-invitation';
import { HumanChatPanelCallJoinInvitation } from './human-chat-panel/human-chat-panel-call-join-invitation';
import { shouldShowCallScaleWarning } from './human-chat-panel/call-scale-warning';
import { resolveSignalDeepLinkWithRetry } from './human-chat-panel/resolve-signal-deep-link';
import { resolveSignalThreadByMatrixRoom } from './human-chat-panel/resolve-signal-thread-by-matrix-room';
import {
  useCallMembershipRegistry,
  type CallElsewhereEntry,
} from './human-chat-panel/use-call-membership-registry';
import { HumanChatPanelElsewhereCallIndicator } from './human-chat-panel/human-chat-panel-elsewhere-call-indicator';
import { getCoherenceBySlug } from '@hypha-platform/core/coherence/server/web3';
import { upsertSignalDescriptionInRoom } from '../coherence/utils/signal-chat-description';
import {
  hasExplicitSignalTeamMemberList,
  isSignalTeamRequestContent,
  isSignalTeamRosterContent,
  isTrustedSignalTeamSender,
  retainSignalTeamDocumentSeed,
  rosterIdsIntersectSpaceMap,
  signalTeamDocumentSeedKey,
  type SignalTeamDocumentSeed,
} from '../coherence/utils/signal-team-access';
import { SignalTurnIntoProposalButton } from '../coherence/components/signal-turn-into-proposal-button';
import { SignalThreadMedia } from '../coherence/components/signal-detail-media';
import { SignalIndicativeAmounts } from '../coherence/components/signal-indicative-amounts';
import { matrixRoomShortLabel } from './human-chat-panel/matrix-chat-unread';
import {
  replaceMxidsWithComposerMentionTokens,
  replaceMxidsWithVisibleMentionLabels,
  sanitizeMentionDisplayLabel,
  wireComposerPlainForMatrixSend,
} from './human-chat-panel/human-chat-display-mention';
import { setSignalSearchParam } from './human-chat-panel/human-chat-message-link';
import {
  readLiveSignalSlugFromUrl,
  pickSignalDeepLinkTarget,
  shouldWriteOpenChatToSignalUrl,
} from '../coherence/lib/signal-deep-link-dom';
import { useGlobalCallDock } from './global-call-dock-context';
import { useScreenshareTabAudioPrompt } from './human-chat-panel/use-screenshare-tab-audio-prompt';
import {
  inviteMatrixAgentIfNeeded,
  requestMatrixAgentReply,
  matrixAgentSkills,
  withMatrixAgentMention,
} from './human-chat-panel/matrix-agent-mention';
import {
  buildSpaceRosterMentionCandidates,
  buildSpaceRosterSignalTeamMembers,
} from './human-chat-panel/build-space-roster-mention-candidates';
import {
  directConversationEmptyWelcomeKey,
  directConversationWelcomeName,
} from './human-chat-panel/direct-conversation-welcome';
import {
  callAppliesToCurrentChatRoom as chatRoomOwnsCallSession,
  hasHumanTimelineMessages,
  matchedDirectRoomId,
  PersonPanelCallAborted,
  personPanelCallSelectionMatches,
  personPanelCallSelectionOf,
  planPersonPanelCall,
  runPersonPanelCallPlan,
  shouldLeaveCallOnPersonPanelRefuse,
  shouldRefusePersonPanelCall,
} from './human-chat-panel/person-panel-call';
import {
  asTimelineDate,
  sortMessagesChronologically,
  upsertTimelineMessages,
} from './human-chat-panel/human-chat-timeline-order';

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

/** Live URL query — `useSearchParams()` can lag behind `history.replaceState`. */
function readLiveSearchParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key)?.trim() ?? null;
}

function readSignalDeepLinkSlug(
  searchParams: ReturnType<typeof useSearchParams> | null,
): string | null {
  if (typeof window !== 'undefined') {
    return readLiveSignalSlugFromUrl();
  }
  return searchParams?.get('signal')?.trim() ?? null;
}

function resolveCallRecordingRoomTitle(
  client: ReturnType<typeof useMatrix>['client'],
  roomId: string | null | undefined,
  spaceTitle?: string | null,
): string | undefined {
  const rid = roomId?.trim();
  if (client && rid) {
    const room = client.getRoom(rid);
    if (room) {
      const label = matrixRoomShortLabel(room).trim();
      if (label && !looksLikeTechnicalSpaceMemoryName(label)) {
        return label;
      }
    }
  }
  const title = spaceTitle?.trim();
  if (title && !looksLikeTechnicalSpaceMemoryName(title)) {
    return title;
  }
  return undefined;
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
  /** Specialist who answered an @AI Agents mention. */
  agentSpecialistId?: string;
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
/** Marks the dashboard network room in `joinedRef` without matching any space slug. */
const NETWORK_JOINED_SENTINEL = '__hypha_network__';

const SESSION_ROOM_TO_SPACE_PREFIX = 'hypha-room-to-space-';
const SESSION_ROOM_TO_COHERENCE_SLUG_PREFIX = 'hypha-room-to-coherence-slug-';
const SESSION_ROOM_TO_COHERENCE_TITLE_PREFIX = 'hypha-room-to-coherence-title-';
const SESSION_ROOM_TO_COHERENCE_SPACE_PREFIX = 'hypha-room-to-coherence-space-';
const COHERENCE_ROOM_REVERSE_PREFIX = 'hypha-room-id-to-coherence-';
const CHAT_HISTORY_SESSION_PREFIX = 'hypha-chat-history-v1-';
const CHAT_HISTORY_MAX_ITEMS = 250;
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

type SignalTeamNoticeFormatter = (notice: SignalTeamNotice) => string;

function formatMatrixUserIdForSignalNotice(userId: string): string {
  const trimmed = userId.trim();
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function createSignalTeamNoticeFormatter(
  t: (key: string, values?: Record<string, string>) => string,
): SignalTeamNoticeFormatter {
  return (notice) => {
    switch (notice.kind) {
      case 'access_requested':
        return t('signalTeamAccessRequested');
      case 'access_approved':
        return t('signalTeamAccessApproved');
      case 'members_updated':
        return t('signalTeamUpdated');
      case 'updated': {
        const added = notice.addedMemberMatrixUserIds.map(
          formatMatrixUserIdForSignalNotice,
        );
        const removed = notice.removedMemberMatrixUserIds.map(
          formatMatrixUserIdForSignalNotice,
        );
        const parts: string[] = [];
        if (added.length > 0) {
          parts.push(
            t('signalTeamAddedMembers', { members: added.join(', ') }),
          );
        }
        if (removed.length > 0) {
          parts.push(
            t('signalTeamRemovedMembers', { members: removed.join(', ') }),
          );
        }
        if (parts.length === 0) return t('signalTeamUpdated');
        return `${t('signalTeamUpdated')}: ${parts.join('; ')}`;
      }
    }
  };
}

type PersistedUIMessage = Omit<UIMessage, 'timestamp'> & {
  timestamp?: string;
};

type SignalTeamTimelineState = {
  memberMatrixUserIds: string[];
  pendingRequesterIds: string[];
  ownerMatrixUserId: string | null;
  /** True after a sender-trusted roster notice, even if members later left the space. */
  hasTrustedRoster: boolean;
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
  let hasTrustedRoster = false;
  const targetSlug = coherenceSlug?.trim() || null;

  for (const ev of events) {
    const eventType = ev.getType();
    if (eventType !== EventType.RoomMessage) continue;
    const content = ev.getContent() as Record<string, unknown> | null;
    if (!content || typeof content !== 'object') continue;
    const eventSlug =
      typeof content.coherenceSlug === 'string'
        ? content.coherenceSlug.trim()
        : '';
    if (targetSlug && eventSlug && eventSlug !== targetSlug) continue;
    const senderId = ev.getSender()?.trim() || null;
    const isTrustedActor = isTrustedSignalTeamSender({
      senderId,
      establishedOwnerMatrixUserId: ownerMatrixUserId,
      establishedMemberMatrixUserIds: memberMatrixUserIds,
      powerLevel: roomPowerLevelForUser(room, senderId),
    });

    // Request marker starts with the roster marker — classify request first.
    if (isSignalTeamRequestContent(content)) {
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
      continue;
    }

    if (!isSignalTeamRosterContent(content)) continue;
    // Marker-only / local-echo events without an explicit member array are
    // not a trusted-empty policy. A real empty roster sends `[]`.
    if (!hasExplicitSignalTeamMemberList(content) || !isTrustedActor) continue;
    hasTrustedRoster = true;
    memberMatrixUserIds = normalizeMatrixUserIds(content.memberMatrixUserIds);
    const nextOwnerId =
      typeof content.ownerMatrixUserId === 'string'
        ? content.ownerMatrixUserId.trim()
        : '';
    if (nextOwnerId) {
      ownerMatrixUserId = nextOwnerId;
    }
  }

  return {
    memberMatrixUserIds,
    pendingRequesterIds: [...pending],
    ownerMatrixUserId,
    hasTrustedRoster,
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
    if (messages.length === 0) {
      const existing = window.sessionStorage.getItem(
        `${CHAT_HISTORY_SESSION_PREFIX}${roomId}`,
      );
      if (existing && existing !== '[]') return;
    }
    const payload: PersistedUIMessage[] = messages
      .slice(-CHAT_HISTORY_MAX_ITEMS)
      .map((m) => ({
        ...m,
        timestamp: asTimelineDate(m.timestamp)?.toISOString(),
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
  spaceSlug?: string | null,
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
    if (spaceSlug?.trim()) {
      window.sessionStorage.setItem(
        `${SESSION_ROOM_TO_COHERENCE_SPACE_PREFIX}${roomId}`,
        spaceSlug.trim(),
      );
    }
    window.localStorage.setItem(
      `${COHERENCE_ROOM_REVERSE_PREFIX}${roomId}`,
      JSON.stringify({
        slug,
        title: title?.trim() || null,
        spaceSlug: spaceSlug?.trim() || null,
      }),
    );
  } catch {
    // ignore
  }
}

function readRoomToCoherenceSession(roomId: string): {
  slug: string | null;
  title: string | null;
  spaceSlug: string | null;
} {
  if (typeof window === 'undefined') {
    return { slug: null, title: null, spaceSlug: null };
  }
  try {
    const slug = window.sessionStorage
      .getItem(`${SESSION_ROOM_TO_COHERENCE_SLUG_PREFIX}${roomId}`)
      ?.trim();
    const title = window.sessionStorage
      .getItem(`${SESSION_ROOM_TO_COHERENCE_TITLE_PREFIX}${roomId}`)
      ?.trim();
    const spaceSlug = window.sessionStorage
      .getItem(`${SESSION_ROOM_TO_COHERENCE_SPACE_PREFIX}${roomId}`)
      ?.trim();
    if (slug) {
      return { slug, title: title || null, spaceSlug: spaceSlug || null };
    }
    const persisted = window.localStorage
      .getItem(`${COHERENCE_ROOM_REVERSE_PREFIX}${roomId}`)
      ?.trim();
    if (persisted) {
      const parsed = JSON.parse(persisted) as {
        slug?: string;
        title?: string | null;
        spaceSlug?: string | null;
      };
      const persistedSlug = parsed.slug?.trim();
      if (persistedSlug) {
        return {
          slug: persistedSlug,
          title: parsed.title?.trim() || null,
          spaceSlug: parsed.spaceSlug?.trim() || null,
        };
      }
    }
    return { slug: null, title: null, spaceSlug: null };
  } catch {
    return { slug: null, title: null, spaceSlug: null };
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
  formatSignalTeamNotice?: SignalTeamNoticeFormatter,
  systemSenderLabel?: string,
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
        : resolveAvatarForUser(replyAuthorId);
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
    : msg.signalTeamNotice && formatSignalTeamNotice
    ? formatSignalTeamNotice(msg.signalTeamNotice)
    : toUserFriendlySignalSystemBody(msg.content);

  const memberAvatar =
    !isCurrentUser && msg.sender ? resolveAvatarForUser(msg.sender) : undefined;

  if (msg.signalTeamNotice) {
    const noticeText =
      formatSignalTeamNotice?.(msg.signalTeamNotice) ??
      toUserFriendlySignalSystemBody(msg.content);
    return {
      id: msg.id,
      role: 'member',
      isSynthetic: true,
      parts: [{ type: 'text', text: noticeText }],
      senderName: systemSenderLabel,
      timestamp: msg.timestamp,
    };
  }

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
    ...(msg.agentSpecialistId
      ? { agentSpecialistId: msg.agentSpecialistId }
      : {}),
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

const COHERENCE_ROOM_JOIN_TIMEOUT_MS = 20_000;

function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

type HumanRightPanelProps = {
  useMembers: UseMembers;
};

export function HumanRightPanel({ useMembers }: HumanRightPanelProps) {
  const t = useTranslations('HumanChatPanel');
  const tCommon = useTranslations('Common');
  const tSpaces = useTranslations('Spaces');
  const tMember = useTranslations('MemberHome');
  const isMobile = useIsMobile() ?? false;
  const prefersCoarsePointer = usePrefersCoarsePointer() ?? false;
  const isTouchCallChrome = isMobile || prefersCoarsePointer;
  const params = useParams<{ id?: string }>();
  const pathname = usePathname() ?? '';
  const isMemberHome = /^\/[^/]+\/(?:my-dashboard|home)(?:\/|$)/.test(pathname);
  const isConnectionsPage = /^\/[^/]+\/(?:messages|connections)(?:\/|$)/.test(
    pathname,
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeSpaceSlug = typeof params?.id === 'string' ? params.id.trim() : '';

  const matrix = useMatrix();
  const {
    client,
    isMatrixAvailable,
    isConnecting,
    isAuthenticated: isMatrixAuthenticated,
    connectionStatus,
    retryMatrixConnection,
    connectionRetryFailed,
    refreshSession,
    sessionRefreshFailedDuringCall,
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
    coherenceDescription,
    coherenceSpaceSlug,
    coherencePublic,
    coherencePeerPerson,
    open,
    closeCoherenceChat,
    openCoherenceChat,
    openHumanChatPanel,
    closeHumanChatPanel,
    setUnreadMentionCount,
  } = useHumanChatPanel();
  // Person-to-person rooms (PM / group) have a title and no signal slug — never
  // inherit a space from the route or a leftover home slug. Map public chat
  // also opens with an empty signal slug; it is not a DM and must still load
  // the selected space so `spaces.chatRoomId` can be checked — prefer the
  // opened space over the current DHO route.
  const isDirectConversation =
    mode === 'coherence' && !coherencePublic && !coherenceSlug?.trim();
  const isStartConversation = isDirectConversation && !coherenceRoomId?.trim();
  const spaceSlug = isDirectConversation
    ? undefined
    : coherencePublic
    ? coherenceSpaceSlug?.trim() || routeSpaceSlug || undefined
    : routeSpaceSlug || coherenceSpaceSlug?.trim() || undefined;
  const { spaces: peerMemberSpaces, isLoading: peerMemberSpacesLoading } =
    usePersonMemberSpaces({
      personAddress: isDirectConversation
        ? coherencePeerPerson?.address
        : undefined,
      personSlug: isDirectConversation ? coherencePeerPerson?.slug : undefined,
    });
  const peerSpacesOverflowHref =
    isDirectConversation && coherencePeerPerson?.slug
      ? memberProfileAsideHref({
          lang: getLocaleFromPath(pathname),
          hostSpaceSlug: routeSpaceSlug || coherenceSpaceSlug,
          personSlug: coherencePeerPerson.slug,
          fallbackSpaceSlug: peerMemberSpaces[0]?.slug,
        })
      : null;
  const [spaceRoom, setSpaceRoom] = useState<'space' | 'ecosystem' | 'public'>(
    'space',
  );
  const callSpaceSlug =
    (typeof spaceSlug === 'string' ? spaceSlug.trim() : '') ||
    (!isDirectConversation ? coherenceSpaceSlug?.trim() : null) ||
    null;
  const { jwt: authToken, isLoadingJwt } = useJwt();
  const { useSendNotifications } = useHookRegistry();
  const { notifyCallStarted } = useSendNotifications({
    authToken,
  });
  const { person: me } = useMe();
  const signalCreatorLookupSlug =
    mode === 'coherence' ? coherenceSlug?.trim() || '' : '';
  const { data: openSignalForCreator } = useSWR(
    signalCreatorLookupSlug
      ? [signalCreatorLookupSlug, 'signal-creator-attribution']
      : null,
    ([slug]) => getCoherenceBySlug({ slug }),
    { revalidateOnFocus: false },
  );
  const { person: signalCreatorPerson } = usePersonById({
    id: openSignalForCreator?.creatorId ?? undefined,
  });
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug ?? '');
  const { spaces: organisationSpaces, isLoading: isOrganisationLoading } =
    useOrganisationSpacesBySingleSlug(spaceSlug ?? '');
  const rootSpace = useMemo(() => {
    if (!space) return undefined;
    if (space.parentId == null) return space;
    if (isOrganisationLoading) return undefined;
    const root = getRootSpace(space, organisationSpaces ?? []);
    if (!root || (root.id === space.id && space.parentId != null)) {
      return undefined;
    }
    return root;
  }, [isOrganisationLoading, organisationSpaces, space]);
  const effectiveSpaceWeb3Id = space?.web3SpaceId ?? undefined;
  const {
    persons: spaceMembersResult,
    isLoading: isLoadingSpaceMembers,
    error: spaceMembersError,
  } = useSpaceMembersAndDelegates({
    spaceSlug,
    web3SpaceId: effectiveSpaceWeb3Id,
    useMembers,
  });
  const spaceMembers = useMemo(
    () => spaceMembersResult ?? [],
    [spaceMembersResult],
  );
  const welcomePartner = useMemo(() => {
    if (mode === 'coherence') {
      return directConversationWelcomeName({
        mode,
        coherenceSlug,
        coherenceTitle,
      });
    }
    const names = spaceMembers
      .filter((person) => person.id !== me?.id)
      .map((person) => personRosterLabel(person, ''))
      .filter((name) => name.length > 0)
      .sort((left, right) => left.localeCompare(right));
    const named = names.find((name) => name.includes(' '));
    return named ?? names[0] ?? null;
  }, [coherenceSlug, coherenceTitle, me?.id, mode, spaceMembers]);
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
  const isSpaceMember = canInteractInSpace(userSpaceState);
  const blockSpaceChatForActivityAccess =
    mode === 'space' &&
    Boolean(spaceSlug?.trim()) &&
    !isUserSpaceStateLoading &&
    !isDiscoverabilityLoading &&
    !hasSpaceActivityAccess;
  // Dashboard chat has no space. Membership still gates space / ecosystem /
  // signal rooms. Public channels (network connect) stay open to visitors.
  const blockSpaceChatForMembership =
    !isDirectConversation &&
    !coherencePublic &&
    !(mode === 'space' && spaceRoom === 'public') &&
    (mode === 'space' || mode === 'coherence') &&
    Boolean(mode === 'coherence' || spaceSlug?.trim()) &&
    (isUserSpaceStateLoading || !isSpaceMember);
  const showMembershipAccessGate =
    blockSpaceChatForMembership && !isUserSpaceStateLoading;

  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;
  const updateSpaceBySlugRef = useRef(updateSpaceBySlug);
  updateSpaceBySlugRef.current = updateSpaceBySlug;
  const updateCoherenceBySlugRef = useRef(updateCoherenceBySlug);
  updateCoherenceBySlugRef.current = updateCoherenceBySlug;
  const {
    open: sidebarOpen,
    isMobile: isSidebarMobile,
    setOpenMobile,
  } = useSidebar();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthentication();

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
  const [groupTitle, setGroupTitle] = useState<string | null>(null);

  useEffect(() => {
    setGroupTitle(null);
  }, [coherenceRoomId]);

  useEffect(() => {
    if (!isStartConversation) return;
    // Opening Start-a-conversation must not keep a previous room id — the
    // call toolbar would start a live session in that leftover room.
    setRoomId(null);
    setMessages([]);
  }, [isStartConversation, coherenceTitle]);

  useEffect(() => {
    if (mode !== 'coherence') {
      setSignalTeamPanelOpen(false);
    }
  }, [mode]);

  const [isJoining, setIsJoining] = useState(false);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [autoLoadOlderPaused, setAutoLoadOlderPaused] = useState(false);
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
  const createRoomInFlightRef = useRef(
    new Map<string, Promise<{ roomId: string }>>(),
  );
  const createdRoomBySlugRef = useRef(new Map<string, string>());

  const getOrCreateCoherenceRoom = useCallback(
    (slug: string, title: string) => {
      const created = createdRoomBySlugRef.current.get(slug);
      if (created) return Promise.resolve({ roomId: created });
      const inFlight = createRoomInFlightRef.current.get(slug);
      if (inFlight) return inFlight;
      const pending = matrixRef.current
        .createRoom(title, { roomType: HYPHA_ROOM_TYPES.signal })
        .then((result) => {
          createdRoomBySlugRef.current.set(slug, result.roomId);
          return result;
        });
      createRoomInFlightRef.current.set(slug, pending);
      const clearInFlight = () => {
        if (createRoomInFlightRef.current.get(slug) === pending) {
          createRoomInFlightRef.current.delete(slug);
        }
      };
      pending.then(clearInFlight, clearInFlight);
      return pending;
    },
    [],
  );

  useEffect(() => {
    setMentionDisplayOverride({});
    setHasMoreOlderMessages(false);
    setLoadingOlderMessages(false);
    setAutoLoadOlderPaused(false);
  }, [roomId]);

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
  const signalTeamPanelOpenRef = useRef(signalTeamPanelOpen);
  signalTeamPanelOpenRef.current = signalTeamPanelOpen;
  const documentSeedRef = useRef<SignalTeamDocumentSeed>({
    key: '',
    memberIds: [],
    ownerId: null,
  });
  const [signalTeamDraftMemberIds, setSignalTeamDraftMemberIds] = useState<
    string[] | null
  >(null);
  const [signalTeamBusy, setSignalTeamBusy] = useState(false);
  const [signalTeamRosterResolved, setSignalTeamRosterResolved] =
    useState(true);

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
    activeRoomId: callSessionRoomId,
    callState: spaceCallState,
    errorCode: spaceCallError,
    callKind: spaceCallKind,
    startAudioForRoom,
    startVideoForRoom,
    refreshCall: refreshSpaceCall,
    selfStaleCallPresence: spaceCallSelfStalePresence,
    selfPresenceChecked: spaceCallSelfPresenceChecked,
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
    remoteScreenshareActive: spaceCallRemoteScreenshareActive,
    room: spaceCallRoom,
    feedVersion: spaceCallFeedVersion,
    screenshareErrorCode: spaceCallScreenshareError,
    screenshareTabAudioMissing: spaceCallScreenshareTabAudioMissing,
    dismissScreenshareTabAudioHint: dismissSpaceCallScreenshareTabAudioHint,
    retryScreenshareWithTabAudio: retrySpaceCallScreenshareWithTabAudio,
    cameraAccessBlocked: spaceCallCameraAccessBlocked,
    dismissCameraAccessBlocked: dismissSpaceCallCameraAccessBlocked,
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
    toggleScreensharing: toggleSpaceCallScreensharing,
    setScreensharingEnabled: setSpaceCallScreensharingEnabled,
    voiceProcessingPreset: spaceCallVoiceProcessingPreset,
    setVoiceProcessingPreset: setSpaceCallVoiceProcessingPreset,
    unsupportedVoiceProcessingConstraints:
      spaceCallUnsupportedVoiceProcessingConstraints,
    tabBackgroundWhileInCall: spaceCallTabBackground,
    retryFromError: retrySpaceCall,
    dismissCallError: dismissSpaceCallError,
    remoteMediaStall: spaceCallRemoteMediaStall,
    remoteMediaWarming: spaceCallRemoteMediaWarming,
    turnServerUnavailable: spaceCallTurnServerUnavailable,
    dismissTurnServerUnavailableBanner: dismissSpaceCallTurnServerUnavailable,
    dismissRemoteMediaStallBanner: dismissSpaceCallRemoteMediaStall,
    retryRemoteMediaConnection: retrySpaceCallRemoteMedia,
    showFloatingDock,
    canSendCallReactions,
    localHandRaised,
    sendReaction,
    toggleRaiseHand,
    raisedHands,
    getFloatingReactions,
    isHandRaised,
    getRaiseHandOrder,
    floatingReactionsVersion,
  } = useGlobalCallDock();
  const hasHumanMessages = hasHumanTimelineMessages(messages);
  const refusePersonPanelCall = shouldRefusePersonPanelCall({
    isDirectConversation,
    roomId,
    coherenceRoomId,
    hasHumanMessages,
  });
  useEffect(() => {
    if (!refusePersonPanelCall) return;
    if (shouldLeaveCallOnPersonPanelRefuse(callSessionRoomId, roomId)) {
      void leaveSpaceCall();
    }
    dismissSpaceCallError();
  }, [
    callSessionRoomId,
    dismissSpaceCallError,
    leaveSpaceCall,
    refusePersonPanelCall,
    roomId,
  ]);
  useEffect(() => {
    const activeSpaceSlug = spaceSlug?.trim() || null;
    const activeAuthToken = authToken?.trim() || null;
    const activeRoomId = roomId?.trim() || null;
    const canonicalRoomId =
      mode === 'space' ? space?.chatRoomId?.trim() || null : null;
    const bindRoomId = activeRoomId ?? canonicalRoomId;
    if (bindRoomId && !refusePersonPanelCall) {
      bindRoomContext(bindRoomId, activeSpaceSlug, activeAuthToken);
      return;
    }
    if (!showFloatingDock) {
      bindRoomContext(null, null, null);
    }
  }, [
    authToken,
    bindRoomContext,
    mode,
    roomId,
    showFloatingDock,
    refusePersonPanelCall,
    space?.chatRoomId,
    spaceSlug,
  ]);

  const inSpaceCall =
    spaceCallState === 'connected' ||
    spaceCallState === 'connecting' ||
    spaceCallState === 'awaiting_media' ||
    spaceCallState === 'initializing';

  /**
   * #2456: right after opening/switching to a room, `spaceCallSelfPresenceChecked` is briefly
   * false while the Matrix room object syncs locally — until then we can't reliably tell whether
   * this user already holds a live session elsewhere.
   */
  const callUiEnabled = useMemo(
    () =>
      isMatrixAvailable &&
      isMatrixAuthenticated &&
      (isSpaceMember || isDirectConversation) &&
      (Boolean(roomId) || isStartConversation),
    [
      roomId,
      isMatrixAvailable,
      isMatrixAuthenticated,
      isSpaceMember,
      isDirectConversation,
      isStartConversation,
    ],
  );

  /**
   * #2456: whether it's safe to let the user *start a brand-new* call session from this room —
   * distinct from `callUiEnabled`, which only gates whether call chrome shows at all. A premature
   * click before the self-stale-presence check has run could either fail with a misleading "call
   * server not ready" error, or start a genuine duplicate session. Rather than hiding the whole
   * sidebar call chrome (banner/join-strip/alerts) while this settles, only the toolbar's
   * "start a call" buttons wait for it, showing a skeleton in the meantime — see
   * `showSidebarCallChrome` usage at the toolbar render site below.
   */
  const callActionsChecked = inSpaceCall || spaceCallSelfPresenceChecked;

  const callAppliesToCurrentChatRoom = useMemo(
    () => chatRoomOwnsCallSession(roomId, callSessionRoomId),
    [callSessionRoomId, roomId],
  );

  /** Banner, join strip, and toolbar for the chat room that owns the active session. */
  const showSidebarCallChrome = callUiEnabled && callAppliesToCurrentChatRoom;
  /** In-chat video tiles stay in the floating dock once a session is active. */
  const showSidebarCallVideo = showSidebarCallChrome && !showFloatingDock;

  const spaceCallToolbarJoinHint =
    callUiEnabled &&
    (spaceCallShowJoinStrip || spaceCallRoomGroupDeviceCount > 0);
  /**
   * Only excludes the user's own actively-bound call room — the room currently being
   * viewed is *not* excluded here (unlike the top-nav trigger / earlier version of this
   * call), because this single result now drives two different views below: the "elsewhere"
   * avatar list (which does exclude the viewed room) and the "there's a call in this room but
   * I'm bound elsewhere" banner (which needs exactly the viewed room, when present). See
   * #2424 QA notes, 2026-08-04.
   */
  const otherActiveCallEntries = useCallMembershipRegistry({
    excludeRoomIds: [callSessionRoomId],
    getAccessToken: async () => authTokenRef.current,
    hasAccessToken: Boolean(authToken),
  });
  const elsewhereCallEntries = useMemo(
    () => otherActiveCallEntries.filter((entry) => entry.roomId !== roomId),
    [otherActiveCallEntries, roomId],
  );
  /** The room currently being viewed has its own active call, separate from whichever call
   * (if any) the user is actively bound to elsewhere. */
  const currentRoomActiveCall = useMemo(
    () =>
      otherActiveCallEntries.find((entry) => entry.roomId === roomId) ?? null,
    [otherActiveCallEntries, roomId],
  );

  const { resolvedTheme } = useTheme();
  const elsewhereCallSpaceSlugs = useMemo(
    () =>
      Array.from(
        new Set(
          elsewhereCallEntries
            .map((entry) => entry.spaceSlug?.trim())
            .filter((slug): slug is string => Boolean(slug)),
        ),
      ),
    [elsewhereCallEntries],
  );
  const { spaces: elsewhereCallSpacesData } = useSpacesBySlugs(
    elsewhereCallSpaceSlugs,
    false,
  );
  /** Avatar images for the cross-context indicator — same source as the recent-spaces
   * sidebar (`ai-left-panel.tsx`): batch-fetched space records, resolved logo URL with
   * a first-letter fallback while the fetch is in flight or if no logo is set. */
  const elsewhereCallEntriesWithAvatar = useMemo(
    () =>
      elsewhereCallEntries.map((entry) => ({
        ...entry,
        avatarUrl: resolveSpaceDisplayLogoUrl(
          elsewhereCallSpacesData.find(
            (space) => space.slug === entry.spaceSlug,
          ),
          resolvedTheme === 'dark' ? 'dark' : 'light',
        ),
      })),
    [elsewhereCallEntries, elsewhereCallSpacesData, resolvedTheme],
  );

  const handleSelectElsewhereCall = useCallback(
    (entry: CallElsewhereEntry) => {
      const lang = getLocaleFromPath(pathname);
      const target =
        entry.kind === 'signal' && entry.signalSlug
          ? getSignalPath(lang, entry.spaceSlug, entry.signalSlug)
          : getDhoPathOverview(lang, entry.spaceSlug);
      router.push(target);
      openHumanChatPanel();
      setActiveTab('chat');
    },
    [pathname, router, openHumanChatPanel, setActiveTab],
  );

  const sessionRestoring =
    isAuthLoading ||
    isLoadingJwt ||
    (isAuthenticated && !isMatrixAvailable && isConnecting);
  const showAuthedUi = !isAuthLoading && isAuthenticated;
  const showAuthPrompt = !sessionRestoring && !isAuthenticated;
  const showPanelInteractionPrompt =
    hasSpaceActivityAccess &&
    !isUserSpaceStateLoading &&
    showMembershipAccessGate;
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

  const spaceCallShowJoinUi = useMemo(
    () =>
      showSidebarCallChrome &&
      spaceCallShowJoinStrip &&
      spaceCallRoomGroupDeviceCount > 0 &&
      !inSpaceCall,
    [
      showSidebarCallChrome,
      spaceCallShowJoinStrip,
      spaceCallRoomGroupDeviceCount,
      inSpaceCall,
    ],
  );
  /**
   * #2456 D2c/D2e: the join-strip's *own* render gate — unlike `spaceCallShowJoinUi` above
   * (which also drives the join chime/invitation, deliberately left unwidened: a lone stale
   * self-presence with nobody else in the room isn't "someone joined," so it shouldn't chime),
   * this also covers the case where the only "call in progress" signal is the local user's own
   * stale presence.
   */
  const spaceCallShowRefreshUi =
    spaceCallShowJoinUi ||
    (showSidebarCallChrome &&
      spaceCallShowJoinStrip &&
      spaceCallSelfStalePresence &&
      !inSpaceCall);

  const spaceCallShowJoinChime = spaceCallShowJoinUi;

  const joinChimeNotification = useMemo(
    () => ({
      title: t('callJoinNotificationTitle'),
      body: t('callJoinNotificationBody', {
        count: spaceCallRoomGroupDeviceCount,
      }),
    }),
    [t, spaceCallRoomGroupDeviceCount],
  );

  const callJoinNotificationTarget = useMemo(() => {
    const slug = spaceSlug?.trim();
    const rid = roomId?.trim();
    if (!slug || !rid) return null;
    return {
      lang: getLocaleFromPath(pathname),
      spaceSlug: slug,
      roomId: rid,
      signalSlug: mode === 'coherence' ? coherenceSlug?.trim() || null : null,
    };
  }, [spaceSlug, roomId, pathname, mode, coherenceSlug]);

  const { joinAlertSoundEnabled, setJoinAlertSoundEnabled } = useCallJoinChime({
    callUiEnabled,
    roomId,
    showJoinOpportunity: spaceCallShowJoinChime,
    roomCallDeviceCount: spaceCallRoomGroupDeviceCount,
    notification: joinChimeNotification,
    notificationTarget: callJoinNotificationTarget,
    matrixSessionReady: isMatrixAuthenticated && Boolean(client),
  });

  const showJoinInvitationOpportunity = spaceCallShowJoinUi;
  const {
    open: joinInviteOpen,
    dismiss: dismissJoinInvite,
    setOpen: setJoinInviteOpen,
  } = useCallJoinInvitation({
    roomId,
    showJoinOpportunity: showJoinInvitationOpportunity,
  });
  const showCallScaleWarning = shouldShowCallScaleWarning(
    spaceCallRoomGroupDeviceCount,
  );
  const [signalDeepLinkNotice, setSignalDeepLinkNotice] = useState<
    string | null
  >(null);
  const signalDeepLinkEpochRef = useRef(0);
  const previousSignalChatSlugRef = useRef<string | null | undefined>(
    undefined,
  );
  const previousSignalUrlSlugRef = useRef<string | null | undefined>(undefined);
  const previousSignalChoiceRef = useRef<string | null>(null);

  /** Leave signal/coherence chat without the deep-link effect re-opening from `?signal=`. */
  const exitCoherenceChat = useCallback(() => {
    signalDeepLinkEpochRef.current += 1;
    setSignalDeepLinkNotice(null);
    setIsJoining(false);

    const hasSignalDeepLink =
      Boolean(readLiveSearchParam('signal')) ||
      Boolean(readLiveSearchParam('msg'));
    if (hasSignalDeepLink) {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('signal');
      next.delete('msg');
      const qs = next.toString();
      const cleaned = qs ? `${pathname}?${qs}` : pathname;
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', cleaned);
      }
      router.replace(cleaned, { scroll: false });
    }

    closeCoherenceChat();
    if (isConnectionsPage) {
      closeHumanChatPanel();
      setOpenMobile(false);
    }
  }, [
    closeCoherenceChat,
    closeHumanChatPanel,
    isConnectionsPage,
    pathname,
    router,
    searchParams,
    setOpenMobile,
  ]);

  const pendingCallStartNotifyRef = useRef(false);
  const callStartedNotifyRoomRef = useRef<string | null>(null);

  const markPendingCallStartNotify = useCallback(() => {
    if (!spaceCallShowJoinStrip) {
      pendingCallStartNotifyRef.current = true;
    }
  }, [spaceCallShowJoinStrip]);

  const spaceCallBusyJoining =
    spaceCallState === 'initializing' ||
    spaceCallState === 'awaiting_media' ||
    spaceCallState === 'connecting';

  const resolveCallLaunchContext = useCallback(() => {
    return mode === 'coherence' && coherenceTitle?.trim()
      ? {
          signalTitle: coherenceTitle.trim(),
          signalSlug: coherenceSlug?.trim() || undefined,
          roomTitle: coherenceTitle.trim(),
        }
      : (() => {
          const roomTitle = resolveCallRecordingRoomTitle(
            client,
            roomId,
            space?.title,
          );
          return roomTitle ? { roomTitle } : undefined;
        })();
  }, [client, coherenceSlug, coherenceTitle, mode, roomId, space?.title]);

  const peerPersonId =
    isDirectConversation &&
    coherencePeerPerson?.id &&
    coherencePeerPerson.id > 0
      ? coherencePeerPerson.id
      : null;
  const peerPersonIds = useMemo(
    () => (peerPersonId ? [peerPersonId] : []),
    [peerPersonId],
  );
  const {
    personIdToMatrixUserId: peerPersonIdToMatrixUserId,
    isLoading: peerMatrixIdsLoading,
  } = useMatrixUserIdsByPersonIds({
    personIds: peerPersonIds,
  });
  const peerMatrixIdsRef = useRef(peerPersonIdToMatrixUserId);
  peerMatrixIdsRef.current = peerPersonIdToMatrixUserId;
  const peerMatrixIdsLoadingRef = useRef(peerMatrixIdsLoading);
  peerMatrixIdsLoadingRef.current = peerMatrixIdsLoading;
  const personPanelCallEnsureGenerationRef = useRef(0);
  const personPanelCallSelectionRef = useRef(
    personPanelCallSelectionOf({
      personId: peerPersonId,
      title: coherenceTitle,
      roomId,
      coherenceRoomId,
    }),
  );
  personPanelCallSelectionRef.current = personPanelCallSelectionOf({
    personId: peerPersonId,
    title: coherenceTitle,
    roomId,
    coherenceRoomId,
  });

  const refusePersonPanelCallStart = useCallback(() => {
    setError(tMember('matrixPersonUnavailable'));
    if (shouldLeaveCallOnPersonPanelRefuse(callSessionRoomId, roomId)) {
      void leaveSpaceCall();
    }
    dismissSpaceCallError();
  }, [
    callSessionRoomId,
    dismissSpaceCallError,
    leaveSpaceCall,
    roomId,
    tMember,
  ]);

  const waitForPeerMatrixUserId = useCallback(async (personId: number) => {
    let sawLoading = peerMatrixIdsLoadingRef.current;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const mxid = peerMatrixIdsRef.current[personId]?.trim();
      if (mxid) return mxid;
      if (peerMatrixIdsLoadingRef.current) sawLoading = true;
      if (sawLoading && !peerMatrixIdsLoadingRef.current) return null;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return peerMatrixIdsRef.current[personId]?.trim() || null;
  }, []);

  const bindEnsuredPersonPanelRoom = useCallback(
    (ensuredRoomId: string) => {
      const title = coherenceTitle?.trim() || '';
      openCoherenceChat(ensuredRoomId, title, '', null, null, {
        peerPerson: coherencePeerPerson,
      });
      setRoomId(ensuredRoomId);
      bindRoomContext(ensuredRoomId, null, authToken?.trim() || null);
    },
    [
      authToken,
      bindRoomContext,
      coherencePeerPerson,
      coherenceTitle,
      openCoherenceChat,
    ],
  );

  const ensurePersonPanelCallRoom = useCallback(
    async (isSelectionCurrent: () => boolean) => {
      const personId = peerPersonId;
      const title = coherenceTitle?.trim() || '';
      const matched = matchedDirectRoomId(roomId, coherenceRoomId);
      if (personId) {
        try {
          const ensured = await openOrEnsurePersonRoom({
            getMatrix: () => matrixRef.current,
            personId,
            title,
            waitForMatrixUserId: waitForPeerMatrixUserId,
          });
          if (!isSelectionCurrent()) throw new PersonPanelCallAborted();
          rememberPersonDirectRoom(personId, ensured);
          bindEnsuredPersonPanelRoom(ensured);
          return ensured;
        } catch (error) {
          if (error instanceof PersonPanelCallAborted) throw error;
          if (!matched) throw error;
        }
      }
      if (matched) {
        try {
          await matrixRef.current.joinRoom(matched);
        } catch {
          // Already joined; the ids already agree so this is a real current DM.
        }
        if (!isSelectionCurrent()) throw new PersonPanelCallAborted();
        bindEnsuredPersonPanelRoom(matched);
        return matched;
      }
      throw new Error('Person panel call has no DM room to ensure');
    },
    [
      bindEnsuredPersonPanelRoom,
      coherenceRoomId,
      coherenceTitle,
      peerPersonId,
      roomId,
      waitForPeerMatrixUserId,
    ],
  );

  const launchPersonPanelCall = useCallback(
    (kind: 'audio' | 'video', targetRoomId: string) => {
      const callRoomId = targetRoomId.trim();
      if (!callRoomId) return;
      if (inSpaceCall) return;
      markPendingCallStartNotify();
      const launchContext = resolveCallLaunchContext();
      if (spaceCallSelfStalePresence) {
        refreshSpaceCall(
          kind,
          callRoomId,
          callSpaceSlug,
          undefined,
          authToken,
          launchContext,
        );
        return;
      }
      const start = kind === 'audio' ? startAudioForRoom : startVideoForRoom;
      void start(
        callRoomId,
        callSpaceSlug,
        undefined,
        authToken,
        launchContext,
      );
    },
    [
      authToken,
      callSpaceSlug,
      inSpaceCall,
      markPendingCallStartNotify,
      refreshSpaceCall,
      resolveCallLaunchContext,
      spaceCallSelfStalePresence,
      startAudioForRoom,
      startVideoForRoom,
    ],
  );

  const startPersonPanelCall = useCallback(
    (kind: 'audio' | 'video') => {
      const plan = planPersonPanelCall({
        isDirectConversation,
        roomId,
        coherenceRoomId,
        hasHumanMessages,
      });
      const generation = ++personPanelCallEnsureGenerationRef.current;
      const started = personPanelCallSelectionRef.current;
      const isSelectionCurrent = () =>
        personPanelCallEnsureGenerationRef.current === generation &&
        personPanelCallSelectionMatches(
          started,
          personPanelCallSelectionRef.current,
        );
      void runPersonPanelCallPlan({
        plan,
        ensureRoom: () => ensurePersonPanelCallRoom(isSelectionCurrent),
        isSelectionCurrent,
        onRefuse: refusePersonPanelCallStart,
        onStart: (targetRoomId) => {
          if (!isSelectionCurrent()) return;
          launchPersonPanelCall(kind, targetRoomId);
        },
      }).catch((error) => {
        if (error instanceof PersonPanelCallAborted) return;
        if (
          error instanceof OpenPersonRoomFailure &&
          error.code === 'no-matrix-id'
        ) {
          setError(tMember('matrixPersonUnavailable'));
          return;
        }
        setError(tMember('callFailed'));
      });
    },
    [
      coherenceRoomId,
      ensurePersonPanelCallRoom,
      hasHumanMessages,
      isDirectConversation,
      launchPersonPanelCall,
      refusePersonPanelCallStart,
      roomId,
      tMember,
    ],
  );

  const handleCallAudio = useCallback(() => {
    startPersonPanelCall('audio');
  }, [startPersonPanelCall]);

  const handleCallVideo = useCallback(() => {
    startPersonPanelCall('video');
  }, [startPersonPanelCall]);

  /**
   * "Join this room's call instead" — for the case where the room being viewed has its own
   * active call but the user is already bound to a call in a *different* room.
   * `startAudioForRoom`/`startVideoForRoom` silently no-op while pinned to another room
   * (see `global-call-dock-context.tsx`), so the old call must actually end first. But
   * `callSessionRoomId` only clears via a `useEffect` reacting to `call.callState === 'idle'`,
   * not synchronously when `leave()`'s promise resolves — awaiting the promise and then
   * immediately calling `handleCallAudio`/`handleCallVideo` would race that and likely fail
   * on the first click. Instead, record the intent and let an effect fire the join once
   * `callSessionRoomId` has actually cleared.
   */
  const [pendingCallSwitch, setPendingCallSwitch] = useState<{
    kind: 'audio' | 'video';
    roomId: string;
  } | null>(null);

  const handleJoinCurrentRoomCallInstead = useCallback(
    (kind: 'audio' | 'video') => {
      if (callSessionRoomId && callSessionRoomId !== roomId) {
        const targetRoomId = roomId;
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
        handleCallAudio();
      } else {
        handleCallVideo();
      }
    },
    [
      callSessionRoomId,
      roomId,
      leaveSpaceCall,
      handleCallAudio,
      handleCallVideo,
    ],
  );

  useEffect(() => {
    if (!pendingCallSwitch) return;
    // User navigated away from the room they meant to join before the leave completed —
    // abandon the switch instead of joining whatever room happens to be open now.
    if (pendingCallSwitch.roomId !== roomId) {
      setPendingCallSwitch(null);
      return;
    }
    if (callSessionRoomId && callSessionRoomId !== roomId) return;
    const { kind } = pendingCallSwitch;
    setPendingCallSwitch(null);
    if (kind === 'audio') {
      handleCallAudio();
    } else {
      handleCallVideo();
    }
  }, [
    pendingCallSwitch,
    callSessionRoomId,
    roomId,
    handleCallAudio,
    handleCallVideo,
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

  const {
    onStartScreenshare: handleCallStartScreenshare,
    onStopScreenshare: handleCallStopScreenshare,
    screenshareTabAudioPromptDialog,
  } = useScreenshareTabAudioPrompt({
    isScreensharing: spaceCallScreensharing,
    remoteScreenshareActive: spaceCallRemoteScreenshareActive,
    setScreensharingEnabled: setSpaceCallScreensharingEnabled,
    toggleScreensharing: toggleSpaceCallScreensharing,
  });

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
  /** Bumps on tab focus / visibility to re-resolve sender labels after idle JWT or roster revalidation. */
  const [memberLabelEpoch, setMemberLabelEpoch] = useState(0);
  const [matrixProfileLabelByUserId, setMatrixProfileLabelByUserId] = useState<
    Record<string, string>
  >({});
  const profileLookupInFlightRef = useRef<Set<string>>(new Set());
  const profileLookupAttemptedRef = useRef<Set<string>>(new Set());

  const { data: directoryHome } = useSWR<MemberIntelligence | null>(
    isDirectConversation && authToken
      ? ['/api/v1/people/me/intelligence', authToken]
      : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
  );
  const directoryPersonIds = useMemo(() => {
    if (!directoryHome) return [];
    return [
      directoryHome.person?.id,
      ...(directoryHome.connections ?? []).map((person) => person.id),
    ].filter((id): id is number => Number.isFinite(id) && id > 0);
  }, [directoryHome]);
  const { personIdToMatrixUserId: directoryMxids } =
    useMatrixUserIdsByPersonIds({
      personIds: directoryPersonIds,
    });
  const roomMemberMxids = useMemo(() => {
    if (!isDirectConversation || !client || !roomId) return [];
    const room = client.getRoom(roomId);
    if (!room) return [];
    return room
      .getMembers()
      .map((member) => member.userId?.trim())
      .filter((id): id is string => Boolean(id));
  }, [client, isDirectConversation, mentionMembershipEpoch, roomId]);
  const roomMemberSubs = useMemo(
    () => uniqueCanonicalPrivySubsFromMxids(roomMemberMxids),
    [roomMemberMxids],
  );
  const { peopleBySub: roomPeopleBySub } = usePeopleBySubs({
    subs: isDirectConversation ? roomMemberSubs : [],
  });
  const roomPersonByMxid = useMemo(() => {
    const byMxid = new Map<
      string,
      {
        label: string;
        nickname: string | null;
        slug: string | null;
      }
    >();
    for (const userId of roomMemberMxids) {
      const sub = matrixUserIdToCanonicalPrivySub(userId);
      const person = sub ? roomPeopleBySub.get(sub) : undefined;
      if (!person) continue;
      const label =
        [person.name, person.surname].filter(Boolean).join(' ').trim() ||
        person.nickname?.trim() ||
        '';
      if (!label) continue;
      byMxid.set(userId, {
        label,
        nickname: person.nickname,
        slug: person.slug,
      });
    }
    return byMxid;
  }, [roomMemberMxids, roomPeopleBySub]);
  const directoryLabelByMxid = useMemo(() => {
    const labels = new Map<string, string>();
    for (const [userId, profile] of roomPersonByMxid) {
      labels.set(userId, profile.label);
    }
    if (!directoryHome) return labels;
    const people = [
      directoryHome.person,
      ...(directoryHome.connections ?? []),
    ].filter((person): person is NonNullable<typeof person> => Boolean(person));
    for (const person of people) {
      const mxid = directoryMxids[person.id]?.trim();
      const label =
        [person.name, person.surname].filter(Boolean).join(' ').trim() ||
        person.nickname?.trim();
      if (mxid && label) labels.set(mxid, label);
    }
    return labels;
  }, [directoryHome, directoryMxids, roomPersonByMxid]);

  const rosterSubs = useMemo(
    () =>
      spaceMembers
        .map((p) => p.sub?.trim())
        .filter((s): s is string => Boolean(s)),
    [spaceMembers],
  );
  const rosterPersonIds = useMemo(
    () =>
      spaceMembers
        .map((p) => p.id)
        .filter((id): id is number => Number.isFinite(id) && id > 0),
    [spaceMembers],
  );

  const { subToMatrixUserId } = useMatrixUserIdsByPrivySubs({
    privySubs: rosterSubs,
  });
  const {
    personIdToMatrixUserId,
    isLoading: isLoadingMatrixUserIds,
    error: matrixUserIdsError,
  } = useMatrixUserIdsByPersonIds({
    personIds: rosterPersonIds,
  });

  /** Same source as `@` mention labels: Hypha roster wins over Matrix bridge displaynames. */
  const matrixUserIdToPersonLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of spaceMembers) {
      let mxid = personIdToMatrixUserId[p.id]?.trim();
      if (!mxid) {
        const sub = p.sub?.trim();
        if (sub) mxid = subToMatrixUserId[sub]?.trim();
      }
      if (!mxid) continue;
      m.set(mxid, personRosterLabel(p, t('unknownMember')));
    }
    return m;
  }, [spaceMembers, personIdToMatrixUserId, subToMatrixUserId, t]);

  /** Hypha profile photos keyed by Matrix MXID — preferred over Matrix MXC avatars in the timeline. */
  const matrixUserIdToPersonAvatar = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of spaceMembers) {
      const url = p.avatarUrl?.trim();
      if (!url) continue;
      let mxid = personIdToMatrixUserId[p.id]?.trim();
      if (!mxid) {
        const sub = p.sub?.trim();
        if (sub) mxid = subToMatrixUserId[sub]?.trim();
      }
      if (!mxid) continue;
      m.set(mxid, url);
    }
    return m;
  }, [spaceMembers, personIdToMatrixUserId, subToMatrixUserId]);

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

  const personAvatarByPrivySub = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of spaceMembers) {
      const sub = p.sub?.trim();
      const url = p.avatarUrl?.trim();
      if (!sub || !url) continue;
      m.set(sub, url);
    }
    return m;
  }, [spaceMembers]);

  const matrixLocalpartToPrivySub = useCallback(
    (userId: string): string | null => {
      return matrixUserIdToCanonicalPrivySub(userId);
    },
    [],
  );

  const resolveMemberLabel = useCallback(
    (userId: string | undefined) => {
      if (!userId) return t('unknownMember');
      if (isHyphaBotMatrixIdentity(userId)) {
        return t('agentMentionLabel');
      }
      if (currentUserId && userId === currentUserId) {
        const full = [me?.name, me?.surname].filter(Boolean).join(' ').trim();
        return full || t('you');
      }
      const directoryLabel = directoryLabelByMxid.get(userId)?.trim();
      if (directoryLabel) return directoryLabel;
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
      return visibleMatrixMemberName(userId, profileLabel);
    },
    [
      client,
      currentUserId,
      directoryLabelByMxid,
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

  /** Hypha `Person.avatarUrl` first — Matrix MXC is only a fallback in `toUIMessage`. */
  const resolveMemberAvatar = useCallback(
    (userId: string | undefined) => {
      if (!userId) return undefined;
      if (currentUserId && userId === currentUserId) {
        return currentUserAvatarUrl?.trim() || undefined;
      }
      const fromRoster = matrixUserIdToPersonAvatar.get(userId)?.trim();
      if (fromRoster) return fromRoster;
      const localpartSub = matrixLocalpartToPrivySub(userId);
      if (localpartSub) {
        const bySub = personAvatarByPrivySub.get(localpartSub)?.trim();
        if (bySub) return bySub;
      }
      return undefined;
    },
    [
      currentUserAvatarUrl,
      currentUserId,
      matrixLocalpartToPrivySub,
      matrixUserIdToPersonAvatar,
      personAvatarByPrivySub,
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
    // PM / group chat: only people actually in this Matrix room — never the
    // space roster (that wrongly lets you @ people who are not in the DM).
    if (isDirectConversation) {
      if (!client || !roomId) return [];
      const room = client.getRoom(roomId);
      if (!room) return [];
      const list: ChatMentionCandidate[] = [];
      for (const member of room.getMembers()) {
        const membership = member.membership;
        if (membership !== 'join' && membership !== 'invite') continue;
        const userId = member.userId?.trim();
        if (!userId) continue;
        if (currentUserId && userId === currentUserId) continue;
        const profile = roomPersonByMxid.get(userId);
        list.push({
          userId,
          displayLabel:
            directoryLabelByMxid.get(userId) ||
            profile?.label ||
            matrixMemberDisplayLabel(member, userId),
          nickname: profile?.nickname,
          slug: profile?.slug,
        });
      }
      list.sort((left, right) =>
        left.displayLabel.localeCompare(right.displayLabel, undefined, {
          sensitivity: 'base',
        }),
      );
      return list;
    }
    const candidates = buildSpaceRosterMentionCandidates({
      spaceMembers,
      personIdToMatrixUserId,
      unknownLabel: t('unknownMember'),
    });
    if (!currentUserId) return candidates;
    return candidates.filter((candidate) => candidate.userId !== currentUserId);
  }, [
    client,
    currentUserId,
    directoryLabelByMxid,
    isDirectConversation,
    roomPersonByMxid,
    mentionMembershipEpoch,
    personIdToMatrixUserId,
    roomId,
    spaceMembers,
    t,
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
  const hasSignalTeamPolicy =
    isSignalThread &&
    (signalTeamMemberIds.length > 0 || !signalTeamRosterResolved);
  const signalTeamMemberIdSet = useMemo(
    () => new Set(signalTeamMemberIds),
    [signalTeamMemberIds],
  );
  const isCurrentUserSignalTeamMember = Boolean(
    currentUserId && signalTeamMemberIdSet.has(currentUserId),
  );
  const canInteractWithSignalThread =
    !isSignalThread || !hasSignalTeamPolicy || isCurrentUserSignalTeamMember;
  const archivedGroup =
    isDirectConversation &&
    isArchivedGroupRoom(client?.getRoom(roomId ?? undefined));
  const chatComposerLocked =
    isJoining ||
    blockSpaceChatForMembership ||
    !canInteractWithSignalThread ||
    archivedGroup;
  const chatComposerLockedMessage = blockSpaceChatForMembership
    ? tCommon('joinSpaceToUse')
    : archivedGroup
    ? t('archivedGroupReadOnly')
    : !canInteractWithSignalThread
    ? t('signalTeamInteractionRestricted')
    : undefined;
  const canJoinSignalThreadCall =
    !isSignalThread || !hasSignalTeamPolicy || isCurrentUserSignalTeamMember;

  useEffect(() => {
    if (spaceCallState !== 'connected') return;
    if (!pendingCallStartNotifyRef.current) return;
    if (!callUiEnabled || !roomId?.trim() || !callSpaceSlug || !authToken) {
      return;
    }

    const stableRoomId = roomId.trim();
    if (callStartedNotifyRoomRef.current === stableRoomId) return;

    pendingCallStartNotifyRef.current = false;
    callStartedNotifyRoomRef.current = stableRoomId;

    const lang = getLocaleFromPath(pathname);
    const target = callJoinNotificationTarget;
    const relativePath =
      target?.spaceSlug?.trim() && target.lang?.trim()
        ? buildCallJoinHref(target)
        : buildCallJoinHref({
            lang,
            spaceSlug: callSpaceSlug,
            roomId: stableRoomId,
            signalSlug:
              mode === 'coherence' ? coherenceSlug?.trim() || null : null,
          });
    const deepLink =
      typeof window !== 'undefined'
        ? `${window.location.origin}${relativePath}`
        : relativePath;
    const actorDisplayName =
      [me?.name, me?.surname].filter(Boolean).join(' ').trim() ||
      me?.nickname?.trim() ||
      t('you');
    const contextLabel =
      mode === 'coherence'
        ? coherenceTitle?.trim() || coherenceSlug?.trim() || space?.title
        : space?.title?.trim() || callSpaceSlug;

    void notifyCallStarted({
      actorSlug: me?.slug,
      actorDisplayName,
      spaceSlug: callSpaceSlug,
      contextLabel,
      scope:
        isSignalThread && hasSignalTeamPolicy ? 'signal_team' : 'space_members',
      targetMatrixUserIds:
        isSignalThread && hasSignalTeamPolicy
          ? signalTeamMemberIds.filter((id) => id !== currentUserId)
          : undefined,
      url: deepLink,
    }).catch((notifyErr) => {
      console.warn(
        '[HumanRightPanel] Call-start notification dispatch failed:',
        notifyErr,
      );
    });
  }, [
    authToken,
    callJoinNotificationTarget,
    callUiEnabled,
    coherenceSlug,
    coherenceTitle,
    currentUserId,
    hasSignalTeamPolicy,
    isSignalThread,
    me?.name,
    me?.nickname,
    me?.slug,
    me?.surname,
    mode,
    notifyCallStarted,
    pathname,
    roomId,
    signalTeamMemberIds,
    space?.title,
    spaceCallState,
    callSpaceSlug,
    t,
  ]);

  useEffect(() => {
    if (
      spaceCallState === 'idle' ||
      spaceCallState === 'error' ||
      spaceCallState === 'disconnecting'
    ) {
      pendingCallStartNotifyRef.current = false;
      callStartedNotifyRoomRef.current = null;
    }
  }, [spaceCallState]);

  const mentionCandidates = useMemo((): ChatMentionCandidate[] => {
    const roster = isSignalThread
      ? rawMentionCandidates.filter((candidate) =>
          signalTeamMemberIdSet.has(candidate.userId),
        )
      : rawMentionCandidates;
    const networkRoom = mode === 'space' && !spaceSlug?.trim();
    const agentIcon: ChatMentionAgentIcon =
      networkRoom || isDirectConversation || !spaceSlug?.trim()
        ? { kind: 'network' }
        : {
            kind: 'space',
            logoUrl: resolveSpaceDisplayLogoUrl(
              space,
              resolvedTheme === 'dark' ? 'dark' : 'light',
            ),
          };
    return withMatrixAgentMention(
      roster,
      t('agentMentionLabel'),
      matrixAgentSkills(t),
      agentIcon,
    );
  }, [
    isDirectConversation,
    isSignalThread,
    mode,
    rawMentionCandidates,
    resolvedTheme,
    signalTeamMemberIdSet,
    space,
    spaceSlug,
    t,
  ]);

  const mentionLabelByUserId = useMemo(
    () =>
      new Map(
        mentionCandidates.map((candidate) => {
          const o = mentionDisplayOverride[candidate.userId];
          if (o?.trim()) return [candidate.userId, o] as const;
          // AI Agents keeps its picker label — resolveMemberLabel falls back to the
          // Matrix localpart (e.g. hypha_bot_preview) for the bot MXID.
          if (candidate.rowKey === 'agent') {
            const agentLabel = candidate.displayLabel?.trim();
            if (agentLabel) return [candidate.userId, agentLabel] as const;
          }
          const resolved = resolveMemberLabel(candidate.userId)?.trim();
          if (resolved) return [candidate.userId, resolved] as const;
          return [
            candidate.userId,
            candidate.displayLabel?.trim() || '',
          ] as const;
        }),
      ),
    [mentionCandidates, mentionDisplayOverride, resolveMemberLabel],
  );

  const composerMentionCandidates = useMemo(
    () =>
      mentionCandidates.map((candidate) => {
        if (candidate.agentIcon || candidate.rowKey === 'agent') {
          return candidate;
        }
        const resolved = mentionLabelByUserId.get(candidate.userId)?.trim();
        if (!resolved || resolved === candidate.displayLabel) return candidate;
        return { ...candidate, displayLabel: resolved };
      }),
    [mentionCandidates, mentionLabelByUserId],
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

  /** Composer tokens for edit use the same disambiguated keys as the send map. */
  const mentionComposerTokenLabelByUserId = useMemo(
    () =>
      new Map(
        [...mentionLabelByUserId].map(([userId, label]) => [
          userId,
          disambiguatedMentionTokenKey(
            userId,
            label,
            duplicateSanitizedDisplayKeys,
          ),
        ]),
      ),
    [mentionLabelByUserId, duplicateSanitizedDisplayKeys],
  );

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
      return pickUserVisibleMemberLabel(id, mentionLabel, resolved) ?? '';
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

  const messagesRoomIdRef = useRef<string | null>(null);
  const syncRoomMessages = useCallback((targetRoomId: string) => {
    const existing = matrixRef.current.getRoomMessages(targetRoomId);
    if (!existing) return;
    setMessages((prev) => {
      if (
        existing.length === 0 &&
        prev.length > 0 &&
        messagesRoomIdRef.current === targetRoomId
      ) {
        return prev;
      }
      messagesRoomIdRef.current = targetRoomId;
      return sortMessagesChronologically(
        existing.map((m) =>
          toUIMessage(
            m,
            currentUserIdRef.current,
            resolveMemberLabelRef.current,
            currentUserAvatarUrlRef.current,
            resolveMemberAvatarRef.current,
            targetRoomId,
            matrixRef.current.client ?? null,
            formatSignalTeamNoticeRef.current,
            systemSenderLabelRef.current,
          ),
        ),
      );
    });
  }, []);

  /**
   * Paint whatever timeline we already have, then fill history without leaving
   * the "start a conversation" welcome up while /sync or scrollback is still due.
   */
  const revealRoomTimeline = useCallback(
    async (targetRoomId: string, isCancelled: () => boolean) => {
      const messageCount = () => {
        try {
          return matrixRef.current.getRoomMessages(targetRoomId)?.length ?? 0;
        } catch {
          return 0;
        }
      };
      const paint = () => {
        try {
          syncRoomMessages(targetRoomId);
        } catch (error) {
          console.warn('[HumanRightPanel] Timeline not ready to paint:', error);
        }
      };

      paint();
      if (messageCount() > 0) {
        if (!isCancelled()) setIsJoining(false);
        try {
          const historyResult = await matrixRef.current.loadRoomHistory(
            targetRoomId,
            { pageSize: 30, maxBatches: 1 },
          );
          if (isCancelled()) return;
          setHasMoreOlderMessages(historyResult.hasMoreOlder);
          paint();
        } catch (error) {
          if (!isCancelled()) {
            console.warn(
              '[HumanRightPanel] Background chat history load failed:',
              error,
            );
          }
        }
        return;
      }

      const deadline = Date.now() + 8000;
      let hasMoreOlder = true;
      while (!isCancelled() && Date.now() < deadline) {
        try {
          const historyResult = await matrixRef.current.loadRoomHistory(
            targetRoomId,
            { pageSize: 30, maxBatches: 1 },
          );
          hasMoreOlder = historyResult.hasMoreOlder;
          paint();
          if (messageCount() > 0 || !hasMoreOlder) break;
        } catch (error) {
          if (messageCount() > 0) break;
          console.warn('[HumanRightPanel] Waiting for chat history:', error);
        }
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      if (isCancelled()) return;
      setHasMoreOlderMessages(hasMoreOlder);
      setIsJoining(false);
    },
    [syncRoomMessages],
  );

  const handleLoadOlderMessages = useCallback(
    async (source: 'auto' | 'manual' = 'manual') => {
      const targetRoomId = roomId?.trim();
      if (!targetRoomId || loadingOlderMessages || !hasMoreOlderMessages) {
        return;
      }
      setLoadingOlderMessages(true);
      try {
        const result = await matrixRef.current.loadRoomHistory(targetRoomId, {
          force: true,
          maxBatches: 5,
        });
        syncRoomMessages(targetRoomId);
        setHasMoreOlderMessages(result.hasMoreOlder);
        if (
          source === 'auto' &&
          result.addedEvents === 0 &&
          result.hasMoreOlder
        ) {
          setAutoLoadOlderPaused(true);
        } else if (result.addedEvents > 0) {
          setAutoLoadOlderPaused(false);
        }
        return result;
      } catch (err) {
        console.warn(
          '[HumanRightPanel] Failed to load older chat history:',
          err,
        );
        if (source === 'auto') {
          setAutoLoadOlderPaused(true);
        }
        return undefined;
      } finally {
        setLoadingOlderMessages(false);
      }
    },
    [hasMoreOlderMessages, loadingOlderMessages, roomId, syncRoomMessages],
  );

  /** `@` when there is anyone to mention (joined members and/or roster-linked MXIDs). */
  const mentionPickerEnabled =
    canInteractWithSignalThread && mentionCandidates.length > 0;
  const signalTeamRosterMembers = useMemo(
    () =>
      buildSpaceRosterSignalTeamMembers({
        spaceMembers,
        personIdToMatrixUserId,
        unknownLabel: t('unknownMember'),
      }),
    [spaceMembers, personIdToMatrixUserId, t],
  );
  const signalTeamSelectableMembers = useMemo((): ChatMentionCandidate[] => {
    const extraCandidates: ChatMentionCandidate[] = [];
    if (currentUserId) {
      const alreadyListed = spaceMembers.some(
        (member) => personIdToMatrixUserId[member.id]?.trim() === currentUserId,
      );
      if (!alreadyListed) {
        extraCandidates.push({
          userId: currentUserId,
          displayLabel:
            [me?.name, me?.surname].filter(Boolean).join(' ').trim() ||
            me?.nickname?.trim() ||
            t('you'),
          avatarUrl: me?.avatarUrl,
        });
      }
    }

    return buildSpaceRosterMentionCandidates({
      spaceMembers,
      personIdToMatrixUserId,
      unknownLabel: t('unknownMember'),
      extraCandidates,
    });
  }, [
    spaceMembers,
    personIdToMatrixUserId,
    currentUserId,
    me?.name,
    me?.surname,
    me?.nickname,
    me?.avatarUrl,
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
        await client.sendEvent(roomId, EventType.RoomMessage, {
          msgtype: MsgType.Notice,
          body: SIGNAL_TEAM_EVENT_BODY_MARKER,
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
        body: SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER,
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
            body: SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER,
            coherenceSlug: coherenceSlug?.trim() || null,
            requesterMatrixUserId: requesterId,
            status: 'approved',
            updatedAt: new Date().toISOString(),
          } as SignalTeamEventContent),
          client.sendEvent(roomId, EventType.RoomMessage, {
            msgtype: MsgType.Notice,
            body: SIGNAL_TEAM_EVENT_BODY_MARKER,
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
    if (!client || !roomId || !isSignalThread) {
      setSignalTeamMemberIds([]);
      setSignalTeamOwnerId(null);
      setSignalTeamPendingRequesterIds([]);
      setSignalTeamDraftMemberIds(null);
      setSignalTeamRosterResolved(true);
      return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
      setSignalTeamMemberIds([]);
      setSignalTeamOwnerId(null);
      setSignalTeamPendingRequesterIds([]);
      setSignalTeamRosterResolved(false);
      return;
    }

    let cancelled = false;
    setSignalTeamRosterResolved(false);
    const seedKey = signalTeamDocumentSeedKey(roomId, coherenceSlug);
    documentSeedRef.current = retainSignalTeamDocumentSeed(
      documentSeedRef.current,
      seedKey,
    );
    const documentSeed = documentSeedRef.current;

    const applyFromTimeline = (): {
      usable: boolean;
      keptValidatedRoster: boolean;
      hasTrustedRoster: boolean;
      hasTrustedMembers: boolean;
    } => {
      const timeline = room.getLiveTimeline().getEvents();
      const next = deriveSignalTeamStateFromEvents(
        timeline,
        coherenceSlug,
        room,
      );
      const usable = rosterIdsIntersectSpaceMap(
        next.memberMatrixUserIds,
        personIdToMatrixUserId,
      );
      const hasTrustedMembers =
        next.hasTrustedRoster && next.memberMatrixUserIds.length > 0;
      // Map lookup failed: keep sender-validated timeline MXIDs so
      // currentUserId membership checks still apply. Do not clear.
      const keepDespiteMapFailure =
        Boolean(matrixUserIdsError) && hasTrustedMembers;
      // Trusted notice whose members left the space: still keep those MXIDs
      // so a non-member viewer cannot pass the membership check.
      if (usable || keepDespiteMapFailure || hasTrustedMembers) {
        setSignalTeamMemberIds(next.memberMatrixUserIds);
        setSignalTeamOwnerId(next.ownerMatrixUserId);
      } else if (next.hasTrustedRoster) {
        // Explicit trusted-empty `memberMatrixUserIds: []` only. Marker-only
        // or request notices must not clear a fresh create seed.
        documentSeed.memberIds = [];
        documentSeed.ownerId = null;
        setSignalTeamMemberIds([]);
        setSignalTeamOwnerId(null);
        setSignalTeamRosterResolved(false);
      } else if (documentSeed.memberIds.length > 0) {
        setSignalTeamMemberIds(documentSeed.memberIds);
        setSignalTeamOwnerId(documentSeed.ownerId);
      } else {
        setSignalTeamMemberIds([]);
        setSignalTeamOwnerId(null);
      }
      setSignalTeamPendingRequesterIds(next.pendingRequesterIds);
      if (!signalTeamPanelOpenRef.current) {
        setSignalTeamDraftMemberIds(null);
      }
      return {
        usable,
        keptValidatedRoster: keepDespiteMapFailure,
        hasTrustedRoster: next.hasTrustedRoster,
        hasTrustedMembers,
      };
    };

    const seedFromDocumentAssignees = async (): Promise<
      'seeded' | 'empty' | 'failed' | 'kept-timeline' | 'kept-empty-trusted'
    > => {
      const slug = coherenceSlug?.trim();
      if (!slug) return 'failed';
      try {
        const signal = await getCoherenceBySlug({ slug });
        if (cancelled) return 'failed';
        // A roster notice may have landed during the lookup — keep it.
        const applied = applyFromTimeline();
        if (
          applied.usable ||
          applied.keptValidatedRoster ||
          applied.hasTrustedMembers
        ) {
          return 'kept-timeline';
        }
        // Trusted empty roster — do not seed the viewer or resolve open.
        if (applied.hasTrustedRoster) {
          return 'kept-empty-trusted';
        }
        const personIds = [
          ...new Set(
            [...(signal?.assigneeIds ?? []), signal?.creatorId, me?.id].filter(
              (id): id is number => typeof id === 'number' && id > 0,
            ),
          ),
        ];
        const memberIds = matrixUserIdsForPersonIds(
          personIds,
          personIdToMatrixUserId,
        );
        const ownerId =
          (typeof signal?.creatorId === 'number'
            ? personIdToMatrixUserId[signal.creatorId]?.trim()
            : '') ||
          (typeof me?.id === 'number'
            ? personIdToMatrixUserId[me.id]?.trim()
            : '') ||
          memberIds[0] ||
          null;
        if (memberIds.length === 0) return 'empty';
        documentSeed.memberIds = memberIds;
        documentSeed.ownerId = ownerId;
        setSignalTeamMemberIds(memberIds);
        setSignalTeamOwnerId(ownerId);
        return 'seeded';
      } catch (error) {
        console.warn(
          '[HumanRightPanel] Failed to seed signal team from assignees:',
          error,
        );
        return 'failed';
      }
    };

    const hydrateRosterHistory = async () => {
      let applied = applyFromTimeline();
      if (isLoadingMatrixUserIds) {
        return;
      }
      let historyExhausted = false;
      if (
        !applied.usable &&
        !applied.keptValidatedRoster &&
        !applied.hasTrustedRoster
      ) {
        const maxRosterHistoryBatches = 50;
        for (
          let i = 0;
          i < maxRosterHistoryBatches &&
          !cancelled &&
          !applied.usable &&
          !applied.keptValidatedRoster &&
          !applied.hasTrustedRoster;
          i += 1
        ) {
          try {
            const result = await matrixRef.current.loadRoomHistory(roomId, {
              pageSize: 30,
              maxBatches: 1,
              force: i > 0,
            });
            if (cancelled) return;
            applied = applyFromTimeline();
            if (!result.hasMoreOlder) {
              historyExhausted = true;
              break;
            }
          } catch (error) {
            if (!cancelled) {
              console.warn(
                '[HumanRightPanel] Signal team roster history load failed:',
                error,
              );
            }
            break;
          }
        }
      }
      if (cancelled) return;
      if (
        applied.usable ||
        applied.keptValidatedRoster ||
        applied.hasTrustedMembers
      ) {
        setSignalTeamRosterResolved(true);
        return;
      }
      // Trusted empty roster — do not seed the viewer; stay unresolved.
      if (applied.hasTrustedRoster) {
        return;
      }
      // Incomplete scrollback (soft-fail, cap, or catch) — do not seed the
      // viewer as a member. Stay unresolved so hydrate can retry.
      if (!historyExhausted) {
        return;
      }
      const seedResult = await seedFromDocumentAssignees();
      if (cancelled) return;
      // Lookup threw or a trusted empty roster arrived during lookup —
      // stay unresolved (fail closed).
      if (seedResult === 'failed' || seedResult === 'kept-empty-trusted') {
        return;
      }
      // Map lookup failed with no mapped assignees — stay unresolved.
      if (seedResult === 'empty' && matrixUserIdsError) {
        return;
      }
      if (!cancelled) {
        setSignalTeamRosterResolved(true);
      }
    };

    void hydrateRosterHistory();

    const onTimeline = (event: MatrixEvent, eventRoom?: Room) => {
      if (eventRoom?.roomId !== roomId) return;
      if (event.getType() !== EventType.RoomMessage) return;
      const content = event.getContent() as Record<string, unknown> | null;
      if (
        !isSignalTeamRosterContent(content) &&
        !isSignalTeamRequestContent(content)
      ) {
        return;
      }
      applyFromTimeline();
    };

    room.on(RoomEvent.Timeline, onTimeline);
    return () => {
      cancelled = true;
      room.off(RoomEvent.Timeline, onTimeline);
    };
  }, [
    client,
    roomId,
    isSignalThread,
    coherenceSlug,
    isJoining,
    personIdToMatrixUserId,
    isLoadingMatrixUserIds,
    matrixUserIdsError,
    me?.id,
  ]);

  useEffect(() => {
    if (!isDirectConversation || !client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    let cancelled = false;
    void room.loadMembersIfNeeded().then(() => {
      if (!cancelled) setMentionMembershipEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [client, isDirectConversation, roomId]);

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
  const resolveMemberAvatarRef = useRef(resolveMemberAvatar);
  resolveMemberAvatarRef.current = resolveMemberAvatar;
  const formatSignalTeamNotice = useMemo(
    () => createSignalTeamNoticeFormatter(t),
    [t],
  );
  const formatSignalTeamNoticeRef = useRef(formatSignalTeamNotice);
  formatSignalTeamNoticeRef.current = formatSignalTeamNotice;
  const systemSenderLabel = t('systemSender');
  const systemSenderLabelRef = useRef(systemSenderLabel);
  systemSenderLabelRef.current = systemSenderLabel;

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
            resolveMemberAvatarRef.current(sid) ??
            matrixMemberAvatarSquare(
              matrixClientRef.current,
              roomIdRef.current,
              sid,
              96,
            ) ??
            m.avatarUrl;
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
                    : resolveMemberAvatarRef.current(m.replyTo.sourceUserId) ??
                      matrixMemberAvatarSquare(
                        matrixClientRef.current,
                        roomIdRef.current,
                        m.replyTo.sourceUserId,
                        64,
                      ) ??
                      m.replyTo.authorAvatarUrl,
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
    matrixUserIdToPersonAvatar,
    directoryLabelByMxid,
    matrixProfileLabelByUserId,
    subToMatrixUserId,
    memberLabelEpoch,
    me?.name,
    me?.surname,
    t,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const refreshMemberLabelsAfterIdle = () => {
      if (document.visibilityState !== 'visible') return;
      profileLookupAttemptedRef.current.clear();
      profileLookupInFlightRef.current.clear();
      setMemberLabelEpoch((n) => n + 1);
      const rid = roomIdRef.current?.trim();
      if (rid) syncRoomMessages(rid);
    };
    document.addEventListener('visibilitychange', refreshMemberLabelsAfterIdle);
    window.addEventListener('focus', refreshMemberLabelsAfterIdle);
    return () => {
      document.removeEventListener(
        'visibilitychange',
        refreshMemberLabelsAfterIdle,
      );
      window.removeEventListener('focus', refreshMemberLabelsAfterIdle);
    };
  }, [syncRoomMessages]);

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
  const prevChatModeRef = useRef(mode);
  const lastHumanChatSpaceSlugRef = useRef(routeSpaceSlug || null);
  const hasLoadedCoherenceMessagesRef = useRef(false);
  useEffect(() => {
    if (prevSidebarOpenRef.current && !sidebarOpen && mode === 'coherence') {
      exitCoherenceChat();
    }
    prevSidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen, mode, exitCoherenceChat]);

  // Reset human chat when the route space changes. A direct message blanks the
  // derived space slug without leaving the page, so that must not close the PM.
  useEffect(() => {
    const nextSlug = routeSpaceSlug || null;
    const prevSlug = lastHumanChatSpaceSlugRef.current;
    if (prevSlug === nextSlug) return;
    lastHumanChatSpaceSlugRef.current = nextSlug;
    if (!prevSlug) return;

    setSpaceRoom('space');
    exitCoherenceChat();
    resetChatStateOnAuthDrop();
  }, [routeSpaceSlug, exitCoherenceChat, resetChatStateOnAuthDrop]);

  useEffect(() => {
    hasLoadedCoherenceMessagesRef.current = false;
  }, [coherenceSlug, mode]);

  // Reset chat state when space changes. The dashboard network room has no slug,
  // so this must not clear it — that loop would wipe the room on every message sync.
  useEffect(() => {
    if (!spaceSlug?.trim()) return;
    const joinedKey = joinedRef.current;
    const staysForThisSpace =
      joinedKey === spaceSlug ||
      joinedKey === `ecosystem:${spaceSlug}` ||
      joinedKey === `public:${spaceSlug}`;
    if (joinedKey && !staysForThisSpace) {
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
    if (!spaceSlug?.trim()) return;
    if (isUserSpaceStateLoading) return;
    if (hasSpaceActivityAccess) return;
    // Public stays open to visitors; only member rooms need activity access.
    if (spaceRoom === 'public') return;
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
  }, [
    mode,
    spaceSlug,
    roomId,
    hasSpaceActivityAccess,
    isUserSpaceStateLoading,
    spaceRoom,
  ]);

  // Join space / ecosystem / public room when Matrix is ready (space mode)
  useEffect(() => {
    if (mode !== 'space') return;
    if (!isMatrixAvailable || !isMatrixAuthenticated) return;
    if (!spaceSlug) return;
    if (isSpaceLoading) return;
    if (isUserSpaceStateLoading) return;
    const openingPublic = spaceRoom === 'public';
    const openingEcosystem = spaceRoom === 'ecosystem';
    if (!openingPublic && !hasSpaceActivityAccess) return;
    if (
      openingEcosystem &&
      space?.parentId != null &&
      !rootSpace &&
      isOrganisationLoading
    ) {
      return;
    }
    const ecosystemSlug =
      (rootSpace?.slug?.trim() || spaceSlug).trim() || spaceSlug;
    const joinedKey = openingEcosystem
      ? `ecosystem:${spaceSlug}`
      : openingPublic
      ? `public:${spaceSlug}`
      : spaceSlug;
    if (joinedRef.current === joinedKey) return;

    let cancelled = false;
    const {
      joinRoom,
      createRoom,
      client,
      ensureEcosystemRoom,
      ensurePublicRoom,
    } = matrixRef.current;

    const initRoom = async () => {
      setIsJoining(true);
      setError(null);
      try {
        let targetRoomId: string | null = null;

        if (openingEcosystem) {
          const { roomId: ecosystemRoomId } = await ensureEcosystemRoom(
            ecosystemSlug,
          );
          targetRoomId = ecosystemRoomId;
        } else if (openingPublic) {
          const memberRoomId =
            space?.chatRoomId?.trim() || getStoredRoomId(spaceSlug) || null;
          const { roomId: publicRoomId } = await ensurePublicRoom(
            spaceSlug,
            memberRoomId,
          );
          if (memberRoomId && publicRoomId === memberRoomId) {
            throw new Error('Public channel resolved to the space channel');
          }
          targetRoomId = publicRoomId;
        } else {
          const canonicalRoomId = space?.chatRoomId?.trim() || null;
          const storedRoomId = getStoredRoomId(spaceSlug);

          if (
            canonicalRoomId &&
            storedRoomId &&
            canonicalRoomId !== storedRoomId
          ) {
            clearStoredRoomId(spaceSlug);
          }

          targetRoomId = canonicalRoomId || storedRoomId;

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
            if (blockSpaceChatForMembership) {
              if (!cancelled) setIsJoining(false);
              return;
            }
            const { roomId: newRoomId } = await createRoom(
              `space-${spaceSlug}`,
              { roomType: HYPHA_ROOM_TYPES.space },
            );
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
        }

        if (cancelled || !targetRoomId) return;
        joinedRef.current = joinedKey;
        setRoomId(targetRoomId);
        void revealRoomTimeline(targetRoomId, () => cancelled);
      } catch (err) {
        if (!cancelled) {
          console.error('[HumanRightPanel] Failed to join room:', err);
          setError('Failed to join chat room');
          setIsJoining(false);
        }
      }
    };

    initRoom();

    return () => {
      cancelled = true;
      setIsJoining(false);
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
    space?.parentId,
    spaceRoom,
    rootSpace?.slug,
    isOrganisationLoading,
    blockSpaceChatForMembership,
    revealRoomTimeline,
  ]);

  // The network page has one room. An ecosystem is a root space, so that
  // room sits beside the space chat, not beside the network.
  useEffect(() => {
    if (mode !== 'space') return;
    if (spaceSlug?.trim()) return;
    if (isMemberHome) return;
    if (!isMatrixAvailable || !isMatrixAuthenticated) return;
    if (joinedRef.current === NETWORK_JOINED_SENTINEL) return;

    let cancelled = false;
    const { ensureNetworkRoom } = matrixRef.current;

    const initSharedRoom = async () => {
      setIsJoining(true);
      setError(null);
      try {
        const { roomId: targetRoomId } = await ensureNetworkRoom();
        if (cancelled) return;
        joinedRef.current = NETWORK_JOINED_SENTINEL;
        setRoomId(targetRoomId);
        void revealRoomTimeline(targetRoomId, () => cancelled);
      } catch (err) {
        if (!cancelled) {
          console.error('[HumanRightPanel] Failed to join shared room:', err);
          setError('Failed to join chat room');
          setIsJoining(false);
        }
      }
    };

    void initSharedRoom();

    return () => {
      cancelled = true;
      setIsJoining(false);
    };
  }, [
    mode,
    spaceSlug,
    isMemberHome,
    isMatrixAvailable,
    isMatrixAuthenticated,
    revealRoomTimeline,
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
      setIsJoining(false);
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

    const openingSpaceSlug = coherenceSpaceSlug?.trim() || '';
    const previousRoomId = roomIdRef.current?.trim();
    if (previousRoomId) {
      matrixRef.current.unregisterRoomListener(previousRoomId);
    }
    roomIdRef.current = null;
    setRoomId(null);
    setIsJoining(true);
    // A selected space may only know its slug until the space record loads.
    // Public map→chat also waits: we need `spaces.chatRoomId` so a misbound
    // `#hypha-public-{slug}` alias is not joined as the member room.
    // Detach and lock first — the previous effect's cleanup sets
    // `isJoining` false, and a send must not hit the old room.
    if (
      openingSpaceSlug &&
      isSpaceLoading &&
      (coherencePublic || !coherenceRoomId?.trim())
    ) {
      return () => {
        setIsJoining(false);
      };
    }

    let cancelled = false;

    const init = async () => {
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
        let targetRoomId = coherenceRoomId?.trim() || null;
        const openingSpaceSlug = coherenceSpaceSlug?.trim() || '';
        if (coherencePublic) {
          if (!openingSpaceSlug) {
            throw new Error('Failed to open the public room');
          }
          const memberRoomId =
            space?.chatRoomId?.trim() ||
            getStoredRoomId(openingSpaceSlug) ||
            null;
          const { roomId: publicRoomId } =
            await matrixRef.current.ensurePublicRoom(
              openingSpaceSlug,
              memberRoomId,
            );
          const publicRoomType =
            client?.getRoom(publicRoomId)?.getType() ?? null;
          const acceptedPublicRoomId =
            publicRoomType == null
              ? distinctPublicRoomId(publicRoomId, memberRoomId)
              : acceptEnsuredPublicRoomId(
                  publicRoomId,
                  memberRoomId,
                  publicRoomType,
                );
          if (!acceptedPublicRoomId) {
            throw new Error('Public channel resolved to the space channel');
          }
          targetRoomId = acceptedPublicRoomId;
        } else if (!targetRoomId && openingSpaceSlug) {
          targetRoomId =
            space?.chatRoomId?.trim() ||
            getStoredRoomId(openingSpaceSlug) ||
            null;
        }

        // A space room must not be created as a signal room.
        // Public map→chat must not create/join `spaces.chatRoomId` either.
        if (!targetRoomId && openingSpaceSlug && !coherencePublic) {
          if (blockSpaceChatForMembership) {
            setIsJoining(false);
            return;
          }
          console.log(
            '[HumanRightPanel] Creating Matrix room for space:',
            openingSpaceSlug,
          );
          const { roomId: newRoomId } = await promiseWithTimeout(
            matrixRef.current.createRoom(`space-${openingSpaceSlug}`, {
              roomType: HYPHA_ROOM_TYPES.space,
            }),
            COHERENCE_ROOM_JOIN_TIMEOUT_MS,
            'Space room create timed out',
          );
          if (cancelled) return;
          if (!newRoomId) {
            throw new Error('Failed to create room: empty roomId returned');
          }
          targetRoomId = newRoomId;
          storeRoomId(openingSpaceSlug, newRoomId);
          if (authTokenRef.current) {
            try {
              await updateSpaceBySlugRef.current({
                slug: openingSpaceSlug,
                chatRoomId: newRoomId,
              });
              openCoherenceChat(
                newRoomId,
                coherenceTitle || space?.title || openingSpaceSlug,
                coherenceSlug || openingSpaceSlug,
                coherenceDescription,
                openingSpaceSlug,
              );
            } catch (err) {
              console.warn(
                '[HumanRightPanel] Failed to persist chat room id on space:',
                err,
              );
            }
          }
        } else if (!targetRoomId) {
          // If no room exists yet, only create one when we can link it back
          if (!coherenceSlug || blockSpaceChatForMembership) {
            // Cannot persist without a slug — skip room creation
            setIsJoining(false);
            return;
          }
          console.log(
            '[HumanRightPanel] Creating Matrix room for coherence:',
            coherenceSlug,
          );
          // No `grantCreatorPl100` here deliberately: this is a lazy-creation fallback for a
          // signal that predates having a room, reachable by any space member who happens to
          // open it first — not necessarily the signal's actual creator (#2428 review). The
          // primary creation path (`create-signal-form.tsx`) grants PL100 correctly, since it
          // only runs for the person actually submitting the create form.
          const { roomId: newRoomId } = await promiseWithTimeout(
            getOrCreateCoherenceRoom(
              coherenceSlug,
              coherenceTitle || 'Conversation',
            ),
            COHERENCE_ROOM_JOIN_TIMEOUT_MS,
            'Coherence room create timed out',
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
          targetRoomId = await promiseWithTimeout(
            matrixRef.current.joinRoom(targetRoomId),
            COHERENCE_ROOM_JOIN_TIMEOUT_MS,
            'Coherence room join timed out',
          );
        }

        if (cancelled) return;
        setRoomId(targetRoomId);
        if (coherenceSlug?.trim()) {
          rememberSignalThreadRooms([targetRoomId], { quiet: true });
        }

        void (async () => {
          await revealRoomTimeline(targetRoomId, () => cancelled);
          if (cancelled || openingSpaceSlug) return;
          try {
            let description = coherenceDescription?.trim() || null;
            if (!description && coherenceSlug?.trim()) {
              const signal = await getCoherenceBySlug({
                slug: coherenceSlug.trim(),
              });
              description = signal?.description?.trim() || null;
            }
            if (description) {
              await upsertSignalDescriptionInRoom({
                roomId: targetRoomId,
                description,
                mode: 'safe',
                matrix: {
                  joinRoom: (id) => matrixRef.current.joinRoom(id),
                  loadRoomHistory: (id) =>
                    matrixRef.current.loadRoomHistory(id, {
                      pageSize: 30,
                      maxBatches: 1,
                    }),
                  getRoomMessages: (id) =>
                    matrixRef.current.getRoomMessages(id),
                  sendMessage: (params) =>
                    matrixRef.current.sendMessage(params),
                  editRoomMessage: (params) =>
                    matrixRef.current.editRoomMessage(params),
                },
              });
              if (!cancelled) {
                await matrixRef.current.loadRoomHistory(targetRoomId, {
                  force: true,
                  pageSize: 30,
                  maxBatches: 1,
                });
                syncRoomMessages(targetRoomId);
              }
            }
          } catch (seedError) {
            console.warn(
              '[HumanRightPanel] Failed to seed signal description in chat:',
              seedError,
            );
          }
        })();
      } catch (err) {
        const knownId = coherenceRoomId?.trim();
        const recovered = knownId
          ? matrixRef.current.client?.getRoom(knownId)
          : null;
        const recoveredMemberRoomId =
          space?.chatRoomId?.trim() ||
          getStoredRoomId(openingSpaceSlug) ||
          null;
        const recoveredIsPublic =
          !coherencePublic ||
          Boolean(
            acceptEnsuredPublicRoomId(
              recovered?.roomId,
              recoveredMemberRoomId,
              recovered?.getType() ?? null,
            ),
          );
        // Joined-room recovery stays for DMs / signals. Public map→chat
        // may recover only when the joined room is not the member channel.
        if (
          !cancelled &&
          recovered &&
          recovered.getMyMembership() === 'join' &&
          recoveredIsPublic
        ) {
          console.warn(
            '[HumanRightPanel] Join reported a failure after the room was already open:',
            err,
          );
          setRoomId(recovered.roomId);
          void revealRoomTimeline(recovered.roomId, () => cancelled);
          return;
        }
        if (!cancelled) {
          console.error(
            '[HumanRightPanel] Failed to join coherence room:',
            err,
          );
          setError(t('failedToJoinRoom'));
          setIsJoining(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      setIsJoining(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    coherenceRoomId,
    coherenceTitle,
    coherenceSlug,
    coherenceDescription,
    coherenceSpaceSlug,
    coherencePublic,
    isSpaceLoading,
    space?.chatRoomId,
    space?.title,
    isMatrixAvailable,
    isMatrixAuthenticated,
    blockSpaceChatForMembership,
    getOrCreateCoherenceRoom,
    revealRoomTimeline,
    syncRoomMessages,
  ]);

  // Register listener for incoming messages
  useEffect(() => {
    if (!roomId || !isMatrixAvailable) return;

    const scheduleTimelineFlush = () => {
      if (timelineFlushRafRef.current != null) return;
      timelineFlushRafRef.current = requestAnimationFrame(() => {
        timelineFlushRafRef.current = null;
        if (roomIdRef.current !== roomId) {
          pendingTimelineRedactIdsRef.current = new Set();
          pendingTimelineMessagesRef.current = new Map();
          return;
        }

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
          const incoming: UIMessage[] = [];
          for (const message of upserts.values()) {
            incoming.push(
              toUIMessage(
                message,
                currentUserIdRef.current,
                resolveMemberLabelRef.current,
                currentUserAvatarUrlRef.current,
                resolveMemberAvatarRef.current,
                roomId,
                matrixRef.current.client ?? null,
                formatSignalTeamNoticeRef.current,
                systemSenderLabelRef.current,
              ),
            );
          }
          return upsertTimelineMessages(next, incoming);
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
    if (pathname.includes('/my-wallet')) {
      return `/${lang}/my-wallet/notification-centre`;
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
    async (eventId: string, fromRoomId?: string) => {
      setMentionNavigationNotice(null);
      const targetRoom = fromRoomId?.trim();
      const current = roomId?.trim();
      const langMatch = pathname.match(/^\/([^/]+)\//);
      const lang = langMatch?.[1] ?? 'en';
      const spaceChatRoomId = space?.chatRoomId?.trim() ?? null;
      const pathSlug = getDhoSpaceSlugFromPathname(pathname)?.trim() ?? null;

      const openMentionInCurrentRoom = () => {
        openHumanChatPanel();
        setActiveTab('chat');
        setScrollToEventId(eventId);
      };

      // Same room (or single-room inbox with no fromRoomId): just switch + scroll.
      if (!targetRoom || targetRoom === current) {
        openMentionInCurrentRoom();
        return;
      }

      if (
        spaceChatRoomId &&
        targetRoom === spaceChatRoomId &&
        spaceSlug &&
        pathSlug === spaceSlug
      ) {
        if (mode === 'coherence') {
          exitCoherenceChat();
        }
        openMentionInCurrentRoom();
        return;
      }

      if (typeof window === 'undefined') {
        setMentionNavigationNotice(t('mentionOpenFallbackRoom'));
        return;
      }

      // Aggregated Mentions: resolve signal/coherence rooms via cache + API.
      const signalTarget = await resolveSignalThreadByMatrixRoom(
        targetRoom,
        async () => authTokenRef.current,
      );
      if (signalTarget) {
        rememberRoomToCoherenceSession(
          signalTarget.roomId,
          signalTarget.signalSlug,
          signalTarget.signalTitle,
          signalTarget.spaceSlug,
        );

        if (pathSlug === signalTarget.spaceSlug) {
          openCoherenceChat(
            signalTarget.roomId,
            signalTarget.signalTitle,
            signalTarget.signalSlug,
          );
          openMentionInCurrentRoom();
          return;
        }

        router.push(
          `/${lang}/dho/${signalTarget.spaceSlug}?signal=${encodeURIComponent(
            signalTarget.signalSlug,
          )}&msg=${encodeURIComponent(eventId)}`,
        );
        openHumanChatPanel();
        setActiveTab('chat');
        return;
      }

      if (spaceChatRoomId && targetRoom === spaceChatRoomId) {
        let slug =
          window.sessionStorage
            .getItem(`${SESSION_ROOM_TO_SPACE_PREFIX}${targetRoom}`)
            ?.trim() ?? null;
        if (!slug) {
          const fromLs = readRoomIdToSpaceSlugFromStorage().get(targetRoom);
          slug = fromLs ?? null;
        }
        if (!slug && spaceSlug) {
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

      const coherence = readRoomToCoherenceSession(targetRoom);
      if (coherence.slug) {
        openCoherenceChat(
          targetRoom,
          coherence.title || 'Conversation',
          coherence.slug,
        );
        openMentionInCurrentRoom();
        return;
      }

      let slug =
        window.sessionStorage
          .getItem(`${SESSION_ROOM_TO_SPACE_PREFIX}${targetRoom}`)
          ?.trim() ?? null;
      if (!slug) {
        const fromLs = readRoomIdToSpaceSlugFromStorage().get(targetRoom);
        slug = fromLs ?? null;
      }
      if (slug) {
        router.push(`/${lang}/dho/${slug}?msg=${encodeURIComponent(eventId)}`);
        openHumanChatPanel();
        setActiveTab('chat');
        return;
      }

      // Do not fall through into the current (often space) room — that showed
      // the welcome timeline under the "could not resolve" banner.
      setMentionNavigationNotice(t('mentionOpenFallbackRoom'));
    },
    [
      roomId,
      pathname,
      router,
      openCoherenceChat,
      openHumanChatPanel,
      exitCoherenceChat,
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
    async (eventId: string) => {
      const targetRoomId = roomId?.trim();
      if (!targetRoomId) {
        setMentionNavigationNotice(t('mentionOpenFallbackMissingMessage'));
        setScrollToEventId(null);
        return;
      }

      let hasMore = hasMoreOlderMessages;
      for (let attempt = 0; attempt < 12 && hasMore; attempt += 1) {
        const result = await matrixRef.current.loadRoomHistory(targetRoomId, {
          force: true,
          maxBatches: 3,
        });
        syncRoomMessages(targetRoomId);
        hasMore = result.hasMoreOlder;
        setHasMoreOlderMessages(hasMore);

        const escaped =
          typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(eventId)
            : eventId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        if (
          document.querySelector(`[data-matrix-event-id="${escaped}"]`) != null
        ) {
          setScrollToEventId(eventId);
          return;
        }

        if (!hasMore) break;
      }

      setMentionNavigationNotice(t('mentionOpenFallbackMissingMessage'));
      setScrollToEventId(null);
    },
    [hasMoreOlderMessages, roomId, syncRoomMessages, t],
  );

  const mergedMessages = useMemo(() => {
    const withPending = (() => {
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
      return sortMessagesChronologically([...messages, pendingRow]);
    })();
    if (mode !== 'coherence' || !coherenceSlug?.trim()) return withPending;
    const firstTextIndex = withPending.findIndex(
      (row) => !row.isSynthetic && getMessagePlainText(row).trim().length > 0,
    );
    if (firstTextIndex < 0) return withPending;
    const first = withPending[firstTextIndex]!;
    const attribution = applySignalCreatorToChatAuthor({
      isDescriptionAnchor: isSignalDescriptionAnchorMessage({
        isFirstChatTextMessage: true,
        messageContent: getMessagePlainText(first),
        signalDescription:
          openSignalForCreator?.description ?? coherenceDescription,
      }),
      viewerPersonId: me?.id,
      creatorId: openSignalForCreator?.creatorId,
      creatorName: [signalCreatorPerson?.name, signalCreatorPerson?.surname]
        .filter(Boolean)
        .join(' '),
      viewerName: [me?.name, me?.surname].filter(Boolean).join(' '),
    });
    if (!attribution) return withPending;
    return withPending.map((row, index) =>
      index === firstTextIndex
        ? {
            ...row,
            ...attribution,
            senderMatrixId: undefined,
            avatarUrl: signalCreatorPerson?.avatarUrl?.trim() || row.avatarUrl,
          }
        : row,
    );
  }, [
    messages,
    sendingPending,
    currentUserAvatarUrl,
    mode,
    coherenceSlug,
    coherenceDescription,
    me?.id,
    me?.name,
    me?.surname,
    openSignalForCreator?.creatorId,
    openSignalForCreator?.description,
    signalCreatorPerson?.name,
    signalCreatorPerson?.surname,
    signalCreatorPerson?.avatarUrl,
  ]);

  const calledAgents = useMemo(
    () => calledSpecialistIds(mergedMessages),
    [mergedMessages],
  );

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
    const pathSlug = getDhoSpaceSlugFromPathname(pathname)?.trim() ?? null;
    if (
      !rid ||
      !slug ||
      mode !== 'coherence' ||
      typeof window === 'undefined'
    ) {
      return;
    }
    rememberRoomToCoherenceSession(rid, slug, coherenceTitle, pathSlug);
  }, [roomId, coherenceSlug, coherenceTitle, mode, pathname]);

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

  /** Unread badges on Space / Ecosystem / Public — joined rooms only. */
  const spaceChannelUnread = useMemo(() => {
    const empty = { count: 0, capped: false };
    if (!client || !currentUserId || mode !== 'space' || !spaceSlug?.trim()) {
      return { space: empty, ecosystem: empty, public: empty };
    }
    const spaceRoomId = space?.chatRoomId?.trim() || null;
    const ecosystemSlug =
      (rootSpace?.slug?.trim() || spaceSlug).trim() || spaceSlug;
    const ecosystemRoomId = findJoinedRoomIdByAliasLocalpart(
      client,
      chatRoomAliasLocalpart(ECOSYSTEM_CHAT_ALIAS_PREFIX, ecosystemSlug),
    );
    const publicRoomId = findJoinedRoomIdByAliasLocalpart(
      client,
      chatRoomAliasLocalpart(PUBLIC_CHAT_ALIAS_PREFIX, spaceSlug),
    );
    return {
      space: unreadNotificationBadgeForRoom(
        spaceRoomId ? client.getRoom(spaceRoomId) ?? undefined : undefined,
        currentUserId,
      ),
      ecosystem: unreadNotificationBadgeForRoom(
        ecosystemRoomId
          ? client.getRoom(ecosystemRoomId) ?? undefined
          : undefined,
        currentUserId,
      ),
      public: unreadNotificationBadgeForRoom(
        publicRoomId ? client.getRoom(publicRoomId) ?? undefined : undefined,
        currentUserId,
      ),
    };
  }, [
    client,
    currentUserId,
    mode,
    spaceSlug,
    space?.chatRoomId,
    rootSpace?.slug,
    unreadBump,
  ]);

  /** `unreadBump` intentionally omitted — it was re-running the all-rooms scan on every timeline event. */
  const aggregateMentionBadge = useMemo(() => {
    if (!client || !currentUserId) {
      return { count: 0, capped: false };
    }
    return computeAggregateUnreadMentionCount(client.getRooms(), currentUserId);
  }, [client, currentUserId, aggregateMentionBump]);

  const bellMentionCount = aggregateMentionBadge.count;
  const bellMentionCapped = aggregateMentionBadge.capped;

  // Keep the header "Open chat panel" trigger in sync with unread @mentions
  // even while the panel is closed (sidebar content stays mounted off-canvas).
  useEffect(() => {
    setUnreadMentionCount(bellMentionCount);
  }, [bellMentionCount, setUnreadMentionCount]);

  useEffect(() => {
    return () => {
      setUnreadMentionCount(0);
    };
  }, [setUnreadMentionCount]);

  const markRoomTimelineRead = useCallback(
    async (targetRoomId: string) => {
      if (!client || !currentUserId) return;
      const room = client.getRoom(targetRoomId);
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
        const readUpTo = room.getEventReadUpTo(currentUserId, false);
        if (readUpTo) {
          const order = room.compareEventOrdering(readUpTo, id);
          if (order !== null && order >= 0) return;
        }
        try {
          await markRoomRead(targetRoomId, id);
          notifyConversationUnreadChanged();
          setUnreadBump((n) => n + 1);
          setAggregateMentionBump((n) => n + 1);
        } catch {
          // ignore
        }
        return;
      }
    },
    [client, currentUserId, markRoomRead],
  );

  const markChatTimelineRead = useCallback(async () => {
    if (!roomId) return;
    await markRoomTimelineRead(roomId);
  }, [markRoomTimelineRead, roomId]);

  /** Clear Chat/Mentions badges — marks every joined room that still has unread @mentions. */
  const markAllUnreadMentionsRead = useCallback(async () => {
    if (!client || !currentUserId) return;
    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      const state = computeHumanChatUnreadState(room, currentUserId);
      if (state.unreadMentionCount <= 0) continue;
      await markRoomTimelineRead(room.roomId);
    }
    setUnreadBump((n) => n + 1);
    setAggregateMentionBump((n) => n + 1);
  }, [client, currentUserId, markRoomTimelineRead]);

  const handleReachedTimelineBottom = useCallback(() => {
    const now = Date.now();
    if (now - lastAutoMarkReadAtRef.current < 800) return;
    lastAutoMarkReadAtRef.current = now;
    void markChatTimelineRead();
  }, [markChatTimelineRead]);

  // Viewing the open chat is reading it. The messages screen never sent a
  // receipt, so the nav badge kept every message that had arrived.
  useEffect(() => {
    if (!open || !roomId || !client) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer != null) return;
      timer = setTimeout(() => {
        timer = null;
        void markRoomTimelineRead(roomId);
      }, 400);
    };
    schedule();
    const room = client.getRoom(roomId);
    const onTimeline = () => schedule();
    const onDecrypted = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) schedule();
    };
    room?.on(RoomEvent.Timeline, onTimeline);
    client.on(MatrixEventEvent.Decrypted, onDecrypted);
    return () => {
      if (timer != null) clearTimeout(timer);
      room?.off(RoomEvent.Timeline, onTimeline);
      client.removeListener(MatrixEventEvent.Decrypted, onDecrypted);
    };
  }, [client, markRoomTimelineRead, open, roomId]);

  const handleMarkAsReadFromBanner = useCallback(() => {
    void markChatTimelineRead();
  }, [markChatTimelineRead]);

  useEffect(() => {
    const isPrivateMessageLink = mode === 'coherence';
    if (mode !== 'space' && !isPrivateMessageLink) return;
    /** Signal deep links (`?signal=`) are handled by the dedicated effect below. */
    if (readSignalDeepLinkSlug(searchParams)) return;
    const qpChat = searchParams?.get('chat')?.trim();
    const qpMsg = searchParams?.get('msg')?.trim();
    if (!qpMsg || !roomId) return;
    /**
     * Space: `?msg=` alone (current room) or legacy `?chat=` + `msg`.
     * Private message: `?chat=` must be this room.
     */
    const sameRoom = isPrivateMessageLink
      ? Boolean(qpChat && qpChat === roomId)
      : (!qpChat && Boolean(roomId)) || Boolean(qpChat && qpChat === roomId);
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

  useEffect(() => {
    const prevMode = prevChatModeRef.current;
    prevChatModeRef.current = mode;

    if (mode === 'coherence' && coherenceSlug?.trim()) {
      const slug = coherenceSlug.trim();
      const currentSpace = spaceSlug?.trim();
      if (coherenceRoomId?.trim() && currentSpace) {
        const session = readRoomToCoherenceSession(coherenceRoomId);
        if (session.spaceSlug && session.spaceSlug !== currentSpace) {
          if (readSignalDeepLinkSlug(searchParams)) {
            signalDeepLinkEpochRef.current += 1;
            const cleaned = setSignalSearchParam(
              pathname,
              searchParams?.toString() ?? '',
              null,
            );
            if (typeof window !== 'undefined') {
              window.history.replaceState(window.history.state, '', cleaned);
            }
            router.replace(cleaned, { scroll: false });
          }
          return;
        }
      }
      if (readSignalDeepLinkSlug(searchParams) === slug) {
        previousSignalChatSlugRef.current = slug;
        previousSignalUrlSlugRef.current = slug;
        previousSignalChoiceRef.current = slug;
        return;
      }
      const urlSignal = readSignalDeepLinkSlug(searchParams);
      const choice = pickSignalDeepLinkTarget({
        humanChatEnabled: true,
        chatSlug: slug,
        urlSlug: urlSignal,
        previousChatSlug: previousSignalChatSlugRef.current,
        previousUrlSlug: previousSignalUrlSlugRef.current,
        previousChoice: previousSignalChoiceRef.current,
      });
      previousSignalChatSlugRef.current = slug;
      previousSignalUrlSlugRef.current = urlSignal;
      previousSignalChoiceRef.current = choice;
      if (!shouldWriteOpenChatToSignalUrl(choice, slug, urlSignal)) {
        return;
      }
      const href = setSignalSearchParam(
        pathname,
        typeof window !== 'undefined'
          ? window.location.search
          : searchParams?.toString() ?? '',
        slug,
      );
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', href);
      }
      router.replace(href, { scroll: false });
      return;
    }

    if (
      prevMode === 'coherence' &&
      mode === 'space' &&
      readSignalDeepLinkSlug(searchParams)
    ) {
      const href = setSignalSearchParam(
        pathname,
        typeof window !== 'undefined'
          ? window.location.search
          : searchParams?.toString() ?? '',
        null,
      );
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', href);
      }
      router.replace(href, { scroll: false });
    }
  }, [
    coherenceRoomId,
    coherenceSlug,
    mode,
    pathname,
    router,
    searchParams,
    spaceSlug,
  ]);

  useEffect(() => {
    if (!readSignalDeepLinkSlug(searchParams)) {
      setSignalDeepLinkNotice(null);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!spaceSlug?.trim()) return;
    const qpSignal = readSignalDeepLinkSlug(searchParams);
    const qpMsg =
      readLiveSearchParam('msg') ?? searchParams?.get('msg')?.trim() ?? null;
    if (!qpSignal) return;

    openHumanChatPanel();
    setActiveTab('chat');

    if (mode === 'coherence' && coherenceSlug?.trim() === qpSignal) {
      return;
    }

    let cancelled = false;
    const epochAtStart = signalDeepLinkEpochRef.current;
    const expectedSpaceSlug = spaceSlug.trim();

    const stripInvalidSignalFromUrl = () => {
      signalDeepLinkEpochRef.current += 1;
      const cleaned = setSignalSearchParam(
        pathname,
        searchParams?.toString() ?? '',
        null,
      );
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', cleaned);
      }
      router.replace(cleaned, { scroll: false });
    };

    void (async () => {
      const result = await resolveSignalDeepLinkWithRetry({
        signalId: qpSignal,
        expectedSpaceSlug,
        getAuthToken: () => authTokenRef.current,
        fetchSignal: (signalId, token) => {
          const headers: HeadersInit = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return fetch(`/api/v1/signals/${encodeURIComponent(signalId)}`, {
            headers,
          });
        },
      });
      if (cancelled) return;
      if (epochAtStart !== signalDeepLinkEpochRef.current) return;
      if (spaceSlug?.trim() !== expectedSpaceSlug) return;
      if (readLiveSearchParam('signal') !== qpSignal) return;

      if (!result.ok) {
        const messageKey =
          result.reason === 'auth_not_ready'
            ? 'signalDeepLinkAuthNotReady'
            : result.reason === 'not_found'
            ? 'signalDeepLinkNotFound'
            : 'signalDeepLinkNetworkError';
        setSignalDeepLinkNotice(t(messageKey));
        stripInvalidSignalFromUrl();
        return;
      }

      if (result.roomId) {
        rememberRoomToCoherenceSession(
          result.roomId,
          result.signalSlug,
          result.signalTitle,
          result.spaceSlug,
        );
      }
      openCoherenceChat(
        result.roomId,
        result.signalTitle?.trim() || result.signalSlug,
        result.signalSlug,
      );
      openHumanChatPanel();
      setActiveTab('chat');
      if (qpMsg) setScrollToEventId(qpMsg);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    spaceSlug,
    coherenceSlug,
    coherenceRoomId,
    pathname,
    router,
    searchParams,
    openCoherenceChat,
    openHumanChatPanel,
    t,
  ]);

  useEffect(() => {
    if (!spaceSlug?.trim()) return;
    const qpJoinCall = searchParams?.get('joinCall')?.trim();
    if (qpJoinCall !== '1') return;
    if (readSignalDeepLinkSlug(searchParams)) return;

    openHumanChatPanel();
    setActiveTab('chat');

    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.delete('joinCall');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [spaceSlug, pathname, router, searchParams, openHumanChatPanel]);

  /**
   * When `?msg=` is present, retry locating the row after the timeline grows (initial effect may run
   * before messages arrive). One rAF per `messages.length` change — not merged list length tricks.
   */
  const directChatRoomId =
    mode === 'coherence' ? searchParams?.get('chat')?.trim() : undefined;
  const deepLinkEventId =
    mode === 'space' || directChatRoomId
      ? searchParams?.get('msg')?.trim()
      : undefined;
  useEffect(() => {
    if (!deepLinkEventId || !roomId) return;
    const qpChat = searchParams?.get('chat')?.trim();
    const sameRoom = directChatRoomId
      ? qpChat === roomId
      : (!qpChat && Boolean(roomId)) || Boolean(qpChat && qpChat === roomId);
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
    directChatRoomId,
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
          : isHyphaBotMatrixIdentity(target.senderMatrixId, target.senderName)
          ? t('agentMentionLabel')
          : target.role === 'member' && target.senderMatrixId
          ? resolveMemberLabel(target.senderMatrixId)
          : target.senderName ?? t('unknownMember');
      const excerpt = firstLineForReplyPreview(
        replaceMxidsWithVisibleMentionLabels(
          getMessagePlainText(target),
          mentionLabelByUserId,
          resolveMemberLabel,
        ),
      );
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
    [mentionLabelByUserId, messages, resolveMemberLabel, t],
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
          excerpt: firstLineForReplyPreview(
            replaceMxidsWithVisibleMentionLabels(
              plain,
              mentionLabelByUserId,
              resolveMemberLabel,
            ),
          ),
          editMediaMode: true,
        });
        setInput(
          replaceMxidsWithComposerMentionTokens(
            plain,
            mentionComposerTokenLabelByUserId,
          ),
        );
        return;
      }

      setDraftAttachments([]);
      setEditDraft({
        messageId,
        excerpt: firstLineForReplyPreview(
          replaceMxidsWithVisibleMentionLabels(
            plain,
            mentionLabelByUserId,
            resolveMemberLabel,
          ),
        ),
      });
      setInput(
        replaceMxidsWithComposerMentionTokens(
          plain,
          mentionComposerTokenLabelByUserId,
        ),
      );
    },
    [
      messages,
      client,
      mentionComposerTokenLabelByUserId,
      mentionLabelByUserId,
      resolveMemberLabel,
      t,
    ],
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
    if (blockSpaceChatForMembership) {
      setComposerError(tCommon('joinSpaceToUse'));
      return;
    }
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
        // Mention notifications are server-fired (#2470) from the #2483 AS receiver watching
        // this same Matrix message — no client trigger needed here anymore.
        await inviteMatrixAgentIfNeeded(
          matrixRef.current.client,
          roomId,
          mentionUserIds,
        );
        requestMatrixAgentReply({
          authToken: authTokenRef.current,
          roomId,
          mentionUserIds,
          context: isDirectConversation
            ? { kind: 'dm' }
            : mode === 'space' && !spaceSlug?.trim()
            ? { kind: 'network' }
            : mode === 'space' && spaceRoom === 'ecosystem'
            ? { kind: 'ecosystem', spaceSlug }
            : mode === 'space' && spaceRoom === 'public'
            ? { kind: 'public', spaceSlug }
            : coherencePublic
            ? { kind: 'public', spaceSlug }
            : mode === 'coherence' && coherenceSlug?.trim()
            ? {
                kind: 'signal',
                spaceSlug,
                signalSlug: coherenceSlug,
                signalTitle: coherenceTitle,
              }
            : { kind: 'space', spaceSlug },
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
    blockSpaceChatForMembership,
    isDirectConversation,
    spaceSlug,
    mode,
    spaceRoom,
    coherenceSlug,
    coherenceTitle,
    tCommon,
    t,
  ]);

  useEffect(() => {
    return () => {
      disposeDraftAttachmentUrls(draftAttachmentsRef.current);
    };
  }, []);

  if (isMemberHome && mode === 'space' && !spaceSlug?.trim()) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-page-background dark:bg-background-2">
        <HumanChatPanelHeader
          title=""
          notificationSettingsHref={notificationCentreHref}
          trailingStart={
            showAuthedUi ? (
              <HumanChatPanelMentionBell
                unreadCount={bellMentionCount}
                countIsCapped={bellMentionCapped}
                mentionsTabActive={false}
                onOpenMentions={() => setActiveTab('mentions')}
              />
            ) : null
          }
        />
        <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <MyConnections />
        </div>
      </div>
    );
  }

  return (
    <>
      {screenshareTabAudioPromptDialog}
      <SidebarHeader className="gap-0 bg-page-background p-0 dark:bg-background-2">
        <HumanChatPanelHeader
          title={
            mode === 'coherence'
              ? groupTitle ?? coherenceTitle ?? undefined
              : ''
          }
          iconTitle={
            mode === 'space' && !spaceSlug?.trim()
              ? t('networkRoomTitle')
              : undefined
          }
          titleStart={
            isDirectConversation &&
            (peerMemberSpaces.length > 0 || peerMemberSpacesLoading) ? (
              <MemberSpaceIcons
                spaces={peerMemberSpaces}
                overflowHref={peerSpacesOverflowHref}
                isLoading={peerMemberSpacesLoading}
                size={24}
              />
            ) : null
          }
          roomChoice={
            mode === 'space' && spaceSlug?.trim()
              ? {
                  value: spaceRoom,
                  ariaLabel: t('spaceRoomsLabel'),
                  options: [
                    {
                      value: 'space',
                      label: t('spaceRoomTitle'),
                      unreadCount: spaceChannelUnread.space.count,
                      unreadCountIsCapped: spaceChannelUnread.space.capped,
                    },
                    {
                      value: 'ecosystem',
                      label: t('ecosystemRoomTitle'),
                      unreadCount: spaceChannelUnread.ecosystem.count,
                      unreadCountIsCapped: spaceChannelUnread.ecosystem.capped,
                    },
                    {
                      value: 'public',
                      label: t('publicRoomTitle'),
                      unreadCount: spaceChannelUnread.public.count,
                      unreadCountIsCapped: spaceChannelUnread.public.capped,
                    },
                  ],
                  onChange: (next) => {
                    if (
                      next !== 'space' &&
                      next !== 'ecosystem' &&
                      next !== 'public'
                    ) {
                      return;
                    }
                    if (next === spaceRoom) return;
                    // Ecosystem / public rooms are alias-backed — never reuse
                    // the member space room id when switching.
                    joinedRef.current = null;
                    messagesRoomIdRef.current = null;
                    if (timelineFlushRafRef.current != null) {
                      cancelAnimationFrame(timelineFlushRafRef.current);
                      timelineFlushRafRef.current = null;
                    }
                    pendingTimelineRedactIdsRef.current = new Set();
                    pendingTimelineMessagesRef.current = new Map();
                    if (roomId) {
                      matrixRef.current.unregisterRoomListener(roomId);
                    }
                    setRoomId(null);
                    setMessages([]);
                    setSpaceRoom(next);
                  },
                }
              : undefined
          }
          onBack={mode === 'coherence' ? exitCoherenceChat : undefined}
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
          trailingEnd={
            isDirectConversation && roomId ? (
              <HumanChatPanelGroupMenu
                roomId={roomId}
                title={groupTitle ?? coherenceTitle ?? ''}
                onRenamed={(name) => {
                  applyConversationRoomTitle(roomId, name);
                  setGroupTitle(name);
                }}
              />
            ) : null
          }
        />
        <>
          <HumanChatPanelTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            chatMentionCount={bellMentionCount}
            chatMentionCountCapped={bellMentionCapped}
            mentionTabBadgeCount={bellMentionCount}
            mentionTabBadgeCapped={bellMentionCapped}
            tabRowEnd={
              (showSidebarCallChrome &&
                !inSpaceCall &&
                !spaceCallShowJoinStrip) ||
              (showAuthedUi && elsewhereCallEntries.length > 0) ? (
                <>
                  {showSidebarCallChrome &&
                  !inSpaceCall &&
                  !spaceCallShowJoinStrip ? (
                    callActionsChecked ? (
                      <HumanChatPanelCallToolbar
                        callState={spaceCallState}
                        callKind={spaceCallKind}
                        disabled={!callUiEnabled}
                        roomCallInProgressToJoin={spaceCallToolbarJoinHint}
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
                    ) : (
                      /** #2456: still confirming this user doesn't already hold a live session
                       * elsewhere in this room — show a skeleton rather than either hiding the
                       * toolbar outright or letting a click race ahead of that check. */
                      <div className="contents" aria-hidden>
                        <Skeleton className="h-[36px] w-[36px] shrink-0 rounded-none" />
                        <Skeleton className="h-[36px] w-[36px] shrink-0 rounded-none" />
                      </div>
                    )
                  ) : null}
                  {showAuthedUi && elsewhereCallEntries.length > 0 ? (
                    <HumanChatPanelElsewhereCallIndicator
                      entries={elsewhereCallEntriesWithAvatar}
                      onSelect={handleSelectElsewhereCall}
                      label={
                        elsewhereCallEntries.length === 1
                          ? t('activeCallElsewhere', {
                              title: elsewhereCallEntries[0]?.title ?? '',
                            })
                          : t('activeCallsElsewhereCount', {
                              count: elsewhereCallEntries.length,
                            })
                      }
                    />
                  ) : null}
                </>
              ) : null
            }
          />
          {spaceCallShowRefreshUi && (
            <HumanChatPanelCallJoinStrip
              deviceCount={spaceCallRoomGroupDeviceCount}
              disabled={!callUiEnabled}
              busy={spaceCallBusyJoining}
              captureConsent={spaceCallCaptureConsent}
              roomId={roomId}
              isRefresh={spaceCallSelfStalePresence}
              othersInRoomCallCount={spaceCallOthersInRoom}
              onHangupElsewhere={() => requestRemoteGroupCallLeave()}
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
          {/* Mutually exclusive with the banner above: that one needs `showSidebarCallChrome`
              (bound call === this room), this one needs the opposite — a call here while
              bound elsewhere. Joining leaves the other call first (#2424). */}
          {currentRoomActiveCall &&
          callSessionRoomId &&
          callSessionRoomId !== roomId ? (
            <HumanChatPanelCallJoinStrip
              deviceCount={currentRoomActiveCall.participantCount}
              disabled={!callUiEnabled}
              busy={Boolean(pendingCallSwitch)}
              roomId={roomId}
              onJoinAudio={() => {
                if (!canJoinSignalThreadCall && isSignalThread) {
                  void requestSignalTeamAccess();
                  return;
                }
                handleJoinCurrentRoomCallInstead('audio');
              }}
              onJoinVideo={() => {
                if (!canJoinSignalThreadCall && isSignalThread) {
                  void requestSignalTeamAccess();
                  return;
                }
                handleJoinCurrentRoomCallInstead('video');
              }}
            />
          ) : null}
          <HumanChatPanelCallJoinInvitation
            open={joinInviteOpen}
            deviceCount={spaceCallRoomGroupDeviceCount}
            busy={spaceCallBusyJoining}
            disabled={!callUiEnabled}
            onOpenChange={setJoinInviteOpen}
            onJoinAudio={
              canJoinSignalThreadCall
                ? () => {
                    handleCallAudio();
                  }
                : undefined
            }
            onJoinVideo={() => {
              if (!canJoinSignalThreadCall && isSignalThread) {
                void requestSignalTeamAccess();
                return;
              }
              handleCallVideo();
            }}
            onDismiss={dismissJoinInvite}
          />
          {showSidebarCallChrome &&
            (inSpaceCall ||
              spaceCallState === 'error' ||
              spaceCallState === 'disconnecting') && (
              <HumanChatPanelCallBanner
                callState={spaceCallState}
                callKind={spaceCallKind}
                errorCode={spaceCallError}
                isScreensharing={spaceCallScreensharing}
                remoteScreenshareActive={spaceCallRemoteScreenshareActive}
                screenshareErrorCode={spaceCallScreenshareError}
                screenshareTabAudioMissing={spaceCallScreenshareTabAudioMissing}
                onDismissScreenshareTabAudioHint={
                  dismissSpaceCallScreenshareTabAudioHint
                }
                onRetryScreenshareWithTabAudio={() => {
                  void retrySpaceCallScreenshareWithTabAudio();
                }}
                cameraAccessBlocked={spaceCallCameraAccessBlocked}
                onDismissCameraAccessBlocked={
                  dismissSpaceCallCameraAccessBlocked
                }
                sessionRefreshFailedDuringCall={sessionRefreshFailedDuringCall}
                onReconnectMatrixSession={() => {
                  void refreshSession();
                }}
                tabBackgroundWhileInCall={
                  showFloatingDock ? false : spaceCallTabBackground
                }
                isMicrophoneMuted={spaceCallMicMuted}
                isLocalVideoMuted={spaceCallVideoMuted}
                participantCount={spaceCallRoomGroupDeviceCount}
                othersInRoomCallCount={spaceCallOthersInRoom}
                remoteMediaStall={spaceCallRemoteMediaStall}
                remoteMediaWarming={spaceCallRemoteMediaWarming}
                turnServerUnavailable={spaceCallTurnServerUnavailable}
                onDismissTurnServerUnavailable={
                  dismissSpaceCallTurnServerUnavailable
                }
                onDismissRemoteMediaStall={dismissSpaceCallRemoteMediaStall}
                onRetryRemoteMedia={retrySpaceCallRemoteMedia}
                showScaleWarning={showCallScaleWarning}
                onLeave={handleCallLeave}
                onToggleMic={handleCallToggleMic}
                onToggleCamera={handleCallToggleCamera}
                onStartScreenshare={handleCallStartScreenshare}
                onStopScreenshare={handleCallStopScreenshare}
                voiceProcessingPreset={spaceCallVoiceProcessingPreset}
                onVoiceProcessingPresetChange={
                  handleCallVoiceProcessingPresetChange
                }
                unsupportedVoiceProcessingConstraints={
                  spaceCallUnsupportedVoiceProcessingConstraints
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
                onRefresh={() => {
                  refreshSpaceCall(
                    spaceCallKind ?? 'video',
                    roomId,
                    callSpaceSlug,
                    undefined,
                    authToken,
                    resolveCallLaunchContext(),
                  );
                }}
                controlsMode="leave_only"
                canSendCallReactions={canSendCallReactions}
                localHandRaised={localHandRaised}
                onSendReaction={sendReaction}
                onToggleRaiseHand={toggleRaiseHand}
                includeReactionsWhenLeaveOnly={isTouchCallChrome}
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
        </>
      </SidebarHeader>
      {/* overflow-hidden: single scroll inside tab bodies (messages / members / mentions); avoids stacked full-height scrollbars */}
      <SidebarContent
        ref={sidebarContentRef}
        className="flex min-h-0 flex-col gap-0 overflow-hidden bg-page-background dark:bg-background-2"
        data-hypha-chat-panel=""
        data-hypha-room-id={roomId?.trim() || undefined}
      >
        {sessionRestoring ? (
          <HumanChatPanelLoader />
        ) : showAuthPrompt ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <SpaceAccessDenied
              userState={userSpaceState}
              spaceId={effectiveSpaceWeb3Id}
              spaceSlug={spaceSlug ?? undefined}
            />
          </div>
        ) : !spaceSlug?.trim() && !isDirectConversation && mode !== 'space' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <Empty>
              <p>{t('notInSpaceEmptyState')}</p>
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
                {isSignalThread && coherenceSlug ? (
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <SignalThreadMedia slug={coherenceSlug} />
                      <SignalIndicativeAmounts slug={coherenceSlug} />
                    </div>
                    <SignalTurnIntoProposalButton
                      slug={coherenceSlug}
                      title={coherenceTitle}
                      description={coherenceDescription}
                    />
                  </div>
                ) : null}
                {showSidebarCallVideo && (
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
                      liveKitRoom={spaceCallRoom}
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
                      panelMobileLayout={isMobile || prefersCoarsePointer}
                      getFloatingReactions={getFloatingReactions}
                      isHandRaised={isHandRaised}
                      getRaiseHandOrder={getRaiseHandOrder}
                      floatingReactionsVersion={floatingReactionsVersion}
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
                <HumanChatPanelConnectionBanner
                  connectionStatus={connectionStatus}
                  connectionRetryFailed={connectionRetryFailed}
                  onRetry={() => {
                    void retryMatrixConnection();
                  }}
                />
                {showPanelInteractionPrompt ? (
                  <div className="mt-0 w-full border-b border-border/70 bg-muted/40 px-3 py-2">
                    <SpaceAccessDenied
                      userState={userSpaceState}
                      spaceId={effectiveSpaceWeb3Id}
                      spaceSlug={spaceSlug ?? undefined}
                      className="py-3"
                    />
                  </div>
                ) : null}
                {signalDeepLinkNotice ? (
                  <div
                    role="alert"
                    className="mt-0 w-full border-y border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {signalDeepLinkNotice}
                  </div>
                ) : null}
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
                        {isLoadingSpaceMembers || isLoadingMatrixUserIds ? (
                          <p className="text-sm text-muted-foreground">
                            {t('loading')}
                          </p>
                        ) : (matrixUserIdsError || spaceMembersError) &&
                          signalTeamRosterMembers.length === 0 ? (
                          <p role="alert" className="text-sm text-destructive">
                            {t('signalTeamMembersLoadFailed')}
                          </p>
                        ) : signalTeamRosterMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {t('noMembers')}
                          </p>
                        ) : (
                          <div className="narrow-scrollbar grid max-h-60 gap-1 overflow-y-auto">
                            {signalTeamRosterMembers.map((member) => {
                              const matrixUserId = member.matrixUserId;
                              const selected = matrixUserId
                                ? signalTeamEditorMemberIds.includes(
                                    matrixUserId,
                                  )
                                : false;
                              const isCurrentUser =
                                matrixUserId != null &&
                                matrixUserId === currentUserId;
                              const isOwner =
                                matrixUserId != null &&
                                matrixUserId === signalTeamOwnerId;
                              const canToggle = Boolean(matrixUserId);
                              return (
                                <button
                                  key={member.personId}
                                  type="button"
                                  className={`flex items-center justify-between rounded-md px-2 py-1 text-left text-sm ${
                                    selected
                                      ? 'border border-accent-8/55 bg-accent-3/28 ring-1 ring-accent-8/35'
                                      : 'border border-transparent hover:bg-muted/70'
                                  } ${!canToggle ? 'opacity-60' : ''}`}
                                  disabled={signalTeamBusy || !canToggle}
                                  onClick={() => {
                                    if (!matrixUserId) return;
                                    if (isCurrentUser && selected) return;
                                    if (isOwner && selected) return;
                                    const next = selected
                                      ? signalTeamEditorMemberIds.filter(
                                          (id) => id !== matrixUserId,
                                        )
                                      : [
                                          ...signalTeamEditorMemberIds,
                                          matrixUserId,
                                        ];
                                    setSignalTeamDraftMemberIds(
                                      normalizeMatrixUserIds(next),
                                    );
                                  }}
                                >
                                  <SignalTeamResolvedMemberLabel
                                    candidate={{
                                      userId: matrixUserId ?? '',
                                      displayLabel: member.displayLabel,
                                    }}
                                    fallbackLabel={member.displayLabel}
                                    isOwner={isOwner}
                                    unknownMemberLabel={t('unknownMember')}
                                  />
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    {isOwner ? null : selected ? (
                                      <Check className="h-3.5 w-3.5 text-accent-11" />
                                    ) : canToggle ? (
                                      <Plus className="h-3.5 w-3.5" />
                                    ) : null}
                                    {isOwner
                                      ? t('signalTeamOwner')
                                      : !canToggle
                                      ? t('signalTeamNoChatAccount')
                                      : selected
                                      ? t('signalTeamRemoveMember')
                                      : t('signalTeamAddMember')}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
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
                {coherencePublic && !isJoining && roomId && !error ? (
                  <p
                    role="status"
                    className="border-b border-border px-3 py-2 text-1 text-neutral-11"
                  >
                    {t('publicRoomTitle')} — {t('publicWelcome')}
                  </p>
                ) : null}
                {isJoining ? (
                  <HumanChatPanelLoader showPreview />
                ) : (
                  <HumanChatPanelErrorBoundary key={roomId ?? 'messages'}>
                    <HumanChatPanelMessages
                      messages={mergedMessages}
                      roomId={roomId}
                      currentUserId={currentUserId}
                      currentUserAvatarUrl={currentUserAvatarUrl}
                      welcomeText={
                        mode === 'space' && !spaceSlug?.trim()
                          ? t('networkWelcome')
                          : mode === 'space' && spaceRoom === 'ecosystem'
                          ? t('ecosystemWelcome')
                          : mode === 'space' && spaceRoom === 'public'
                          ? t('publicWelcome')
                          : coherencePublic
                          ? t('publicWelcome')
                          : welcomePartner
                          ? t(
                              directConversationEmptyWelcomeKey({
                                isDirectConversation,
                                isStartConversation,
                              }),
                              { name: welcomePartner },
                            )
                          : undefined
                      }
                      welcomeSenderName={
                        mode === 'space' && !spaceSlug?.trim()
                          ? t('networkRoomTitle')
                          : mode === 'space' && spaceRoom === 'ecosystem'
                          ? t('ecosystemRoomTitle')
                          : mode === 'space' && spaceRoom === 'public'
                          ? t('publicRoomTitle')
                          : coherencePublic
                          ? t('publicRoomTitle')
                          : welcomePartner ?? undefined
                      }
                      onReply={
                        blockSpaceChatForMembership
                          ? undefined
                          : handleReplyToMessage
                      }
                      onEditMessage={
                        blockSpaceChatForMembership
                          ? undefined
                          : handleEditMessage
                      }
                      onDeleteMessage={
                        blockSpaceChatForMembership || archivedGroup
                          ? undefined
                          : handleDeleteMessage
                      }
                      onToggleReaction={
                        blockSpaceChatForMembership || archivedGroup
                          ? undefined
                          : handleToggleReaction
                      }
                      resolveReactionReactorLabel={(userId) =>
                        resolveMemberLabel(userId)
                      }
                      resolveMatrixMemberLabel={resolveMentionMemberLabel}
                      resolveSenderDisplayLabel={resolveSenderDisplayLabel}
                      onCancelSendPending={cancelSendInFlight}
                      firstUnreadMessageId={
                        unreadChatState.firstUnreadMessageId
                      }
                      unreadNotificationCount={
                        unreadChatState.unreadNotificationCount
                      }
                      unreadCountIsCapped={unreadChatState.unreadCountIsCapped}
                      viewportActive={sidebarOpen && activeTab === 'chat'}
                      onReachedTimelineBottom={handleReachedTimelineBottom}
                      onMarkAsReadFromBanner={handleMarkAsReadFromBanner}
                      scrollTargetEventId={scrollToEventId}
                      onConsumedScrollTarget={handleConsumedScrollTarget}
                      onScrollTargetNotFound={handleScrollTargetNotFound}
                      hasMoreOlderMessages={hasMoreOlderMessages}
                      loadingOlderMessages={loadingOlderMessages}
                      enableAutoLoadOlderMessages={
                        connectionStatus === 'connected' && !autoLoadOlderPaused
                      }
                      onLoadOlderMessages={handleLoadOlderMessages}
                    />
                  </HumanChatPanelErrorBoundary>
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
                    roomScoped={isDirectConversation}
                    calledSpecialistIds={calledAgents}
                    inCallMatrixUserIds={spaceCallInCallUserIds}
                    inOurCallSession={
                      callAppliesToCurrentChatRoom &&
                      inSpaceCall &&
                      spaceCallState === 'connected'
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
                  unreadMentionCount={bellMentionCount}
                  onMarkMentionsRead={() => {
                    void markAllUnreadMentionsRead();
                  }}
                  callJoinAlertsUnmuted={
                    callUiEnabled ? joinAlertSoundEnabled : undefined
                  }
                  onCallJoinAlertsUnmutedChange={
                    callUiEnabled ? setJoinAlertSoundEnabled : undefined
                  }
                />
              </div>
            )}
          </>
        )}
      </SidebarContent>
      {activeTab === 'chat' &&
        (Boolean(spaceSlug?.trim()) ||
          isDirectConversation ||
          (mode === 'space' && !spaceSlug?.trim())) &&
        !showAuthPrompt &&
        !blockSpaceChatForActivityAccess && (
          <SidebarFooter className="relative z-20 border-t border-border/70 bg-page-background p-0 dark:bg-background-2">
            <div>
              <HumanChatPanelErrorBoundary key={roomId ?? 'composer'}>
                <HumanChatPanelChatBar
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  mentionCandidates={composerMentionCandidates}
                  mentionPickerEnabled={mentionPickerEnabled}
                  composerLocked={chatComposerLocked}
                  composerLockedMessage={chatComposerLockedMessage}
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
                            disposeDraftAttachmentUrls(
                              draftAttachmentsRef.current,
                            );
                            setDraftAttachments([]);
                          },
                        }
                      : undefined
                  }
                  editMediaMode={Boolean(editDraft?.editMediaMode)}
                />
              </HumanChatPanelErrorBoundary>
            </div>
          </SidebarFooter>
        )}
    </>
  );
}
