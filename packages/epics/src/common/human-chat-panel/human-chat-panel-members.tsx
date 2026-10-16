'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@hypha-platform/ui';
import {
  specialistById,
  useMatrix,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  getAgentAvatarInitials,
  tagGroupAccentClass,
} from '../ai-agent-competencies';
import { PersonAvatar } from '../../people/components/person-avatar';
import { UseMembers } from '../../spaces';
import { useSpaceMembersAndDelegates } from '../../spaces/hooks/use-space-members-and-delegates';
import {
  matrixMemberDisplayLabel,
  shortenMatrixIdForDisplay,
} from './matrix-room-member-display';

type RoomScopedMember = {
  userId: string;
  displayName: string;
  online: boolean;
};

type HumanChatPanelMembersProps = {
  useMembers: UseMembers;
  spaceSlug?: string;
  /** Active Matrix room for presence (space or coherence chat). */
  roomId?: string | null;
  /**
   * PM / group chat: list only Matrix room members, not a space roster.
   */
  roomScoped?: boolean;
  /** Matrix @user:server ids with devices in the room group call. */
  inCallMatrixUserIds?: string[];
  /** Local user has joined the `GroupCall` in this room. */
  inOurCallSession?: boolean;
  currentUserMatrixId?: string | null;
  /** Specialists already called in this room, first call first. */
  calledSpecialistIds?: readonly string[];
};

export function HumanChatPanelMembers({
  useMembers,
  spaceSlug,
  roomId,
  roomScoped = false,
  inCallMatrixUserIds = [],
  inOurCallSession = false,
  currentUserMatrixId,
  calledSpecialistIds: calledIds = [],
}: HumanChatPanelMembersProps) {
  const t = useTranslations('HumanChatPanel');
  const tCoherence = useTranslations('CoherenceTab');
  const calledSpecialists = calledIds.flatMap((id) => {
    const specialist = specialistById(id);
    return specialist ? [specialist] : [];
  });
  const { client, getRoomMembers, isMatrixAvailable, isAuthenticated } =
    useMatrix();
  const [onlineCount, setOnlineCount] = useState(0);
  const [roomMembers, setRoomMembers] = useState<RoomScopedMember[]>([]);
  const [roomMembersLoading, setRoomMembersLoading] = useState(false);
  const { space } = useSpaceBySlug(roomScoped ? '' : spaceSlug ?? '');
  const {
    persons: members,
    isLoading,
    error,
  } = useSpaceMembersAndDelegates({
    spaceSlug: roomScoped ? undefined : spaceSlug,
    web3SpaceId: roomScoped ? undefined : space?.web3SpaceId,
    useMembers,
  });
  const listedCount = roomScoped ? roomMembers.length : members.length;
  const totalCount = listedCount + calledSpecialists.length;

  useEffect(() => {
    if (!roomId || !isMatrixAvailable || !isAuthenticated) {
      setOnlineCount(0);
      if (roomScoped) setRoomMembers([]);
      return;
    }
    let cancelled = false;
    if (roomScoped) setRoomMembersLoading(true);
    void (async () => {
      try {
        const matrixMembers = await getRoomMembers(roomId);
        if (cancelled) return;
        setOnlineCount(matrixMembers.filter((m) => m.presence).length);
        if (roomScoped) {
          const room = client?.getRoom(roomId);
          const next: RoomScopedMember[] = matrixMembers.map((entry) => {
            const member = room?.getMember(entry.userId);
            return {
              userId: entry.userId,
              displayName: member
                ? matrixMemberDisplayLabel(member, entry.userId)
                : shortenMatrixIdForDisplay(entry.userId),
              online: entry.presence,
            };
          });
          next.sort((left, right) =>
            left.displayName.localeCompare(right.displayName, undefined, {
              sensitivity: 'base',
            }),
          );
          setRoomMembers(next);
        }
      } catch {
        if (!cancelled) {
          setOnlineCount(0);
          if (roomScoped) setRoomMembers([]);
        }
      } finally {
        if (!cancelled && roomScoped) setRoomMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    client,
    getRoomMembers,
    isAuthenticated,
    isMatrixAvailable,
    roomId,
    roomScoped,
  ]);

  const hasExternalCall = !inOurCallSession && inCallMatrixUserIds.length > 0;
  const showSpaceLoading = !roomScoped && isLoading && members.length === 0;
  const showRoomLoading =
    roomScoped && roomMembersLoading && roomMembers.length === 0;
  const showSpaceError =
    !roomScoped && !isLoading && error && members.length === 0;
  const showEmpty =
    !showSpaceLoading &&
    !showRoomLoading &&
    !showSpaceError &&
    listedCount === 0 &&
    calledSpecialists.length === 0;

  return (
    <div
      className="flex flex-col gap-1 px-3 py-3"
      data-testid="chat-panel-members"
    >
      {hasExternalCall && (
        <div className="mb-2 rounded-md border border-border/60 bg-accent-9/10 px-2.5 py-2 text-xs text-foreground">
          <p className="font-medium">{t('callMembersTabJoinCallTitle')}</p>
          <p className="mt-1 text-muted-foreground">
            {t('callMembersTabJoinCallBody')}
          </p>
        </div>
      )}
      {inOurCallSession && inCallMatrixUserIds.length > 0 && (
        <div className="mb-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-2 text-xs text-foreground">
          <p className="font-medium">
            {t('callMembersTabInCallPreamble', {
              count: inCallMatrixUserIds.length,
            })}
          </p>
          <p className="mt-1 break-words text-muted-foreground">
            {inCallMatrixUserIds
              .map((id) => shortenMatrixIdForDisplay(id))
              .join(' · ')}
          </p>
        </div>
      )}
      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
        {t('membersCount', {
          count: totalCount,
          online: onlineCount,
        })}
      </div>
      {(showSpaceLoading || showRoomLoading) && (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md px-2 py-1.5"
            >
              <PersonAvatar isLoading size="md" className="rounded-full" />
              <Skeleton width="120px" height="16px" loading>
                <div />
              </Skeleton>
            </div>
          ))}
        </div>
      )}
      {showSpaceError && (
        <div
          role="alert"
          className="px-2 py-4 text-center text-sm text-destructive"
        >
          {t('signalTeamMembersLoadFailed')}
        </div>
      )}
      {showEmpty && (
        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
          {t('noMembers')}
        </div>
      )}
      {roomScoped
        ? roomMembers.map((member) => (
            <div
              key={member.userId}
              className="flex items-center gap-3 rounded-none px-2 py-1.5 transition-colors hover:bg-foreground/[0.04]"
              data-testid="chat-panel-member-item"
            >
              <PersonAvatar
                userName={member.displayName}
                size="md"
                className="rounded-full"
              />
              <span className="truncate text-sm text-foreground">
                {member.displayName}
                {currentUserMatrixId && member.userId === currentUserMatrixId
                  ? ` (${t('you')})`
                  : ''}
              </span>
            </div>
          ))
        : members.map((member) => {
            const displayName =
              [member.name, member.surname].filter(Boolean).join(' ') ||
              member.nickname ||
              t('unknownMember');

            return (
              <div
                key={member.slug ?? member.id}
                className="flex items-center gap-3 rounded-none px-2 py-1.5 transition-colors hover:bg-foreground/[0.04]"
                data-testid="chat-panel-member-item"
              >
                <PersonAvatar
                  avatarSrc={member.avatarUrl}
                  userName={displayName}
                  size="md"
                  className="rounded-full"
                />
                <span className="truncate text-sm text-foreground">
                  {displayName}
                </span>
              </div>
            );
          })}
      {calledSpecialists.map((specialist) => {
        const role = tCoherence(specialist.roleKey);
        return (
          <div
            key={specialist.id}
            className="flex items-center gap-3 rounded-none px-2 py-1.5"
            data-testid="chat-panel-member-item"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-semibold ${tagGroupAccentClass(
                specialist.id,
              )}`}
              aria-hidden
            >
              {getAgentAvatarInitials(role)}
            </div>
            <span className="truncate text-sm text-foreground">{role}</span>
          </div>
        );
      })}
    </div>
  );
}
