'use client';

import React from 'react';
import { Check, Plus } from 'lucide-react';
import {
  useMatrixUserIdsByPersonIds,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { PersonAvatar } from '../../people/components/person-avatar';
import { UseMembers } from '../../spaces';
import { useSpaceMembersAndDelegates } from '../../spaces/hooks/use-space-members-and-delegates';
import { useResolvedMentionCandidateLabel } from '../../common/human-chat-panel/use-resolved-mention-candidate-label';
import {
  buildSpaceRosterSignalTeamMembers,
  personRosterDisplayLabel,
} from '../../common/human-chat-panel/build-space-roster-mention-candidates';

function normalizeMatrixUserIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of ids) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function SignalTeamPickerRow({
  matrixUserId,
  displayLabel,
  privySub,
  avatarUrl,
  selected,
  disabled,
  isOwner,
  noChatAccountLabel,
  onToggle,
}: {
  matrixUserId: string;
  displayLabel: string;
  privySub?: string;
  avatarUrl?: string | null;
  selected: boolean;
  disabled?: boolean;
  isOwner?: boolean;
  noChatAccountLabel?: string;
  onToggle: () => void;
}) {
  const t = useTranslations('CoherenceTab');
  const { resolvedLabel } = useResolvedMentionCandidateLabel({
    userId: matrixUserId,
    displayLabel,
    privySub,
  });
  const label = resolvedLabel?.trim() || displayLabel;
  const canToggle = Boolean(matrixUserId.trim());

  return (
    <button
      type="button"
      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
        selected
          ? 'border border-accent-8/55 bg-accent-3/28 ring-1 ring-accent-8/35'
          : 'border border-transparent hover:bg-muted/70'
      } ${!canToggle ? 'opacity-60' : ''}`}
      disabled={disabled || (isOwner && selected)}
      onClick={onToggle}
    >
      <span className="flex min-w-0 items-center gap-2">
        <PersonAvatar size="sm" avatarSrc={avatarUrl || ''} userName={label} />
        <span className="truncate">{label}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 pl-2 text-xs text-muted-foreground">
        {isOwner ? (
          t('createSignalTeamOwner')
        ) : selected ? (
          <>
            <Check className="h-3.5 w-3.5 text-accent-11" />
            {t('signalTeamRemoveMember')}
          </>
        ) : canToggle ? (
          <>
            <Plus className="h-3.5 w-3.5" />
            {t('signalTeamAddMember')}
          </>
        ) : (
          noChatAccountLabel
        )}
      </span>
    </button>
  );
}

export type SignalTeamMemberPickerProps = {
  spaceSlug: string;
  useMembers: UseMembers;
  ownerMatrixUserId: string | null;
  selectedMemberIds: string[];
  onSelectedMemberIdsChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function SignalTeamMemberPicker({
  spaceSlug,
  useMembers,
  ownerMatrixUserId,
  selectedMemberIds,
  onSelectedMemberIdsChange,
  disabled,
}: SignalTeamMemberPickerProps) {
  const t = useTranslations('CoherenceTab');
  const { space } = useSpaceBySlug(spaceSlug);
  const {
    persons,
    isLoading: isLoadingMembers,
    error: membersError,
  } = useSpaceMembersAndDelegates({
    spaceSlug,
    web3SpaceId: space?.web3SpaceId,
    useMembers,
  });
  const spaceMembers = persons;
  const rosterPersonIds = React.useMemo(
    () =>
      spaceMembers
        .map((member) => member.id)
        .filter((id): id is number => Number.isFinite(id) && id > 0),
    [spaceMembers],
  );
  const {
    personIdToMatrixUserId,
    isLoading: isLoadingMatrixIds,
    error: matrixIdsError,
  } = useMatrixUserIdsByPersonIds({ personIds: rosterPersonIds });

  const ownerPerson = React.useMemo(() => {
    if (!ownerMatrixUserId) return null;
    return (
      spaceMembers.find(
        (member) =>
          personIdToMatrixUserId[member.id]?.trim() === ownerMatrixUserId,
      ) ?? null
    );
  }, [ownerMatrixUserId, spaceMembers, personIdToMatrixUserId]);

  const rosterMembers = React.useMemo(() => {
    const rows = buildSpaceRosterSignalTeamMembers({
      spaceMembers: ownerMatrixUserId
        ? spaceMembers.filter(
            (member) =>
              personIdToMatrixUserId[member.id]?.trim() !== ownerMatrixUserId,
          )
        : spaceMembers,
      personIdToMatrixUserId,
      unknownLabel: t('unknownMember'),
    });

    if (!ownerMatrixUserId) return rows;

    const ownerRow = ownerPerson
      ? {
          personId: ownerPerson.id,
          matrixUserId: ownerMatrixUserId,
          displayLabel: personRosterDisplayLabel(
            ownerPerson,
            t('unknownMember'),
          ),
          avatarUrl: ownerPerson.avatarUrl ?? undefined,
        }
      : {
          personId: -1,
          matrixUserId: ownerMatrixUserId,
          displayLabel: t('createSignalTeamOwner'),
          avatarUrl: undefined,
        };

    return [ownerRow, ...rows];
  }, [ownerMatrixUserId, ownerPerson, spaceMembers, personIdToMatrixUserId, t]);

  const effectiveSelectedIds = React.useMemo(() => {
    const base = normalizeMatrixUserIds(selectedMemberIds);
    if (ownerMatrixUserId && !base.includes(ownerMatrixUserId)) {
      return normalizeMatrixUserIds([ownerMatrixUserId, ...base]);
    }
    return base;
  }, [ownerMatrixUserId, selectedMemberIds]);

  const isLoading = isLoadingMembers || isLoadingMatrixIds;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {t('signalTeamMemberListHint')}
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (matrixIdsError || membersError) && rosterMembers.length === 0 ? (
        <p role="alert" className="text-sm text-destructive">
          {t('signalTeamMembersLoadFailed')}
        </p>
      ) : rosterMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('createSignalTeamNoMembers')}
        </p>
      ) : (
        <div className="narrow-scrollbar grid max-h-60 gap-1 overflow-y-auto">
          {rosterMembers.map((member) => {
            const matrixUserId = member.matrixUserId;
            const isOwner = matrixUserId === ownerMatrixUserId;
            const selected = matrixUserId
              ? effectiveSelectedIds.includes(matrixUserId)
              : false;
            const canToggle = Boolean(matrixUserId);
            return (
              <SignalTeamPickerRow
                key={member.personId}
                matrixUserId={matrixUserId ?? ''}
                displayLabel={member.displayLabel}
                privySub={undefined}
                avatarUrl={member.avatarUrl}
                selected={selected}
                disabled={disabled || !canToggle}
                isOwner={isOwner}
                noChatAccountLabel={t('signalTeamNoChatAccount')}
                onToggle={() => {
                  if (!matrixUserId) return;
                  if (isOwner && selected) return;
                  const memberIdsOnly = effectiveSelectedIds.filter(
                    (id) => id !== ownerMatrixUserId,
                  );
                  const next = selected
                    ? memberIdsOnly.filter((id) => id !== matrixUserId)
                    : [...memberIdsOnly, matrixUserId];
                  onSelectedMemberIdsChange(normalizeMatrixUserIds(next));
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
