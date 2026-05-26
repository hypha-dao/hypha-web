'use client';

import React from 'react';
import { Check, Plus } from 'lucide-react';
import {
  Person,
  useMatrixUserIdsByPrivySubs,
} from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { PersonAvatar } from '../../people/components/person-avatar';
import { UseMembers } from '../../spaces';
import { useResolvedMentionCandidateLabel } from '../../common/human-chat-panel/use-resolved-mention-candidate-label';

function personRosterLabel(p: Person, unknownLabel: string): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (p.nickname?.trim()) return p.nickname.trim();
  return unknownLabel;
}

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
  onToggle,
}: {
  matrixUserId: string;
  displayLabel: string;
  privySub?: string;
  avatarUrl?: string | null;
  selected: boolean;
  disabled?: boolean;
  isOwner?: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('CoherenceTab');
  const { resolvedLabel } = useResolvedMentionCandidateLabel({
    userId: matrixUserId,
    displayLabel,
    privySub,
  });
  const label = resolvedLabel?.trim() || displayLabel;

  return (
    <button
      type="button"
      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
        selected
          ? 'border border-accent-8/55 bg-accent-3/28 ring-1 ring-accent-8/35'
          : 'border border-transparent hover:bg-muted/70'
      }`}
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
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" />
            {t('signalTeamAddMember')}
          </>
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
  const { persons, isLoading: isLoadingMembers } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });
  const spaceMembers = persons.data;
  const privySubs = React.useMemo(
    () =>
      spaceMembers
        .map((member) => member.sub?.trim())
        .filter((sub): sub is string => Boolean(sub)),
    [spaceMembers],
  );
  const { subToMatrixUserId, isLoading: isLoadingMatrixIds } =
    useMatrixUserIdsByPrivySubs({ privySubs });

  const ownerPerson = React.useMemo(() => {
    if (!ownerMatrixUserId) return null;
    return (
      spaceMembers.find(
        (member) =>
          member.sub?.trim() &&
          subToMatrixUserId[member.sub.trim()] === ownerMatrixUserId,
      ) ?? null
    );
  }, [ownerMatrixUserId, spaceMembers, subToMatrixUserId]);

  const selectableMembers = React.useMemo(() => {
    const rows: Array<{
      userId: string;
      displayLabel: string;
      privySub?: string;
      avatarUrl?: string | null;
    }> = [];

    if (ownerMatrixUserId) {
      rows.push({
        userId: ownerMatrixUserId,
        displayLabel: ownerPerson
          ? personRosterLabel(ownerPerson, t('unknownMember'))
          : t('createSignalTeamOwner'),
        privySub: ownerPerson?.sub?.trim(),
        avatarUrl: ownerPerson?.avatarUrl,
      });
    }

    for (const member of spaceMembers) {
      const sub = member.sub?.trim();
      if (!sub) continue;
      const matrixUserId = subToMatrixUserId[sub];
      if (!matrixUserId) continue;
      if (ownerMatrixUserId && matrixUserId === ownerMatrixUserId) continue;
      rows.push({
        userId: matrixUserId,
        displayLabel: personRosterLabel(member, t('unknownMember')),
        privySub: sub,
        avatarUrl: member.avatarUrl,
      });
    }

    return rows.sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel, undefined, {
        sensitivity: 'base',
      }),
    );
  }, [ownerMatrixUserId, ownerPerson, spaceMembers, subToMatrixUserId, t]);

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
      ) : selectableMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('createSignalTeamNoMembers')}
        </p>
      ) : (
        <div className="grid gap-1">
          {selectableMembers.map((member) => {
            const isOwner = member.userId === ownerMatrixUserId;
            const selected = effectiveSelectedIds.includes(member.userId);
            return (
              <SignalTeamPickerRow
                key={member.userId}
                matrixUserId={member.userId}
                displayLabel={member.displayLabel}
                privySub={member.privySub}
                avatarUrl={member.avatarUrl}
                selected={selected}
                disabled={disabled}
                isOwner={isOwner}
                onToggle={() => {
                  if (isOwner && selected) return;
                  const next = selected
                    ? selectedMemberIds.filter((id) => id !== member.userId)
                    : [...selectedMemberIds, member.userId];
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
