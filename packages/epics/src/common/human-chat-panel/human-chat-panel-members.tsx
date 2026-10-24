'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Skeleton } from '@hypha-platform/ui';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixUserIdToCanonicalPrivySub,
  specialistById,
  uniqueCanonicalPrivySubsFromMxids,
  useMatrix,
  usePeopleBySubs,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  getAgentAvatarInitials,
  tagGroupAccentClass,
} from '../ai-agent-competencies';
import { PersonAvatar } from '../../people/components/person-avatar';
import { textMatchesPeopleSearch } from '../../people/components/member-connections';
import { UseMembers } from '../../spaces';
import { useSpaceMembersAndDelegates } from '../../spaces/hooks/use-space-members-and-delegates';
import {
  isHyphaBotMatrixIdentity,
  matrixMemberDisplayLabel,
  shortenMatrixIdForDisplay,
} from './matrix-room-member-display';

type RoomScopedMember = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  nickname?: string | null;
  slug?: string | null;
  online: boolean;
  unresolved?: boolean;
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
  const calledSpecialists = useMemo(
    () =>
      calledIds.flatMap((id) => {
        const specialist = specialistById(id);
        return specialist ? [specialist] : [];
      }),
    [calledIds],
  );
  const { client, getRoomMembers, isMatrixAvailable, isAuthenticated } =
    useMatrix();
  const [memberQuery, setMemberQuery] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [roomMembers, setRoomMembers] = useState<RoomScopedMember[]>([]);
  const [roomMembersLoading, setRoomMembersLoading] = useState(false);
  useEffect(() => {
    setMemberQuery('');
    setRoomMembers([]);
    setOnlineCount(0);
  }, [roomId]);
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
  const memberSubs = useMemo(
    () =>
      uniqueCanonicalPrivySubsFromMxids(
        roomMembers.map((member) => member.userId),
      ),
    [roomMembers],
  );
  const { peopleBySub, isLoading: peopleBySubLoading } = usePeopleBySubs({
    subs: roomScoped ? memberSubs : [],
  });
  const resolvedRoomMembers = useMemo(() => {
    return roomMembers.map((member) => {
      const sub = matrixUserIdToCanonicalPrivySub(member.userId);
      const person = sub ? peopleBySub.get(sub) : undefined;
      const hyphaName =
        [person?.name, person?.surname].filter(Boolean).join(' ').trim() ||
        person?.nickname?.trim() ||
        '';
      const raw = hyphaName || member.displayName;
      const technical = looksLikeTechnicalMatrixDisplayName(raw, member.userId);
      return {
        ...member,
        displayName: technical ? '' : raw,
        avatarUrl: person?.avatarUrl || member.avatarUrl || undefined,
        nickname: person?.nickname ?? member.nickname ?? null,
        slug: person?.slug ?? member.slug ?? null,
        unresolved: technical,
      };
    });
  }, [peopleBySub, roomMembers]);
  const visibleRoomMembers = useMemo(() => {
    return resolvedRoomMembers.filter((member) =>
      textMatchesPeopleSearch(
        [member.displayName, member.nickname, member.slug],
        memberQuery,
      ),
    );
  }, [memberQuery, resolvedRoomMembers]);
  const visibleSpaceMembers = useMemo(() => {
    return members.filter((member) => {
      const displayName =
        [member.name, member.surname].filter(Boolean).join(' ') ||
        member.nickname ||
        '';
      return textMatchesPeopleSearch(
        [displayName, member.nickname, member.slug],
        memberQuery,
      );
    });
  }, [memberQuery, members]);
  const visibleCalledSpecialists = useMemo(() => {
    return calledSpecialists.filter((specialist) =>
      textMatchesPeopleSearch([tCoherence(specialist.roleKey)], memberQuery),
    );
  }, [calledSpecialists, memberQuery, tCoherence]);
  const listedCount = roomScoped
    ? visibleRoomMembers.length
    : visibleSpaceMembers.length;
  const totalCount = roomScoped
    ? resolvedRoomMembers.length + calledSpecialists.length
    : members.length + calledSpecialists.length;

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
        setOnlineCount(
          matrixMembers.filter(
            (member) =>
              member.presence && !isHyphaBotMatrixIdentity(member.userId),
          ).length,
        );
        if (roomScoped) {
          const room = client?.getRoom(roomId);
          const next: RoomScopedMember[] = matrixMembers
            .filter((entry) => !isHyphaBotMatrixIdentity(entry.userId))
            .map((entry) => {
              const member = room?.getMember(entry.userId);
              return {
                userId: entry.userId,
                displayName: member
                  ? matrixMemberDisplayLabel(member, entry.userId)
                  : '',
                online: entry.presence,
              };
            });
          next.sort((left, right) =>
            (left.displayName || left.userId).localeCompare(
              right.displayName || right.userId,
              undefined,
              { sensitivity: 'base' },
            ),
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
    visibleCalledSpecialists.length === 0;
  const emptyCopy = memberQuery.trim() ? t('membersNoMatches') : t('noMembers');

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
              .filter((id) => !isHyphaBotMatrixIdentity(id))
              .map((id) => shortenMatrixIdForDisplay(id))
              .filter(Boolean)
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
      <label className="relative mb-2 min-w-0">
        <span className="sr-only">{t('membersSearch')}</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-9"
          strokeWidth={1.5}
          aria-hidden
        />
        <input
          value={memberQuery}
          onChange={(event) => setMemberQuery(event.target.value)}
          placeholder={t('membersSearch')}
          data-testid="chat-panel-members-search"
          className="h-10 w-full rounded-none border border-border bg-background pr-3 pl-10 text-2 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
      </label>
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
          {emptyCopy}
        </div>
      )}
      {roomScoped
        ? visibleRoomMembers.map((member) => {
            const pendingName =
              member.unresolved && peopleBySubLoading && !member.displayName;
            const label = member.displayName || t('unknownMember');
            return (
              <div
                key={member.userId}
                className="flex items-center gap-3 rounded-none px-2 py-1.5 transition-colors hover:bg-foreground/[0.04]"
                data-testid="chat-panel-member-item"
              >
                {pendingName ? (
                  <>
                    <PersonAvatar
                      isLoading
                      size="md"
                      className="rounded-full"
                    />
                    <Skeleton width="120px" height="16px" loading>
                      <div />
                    </Skeleton>
                  </>
                ) : (
                  <>
                    <PersonAvatar
                      avatarSrc={member.avatarUrl}
                      userName={label}
                      size="md"
                      className="rounded-full"
                      matrixUserId={member.userId}
                    />
                    <span className="truncate text-sm text-foreground">
                      {label}
                      {currentUserMatrixId &&
                      member.userId === currentUserMatrixId
                        ? ` (${t('you')})`
                        : ''}
                    </span>
                  </>
                )}
              </div>
            );
          })
        : visibleSpaceMembers.map((member) => {
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
                  personId={member.id}
                />
                <span className="truncate text-sm text-foreground">
                  {displayName}
                </span>
              </div>
            );
          })}
      {visibleCalledSpecialists.map((specialist) => {
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
