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
import { shortenMatrixIdForDisplay } from './matrix-room-member-display';

type HumanChatPanelMembersProps = {
  useMembers: UseMembers;
  spaceSlug?: string;
  /** Active Matrix room for presence (space or coherence chat). */
  roomId?: string | null;
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
  const { getRoomMembers, isMatrixAvailable, isAuthenticated } = useMatrix();
  const [onlineCount, setOnlineCount] = useState(0);
  const { space } = useSpaceBySlug(spaceSlug ?? '');
  const {
    persons: members,
    isLoading,
    error,
  } = useSpaceMembersAndDelegates({
    spaceSlug,
    web3SpaceId: space?.web3SpaceId,
    useMembers,
  });
  const totalCount = members.length + calledSpecialists.length;

  useEffect(() => {
    if (!roomId || !isMatrixAvailable || !isAuthenticated) {
      setOnlineCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const matrixMembers = await getRoomMembers(roomId);
        if (cancelled) return;
        setOnlineCount(matrixMembers.filter((m) => m.presence).length);
      } catch {
        if (!cancelled) setOnlineCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, isMatrixAvailable, isAuthenticated, getRoomMembers]);

  const hasExternalCall = !inOurCallSession && inCallMatrixUserIds.length > 0;

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
      {isLoading && members.length === 0 && (
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
      {!isLoading && error && members.length === 0 && (
        <div
          role="alert"
          className="px-2 py-4 text-center text-sm text-destructive"
        >
          {t('signalTeamMembersLoadFailed')}
        </div>
      )}
      {!isLoading &&
        !error &&
        members.length === 0 &&
        calledSpecialists.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('noMembers')}
          </div>
        )}
      {members.map((member) => {
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
            <span className="text-sm text-foreground truncate">
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
