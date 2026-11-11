'use client';

import {
  formatQuestCalendarDate,
  questHtmlHasVisibleText,
  type QuestMilestoneStatus,
  type QuestReward,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useState } from 'react';
import { PersonAvatar } from '../../people/components/person-avatar';
import type { ExtendedToken } from '../../treasury/hooks/use-tokens';
import { QuestSectionMarkdown } from './quest-section-markdown';
import { QuestRewardTokenCard } from './quest-reward-tokens';

const LABEL_CLASS =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11';

/** Same type as a milestone date line. */
const MILESTONE_DATE_CLASS = 'text-2 leading-relaxed text-neutral-11';

/** Same type as the Scope card's "In Scope" label. */
const SCOPE_LABEL_CLASS =
  'text-2 font-semibold leading-relaxed text-foreground';

/**
 * Stored quest-participant display label (`roleLabel`).
 * Empty text is not a role. Quest lead identity still reads "Lead" when no
 * label was saved. A blank non-lead does not become the placeholder "Participant".
 */
export function questParticipantRoleText(member: {
  roleLabel?: string | null;
  isLead?: boolean;
}): string | null {
  const stored = member.roleLabel?.trim() ?? '';
  if (stored) return stored;
  if (member.isLead) return 'Lead';
  return null;
}

/**
 * Real lead identity only. A blank name is omitted rather than replaced
 * with "Lead" or an em dash.
 */
export function resolveQuestLeadIdentity(input: {
  leadName?: string | null;
  avatarSrc?: string | null;
  personId?: number | null;
}): { name: string; avatarSrc?: string; personId?: number } | null {
  const name = input.leadName?.trim() ?? '';
  if (!name) return null;
  return {
    name,
    avatarSrc: input.avatarSrc?.trim() || undefined,
    personId: input.personId ?? undefined,
  };
}

export function QuestLeadIdentity({
  name,
  avatarSrc,
  personId,
}: {
  name: string;
  avatarSrc?: string;
  personId?: number;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-neutral-11"
      data-testid="quest-lead-line"
    >
      <span data-testid="quest-lead-label">Lead</span>
      <span data-testid="quest-lead-avatar" className="inline-flex">
        <PersonAvatar
          size="sm"
          shape="circle"
          showPresence={false}
          avatarSrc={avatarSrc}
          userName={name}
          personId={personId}
        />
      </span>
      <span
        className="font-medium text-foreground"
        data-testid="quest-lead-name"
      >
        {name}
      </span>
    </div>
  );
}

export function QuestDetailSubheading({
  lead,
}: {
  lead: { name: string; avatarSrc?: string; personId?: number } | null;
}) {
  if (!lead) return null;
  return (
    <div data-testid="quest-detail-subheading">
      <QuestLeadIdentity
        name={lead.name}
        avatarSrc={lead.avatarSrc}
        personId={lead.personId}
      />
    </div>
  );
}

export function questMilestoneMetaLines(
  milestone: { ownerName?: string | null; dueDate?: string | null },
  locale: string,
): { owner: string | null; date: string | null } {
  const owner = milestone.ownerName?.trim() || null;
  const rawDate = milestone.dueDate?.trim() ?? '';
  const formatted = rawDate
    ? formatQuestCalendarDate(rawDate, locale).trim()
    : '';
  return { owner, date: formatted || null };
}

function milestoneStatusMeta(status: QuestMilestoneStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'done':
      return {
        label: 'Done',
        className: 'bg-[#e3f4ea] text-[#2e9e5b] dark:bg-success-3',
      };
    case 'in_progress':
      return {
        label: 'In progress',
        className: 'bg-[#edebff] text-[#4b4bff] dark:bg-accent-3',
      };
    default:
      return {
        label: 'Not started',
        className: 'bg-neutral-3 text-neutral-11',
      };
  }
}

function toggleExpandedId(
  current: ReadonlySet<number>,
  id: number,
): Set<number> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export type QuestMilestoneCardModel = {
  id: number;
  order: number;
  name: string;
  description: string;
  dueDate: string | null;
  ownerName: string | null;
  status: QuestMilestoneStatus;
  avatarSrc?: string | null;
  personId?: number | null;
};

function MemberPortrait({
  name,
  avatarSrc,
  personId,
}: {
  name: string;
  avatarSrc?: string | null;
  personId?: number | null;
}) {
  const initial = name.trim()[0]?.toUpperCase() ?? '';
  if (avatarSrc?.trim()) {
    return (
      <PersonAvatar
        size="sm"
        shape="circle"
        showPresence={false}
        avatarSrc={avatarSrc}
        userName={name}
        personId={personId && personId > 0 ? personId : undefined}
      />
    );
  }
  return (
    <span
      className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background"
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function QuestMilestonesCard({
  milestones,
  locale,
  onEdit,
}: {
  milestones: readonly QuestMilestoneCardModel[];
  locale: string;
  onEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => {
    const current = milestones.find((m) => m.status === 'in_progress');
    return new Set(current ? [current.id] : []);
  });

  return (
    <section
      className="border border-border bg-background p-5"
      data-testid="quest-overview-milestones"
    >
      <CardHeading title="Milestones" onEdit={onEdit} />
      <div className="divide-y divide-border">
        {milestones.map((milestone) => {
          const meta = milestoneStatusMeta(milestone.status);
          const lines = questMilestoneMetaLines(milestone, locale);
          const isOpen = expanded.has(milestone.id);
          const showDescription = questHtmlHasVisibleText(
            milestone.description,
          );
          return (
            <div key={milestone.id} className="py-2.5 first:pt-0">
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) =>
                    toggleExpandedId(current, milestone.id),
                  )
                }
                className="flex w-full items-start gap-3 text-left"
                aria-expanded={isOpen}
                data-testid={`quest-milestone-toggle-${milestone.id}`}
              >
                <span className="w-8 shrink-0 text-2 font-semibold leading-relaxed text-neutral-11">
                  M{milestone.order}
                </span>
                <span
                  className="min-w-0 flex-1"
                  data-testid={`quest-milestone-meta-${milestone.id}`}
                >
                  <span className="block break-words text-2 font-semibold leading-relaxed text-foreground [overflow-wrap:anywhere]">
                    {milestone.name}
                  </span>
                  {lines.owner ? (
                    <span
                      className="mt-1 flex items-center gap-2 text-2 leading-relaxed text-neutral-11"
                      data-testid={`quest-milestone-owner-${milestone.id}`}
                    >
                      <MemberPortrait
                        name={lines.owner}
                        avatarSrc={milestone.avatarSrc}
                        personId={milestone.personId}
                      />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                        {lines.owner}
                      </span>
                    </span>
                  ) : null}
                  {lines.date ? (
                    <span
                      className={`mt-1 block break-words ${MILESTONE_DATE_CLASS} [overflow-wrap:anywhere]`}
                      data-testid={`quest-milestone-date-${milestone.id}`}
                    >
                      {lines.date}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'shrink-0 px-2 py-0.5 text-2 font-semibold leading-relaxed',
                    meta.className,
                  )}
                >
                  {meta.label}
                </span>
                {isOpen ? (
                  <ChevronUp className="mt-1 size-4 shrink-0 text-neutral-11" />
                ) : (
                  <ChevronDown className="mt-1 size-4 shrink-0 text-neutral-11" />
                )}
              </button>
              {isOpen && showDescription ? (
                <div className="mt-2 pl-11">
                  <QuestSectionMarkdown
                    markdown={milestone.description}
                    empty=""
                    variant="body"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export type QuestParticipantCardModel = {
  id: number;
  memberName: string;
  roleLabel?: string | null;
  isLead?: boolean;
  responsibilities: readonly string[];
  avatarSrc?: string | null;
  personId?: number | null;
};

export type QuestDraftParticipantView = {
  memberName: string;
  roleLabel?: string | null;
  isLead?: boolean;
  responsibilities: readonly string[];
  avatarSrc?: string;
  personId?: number;
};

/**
 * Unsaved create-draft participants summary. Shows the same stored role as
 * the persisted Participants card, including the lead fallback, and keeps
 * responsibility bullets. A blank role stays blank.
 */
export function QuestDraftParticipantsCard({
  members,
  onEdit,
}: {
  members: readonly QuestDraftParticipantView[];
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      data-testid="draft-section-members"
      className="flex w-full flex-col items-start gap-2 border border-border bg-background p-3.5 text-left hover:border-foreground/40"
    >
      <div className="flex w-full items-center justify-between">
        <span className={LABEL_CLASS}>Participants</span>
        <span className="text-xs text-neutral-11">✎</span>
      </div>
      <div className="w-full divide-y divide-border/70">
        {members.length === 0 ? (
          <p className="text-[13px]">
            <span className="text-neutral-11">
              Not set yet — reply in chat or click to edit
            </span>
          </p>
        ) : null}
        {members.map((member, index) => {
          const role = questParticipantRoleText(member);
          return (
            <div
              key={`${member.memberName}-${index}`}
              className="flex items-start gap-2 py-2.5 first:pt-1 last:pb-0"
            >
              <PersonAvatar
                size="sm"
                shape="circle"
                showPresence={false}
                avatarSrc={member.avatarSrc}
                userName={member.memberName}
                personId={member.personId}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="break-words text-[13px] font-semibold text-foreground">
                  {member.memberName}
                </p>
                {role ? (
                  <p
                    className="break-words text-[11px] text-neutral-11"
                    data-testid={`draft-participant-role-${index}`}
                  >
                    {role}
                  </p>
                ) : null}
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-11">
                  RESPONSIBILITY
                </p>
                <div className="space-y-0.5 text-xs text-foreground">
                  {member.responsibilities.map((item, itemIndex) => (
                    <p key={itemIndex} className="flex gap-1.5">
                      <span className="text-neutral-11">•</span>
                      <span className="break-words [overflow-wrap:anywhere]">
                        {item}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}

export function QuestParticipantsCard({
  members,
  onEdit,
}: {
  members: readonly QuestParticipantCardModel[];
  onEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => {
    const first = members[0]?.id;
    return new Set(first == null ? [] : [first]);
  });

  return (
    <section
      className="border border-border bg-background p-5"
      data-testid="quest-overview-members"
    >
      <CardHeading title="Participants" onEdit={onEdit} />
      <div className="divide-y divide-border">
        {members.map((member) => {
          const isOpen = expanded.has(member.id);
          const role = questParticipantRoleText(member);
          const points = member.responsibilities
            .map((item) => item.trim())
            .filter(Boolean);
          return (
            <div key={member.id} className="py-2.5 first:pt-0">
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) => toggleExpandedId(current, member.id))
                }
                className="flex w-full items-start gap-2.5 text-left"
                aria-expanded={isOpen}
                data-testid={`quest-participant-toggle-${member.id}`}
              >
                {member.avatarSrc?.trim() ? (
                  <PersonAvatar
                    size="sm"
                    shape="circle"
                    showPresence={false}
                    avatarSrc={member.avatarSrc.trim()}
                    userName={member.memberName}
                    personId={
                      member.personId && member.personId > 0
                        ? member.personId
                        : undefined
                    }
                  />
                ) : (
                  <span className="grid size-6 shrink-0 place-items-center bg-foreground text-[10px] font-bold text-background">
                    {(member.memberName.trim()[0] ?? '').toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-semibold leading-relaxed text-foreground">
                    {member.memberName}
                  </span>
                  {role ? (
                    <span className="block break-words text-2 leading-relaxed text-neutral-11">
                      {role}
                    </span>
                  ) : null}
                </span>
                {isOpen ? (
                  <ChevronUp className="mt-1 size-4 shrink-0 text-neutral-11" />
                ) : (
                  <ChevronDown className="mt-1 size-4 shrink-0 text-neutral-11" />
                )}
              </button>
              {isOpen && points.length > 0 ? (
                <div className="mt-2 space-y-1 pl-8">
                  <p className={SCOPE_LABEL_CLASS}>Responsibility</p>
                  <div className="space-y-1.5 text-[13.5px] leading-relaxed text-foreground">
                    {points.map((item, index) => (
                      <p key={`${member.id}-${index}`} className="flex gap-2">
                        <span className="font-semibold text-neutral-11">•</span>
                        <span className="break-words [overflow-wrap:anywhere]">
                          {item}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function QuestTargetDateCard({
  label,
  onEdit,
}: {
  label: string;
  onEdit?: () => void;
}) {
  return (
    <section
      className="border border-border bg-background p-5"
      data-testid="quest-overview-target-date"
    >
      <CardHeading title="Target Date" onEdit={onEdit} />
      <p className={MILESTONE_DATE_CLASS} data-testid="quest-target-date-value">
        {label}
      </p>
    </section>
  );
}

export function QuestRewardStrip({
  rewards,
  spaceTokens = [],
}: {
  rewards: readonly QuestReward[];
  spaceTokens?: readonly ExtendedToken[];
}) {
  return (
    <div
      className="flex flex-wrap items-start gap-3"
      data-testid="quest-reward-strip"
    >
      {rewards.map((reward, index) => (
        <QuestRewardTokenCard
          key={`${reward.token}-${reward.amount}-${index}`}
          reward={reward}
          spaceTokens={spaceTokens}
          compact
          className="w-[11.5rem] max-w-full"
        />
      ))}
    </div>
  );
}

function CardHeading({
  title,
  onEdit,
}: {
  title: string;
  onEdit?: () => void;
}) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </h2>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-11 hover:text-foreground"
        >
          <Pencil className="size-3" aria-hidden />
          Edit
        </button>
      ) : null}
    </div>
  );
}
