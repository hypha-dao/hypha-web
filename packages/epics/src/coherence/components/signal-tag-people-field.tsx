'use client';

import React from 'react';
import { AtSign, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Input } from '@hypha-platform/ui';
import type { UseMembers } from '../../spaces';
import { useSpaceMembersAndDelegates } from '../../spaces/hooks/use-space-members-and-delegates';
import { buildSpaceRosterMentionCandidates } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import { HumanChatMentionCandidateRow } from '../../common/human-chat-panel/human-chat-mention-candidate-row';
import { mentionCandidateMatchRank } from '../../common/human-chat-panel/human-chat-mention-search';

const MAX_VISIBLE_CANDIDATES = 8;

export type SignalTagPeopleFieldProps = {
  spaceSlug: string;
  useMembers: UseMembers;
  /** Matrix user ids of the tagged space members. */
  value: string[];
  onChange: (matrixUserIds: string[]) => void;
  disabled?: boolean;
};

/**
 * `@`-tag space members while composing a signal — same roster, search and rows
 * as the chat `@` picker. Tags are delivered as a mention in the signal chat.
 */
export function SignalTagPeopleField({
  spaceSlug,
  useMembers,
  value,
  onChange,
  disabled,
}: SignalTagPeopleFieldProps) {
  const t = useTranslations('CoherenceTab');
  const { client } = useMatrix();
  const selfMatrixUserId = client?.getUserId?.() ?? null;
  const { space } = useSpaceBySlug(spaceSlug);
  const { persons } = useSpaceMembersAndDelegates({
    spaceSlug,
    web3SpaceId: space?.web3SpaceId,
    useMembers,
  });
  const personIds = React.useMemo(
    () =>
      persons
        .map((member) => member.id)
        .filter((id): id is number => Number.isFinite(id) && id > 0),
    [persons],
  );
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({
    personIds,
  });
  const candidates = React.useMemo(
    () =>
      buildSpaceRosterMentionCandidates({
        spaceMembers: persons,
        personIdToMatrixUserId,
        unknownLabel: t('unknownMember'),
      }).filter((candidate) => candidate.userId !== selfMatrixUserId),
    [persons, personIdToMatrixUserId, selfMatrixUserId, t],
  );

  const [resolvedLabels, setResolvedLabels] = React.useState<
    Record<string, string>
  >({});
  const handleLabelResolved = React.useCallback(
    (matrixUserId: string, label: string) => {
      setResolvedLabels((prev) =>
        prev[matrixUserId] === label
          ? prev
          : { ...prev, [matrixUserId]: label },
      );
    },
    [],
  );
  const labelFor = React.useCallback(
    (matrixUserId: string) =>
      resolvedLabels[matrixUserId] ||
      candidates.find((candidate) => candidate.userId === matrixUserId)
        ?.displayLabel ||
      t('unknownMember'),
    [candidates, resolvedLabels, t],
  );

  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listboxId = React.useId();

  const matches = React.useMemo(() => {
    const selected = new Set(value);
    const needle = query.replace(/^@/, '');
    const ranked = candidates
      .filter((candidate) => !selected.has(candidate.userId))
      .map((candidate) => ({
        candidate,
        rank: mentionCandidateMatchRank(
          candidate,
          needle,
          resolvedLabels[candidate.userId],
        ),
      }))
      .filter((row) => row.rank != null);
    ranked.sort(
      (a, b) => Number(a.rank === 'contains') - Number(b.rank === 'contains'),
    );
    return ranked.slice(0, MAX_VISIBLE_CANDIDATES).map((row) => row.candidate);
  }, [candidates, query, resolvedLabels, value]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const addTag = (matrixUserId: string) => {
    if (value.includes(matrixUserId)) return;
    onChange([...value, matrixUserId]);
    setQuery('');
    setActiveIndex(0);
  };
  const removeTag = (matrixUserId: string) => {
    onChange(value.filter((id) => id !== matrixUserId));
  };

  const showList = open && !disabled;

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {value.map((matrixUserId) => {
            const label = labelFor(matrixUserId);
            return (
              <li
                key={matrixUserId}
                className="inline-flex items-center gap-1 border border-border bg-background-2 py-0.5 pl-2 pr-1 text-1 text-foreground"
              >
                <span className="truncate">@{label}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeTag(matrixUserId)}
                  aria-label={t('signalFormTagPeopleRemove', { name: label })}
                  className="grid h-5 w-5 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="relative w-full text-left">
        <Input
          value={query}
          disabled={disabled}
          placeholder={t('signalFormTagPeoplePlaceholder')}
          aria-label={t('signalFormTagPeoplePlaceholder')}
          autoComplete="off"
          leftIcon={<AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          className="text-left placeholder:text-left"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (!showList || matches.length === 0) {
              if (event.key === 'Enter') event.preventDefault();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((i) => (i + 1) % matches.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const pick = matches[activeIndex];
              if (pick) addTag(pick.userId);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {showList ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 flex w-full max-h-64 flex-col items-stretch overflow-y-auto border border-border bg-background !text-left shadow-md"
          >
            {matches.length === 0 ? (
              <p className="px-3 py-1.5 text-left text-1 text-muted-foreground">
                {t('signalFormTagPeopleEmpty')}
              </p>
            ) : (
              matches.map((candidate, index) => (
                <HumanChatMentionCandidateRow
                  key={candidate.userId}
                  matrixUserId={candidate.userId}
                  matrixFallbackLabel={candidate.displayLabel}
                  matrixFallbackAvatarUrl={candidate.avatarUrl}
                  isActive={index === activeIndex}
                  className="!flex !w-full !justify-start !px-3 !text-left [&_span]:!text-left"
                  onPick={() => addTag(candidate.userId)}
                  onLabelResolved={handleLabelResolved}
                />
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
