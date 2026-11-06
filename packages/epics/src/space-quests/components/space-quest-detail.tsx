'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_HEALTH_STATES,
  canMemberEditQuest,
  isViewerQuestLead,
  bulletsToMarkdownList,
  useMe,
  type QuestHealthState,
  type QuestMilestoneStatus,
  type QuestRecord,
  type QuestStatus,
  type QuestUpdateRecord,
  type schemaPatchSpaceQuest,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Skeleton,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import { QuestSectionMarkdown } from './quest-section-markdown';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { z } from 'zod';
import {
  deleteSpaceQuestRequest,
  findQuestSpaceMember,
  findQuestSpaceMemberId,
  patchSpaceQuestRequest,
  postSpaceQuestUpdateRequest,
  toQuestSpaceMemberPersons,
  useQuestSpaceMembers,
  useSpaceQuestDetail,
} from '../hooks/use-space-quests';
import {
  useAiPanel,
  useHumanChatPanel,
  type SpaceQuestDraftChatMessage,
} from '../../common/human-chat-panel-context';
import { recordMobilizedAiAgentsForQuestion } from '../../common/ai-agent-competencies';
import {
  EditQuestDeliverablesModal,
  EditQuestGoalModal,
  EditQuestLeadModal,
  EditQuestMembersModal,
  EditQuestMilestonesModal,
  EditQuestNameModal,
  EditQuestRewardsModal,
  EditQuestScopeModal,
  EditQuestSuccessModal,
  EditQuestTargetDateModal,
} from './quest-section-edit-modals';
import {
  QuestRewardTokenCard,
  useQuestRewardTokenCatalog,
} from './quest-reward-tokens';
import type { ExtendedToken } from '../../treasury/hooks/use-tokens';
import {
  formatRelativeTimeShort,
  healthBadgeMeta,
} from './space-quests-section';
import type { SpaceQuestDetailTab } from '../space-quest-tabs';
import type { QuestDraftPatchInput } from '../utils/quest-draft-assistant';

type QuestPatch = z.infer<typeof schemaPatchSpaceQuest>;

type EditingModal =
  | 'name'
  | 'goal'
  | 'scope'
  | 'success'
  | 'rewards'
  | 'milestones'
  | 'members'
  | 'deliverables'
  | 'lead'
  | 'targetDate'
  | 'health'
  | 'status'
  | 'delete'
  | null;

const LABEL_CLASS =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11';

const CARD_CLASS = 'border border-border bg-background p-5';

function statusLabel(status: QuestStatus): string {
  switch (status) {
    case 'proposed':
      return 'Proposed';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return 'Active';
  }
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

function healthStateLabel(state: QuestHealthState): string {
  return healthBadgeMeta(state).label;
}

function defaultMarkerForState(state: QuestHealthState): number {
  switch (state) {
    case 'off_track':
      return 15;
    case 'at_risk':
      return 45;
    default:
      return 80;
  }
}

function progressLabel(quest: QuestRecord): string {
  const total = quest.milestones.length;
  if (total === 0) return 'No milestones yet';
  const done = quest.milestones.filter((m) => m.status === 'done').length;
  if (quest.status === 'completed' || done === total) {
    return `Milestone ${total} of ${total}`;
  }
  const inProgress = quest.milestones.findIndex(
    (m) => m.status === 'in_progress',
  );
  const current = inProgress >= 0 ? inProgress + 1 : Math.min(total, done + 1);
  return `Milestone ${current} of ${total}`;
}

function initialOf(name: string | null | undefined): string {
  return ((name ?? '').trim()[0] ?? 'Q').toUpperCase();
}

function dayGroupLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'EARLIER';
  const today = new Date();
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (diffDays <= 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  return date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase();
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Read-only rendering of the markdown the RichTextEditor produces. */
function QuestRichText({
  markdown,
  empty = '—',
  className,
}: {
  markdown: string | null | undefined;
  empty?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <QuestSectionMarkdown markdown={markdown} empty={empty} />
    </div>
  );
}

function BulletList({
  items,
  empty = '—',
}: {
  items: string[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-[13px] text-neutral-11">{empty}</p>;
  }
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-foreground">
      {items.map((item, idx) => (
        <p key={idx} className="flex gap-2">
          <span className="font-semibold text-neutral-11">•</span>
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  variant = 'card',
  onEdit,
  editLabel = 'Edit',
  right,
}: {
  title: string;
  variant?: 'card' | 'subsection';
  onEdit?: () => void;
  editLabel?: string;
  right?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        variant === 'card' ? 'mb-3.5' : 'mb-2',
      )}
    >
      {variant === 'card' ? (
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
      ) : (
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/85">
          {title}
        </h3>
      )}
      <div className="flex items-center gap-3">
        {right}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-11 hover:text-foreground"
          >
            <Pencil className="size-3" aria-hidden />
            {editLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function HealthScale({ marker }: { marker: number }) {
  const clamped = Math.min(100, Math.max(0, marker));
  return (
    <div className="space-y-1.5">
      <div className="relative h-2 w-full bg-gradient-to-r from-[#d2463c] via-[#d99a1e] to-[#2e9e5b]">
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
          style={{ left: `${clamped}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-11">
        <span>Off track</span>
        <span>Healthy</span>
      </div>
    </div>
  );
}

function SimpleDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-none">
        <DialogTitle className="font-display text-[18px] font-semibold text-foreground">
          {title}
        </DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function EditHealthDialog({
  open,
  onOpenChange,
  quest,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quest: QuestRecord;
  onSave: (patch: QuestPatch) => void;
}) {
  const [state, setState] = useState<QuestHealthState>(quest.health.state);
  const [marker, setMarker] = useState<number>(quest.health.marker);
  const [summary, setSummary] = useState(quest.health.summary);

  return (
    <SimpleDialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setState(quest.health.state);
          setMarker(quest.health.marker);
          setSummary(quest.health.summary);
        }
        onOpenChange(next);
      }}
      title="Edit quest health"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className={LABEL_CLASS}>STATE</span>
          <div className="flex gap-2">
            {QUEST_HEALTH_STATES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setState(s);
                  setMarker(defaultMarkerForState(s));
                }}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold',
                  state === s
                    ? 'bg-foreground text-background'
                    : 'bg-neutral-3 text-foreground hover:bg-neutral-4',
                )}
              >
                {healthStateLabel(s)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className={LABEL_CLASS}>MARKER</span>
          <input
            type="range"
            min={0}
            max={100}
            value={marker}
            onChange={(e) => setMarker(Number(e.target.value))}
            className="w-full"
            aria-label="Health marker"
          />
          <HealthScale marker={marker} />
        </div>
        <div className="space-y-1.5">
          <span className={LABEL_CLASS}>SUMMARY</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full border border-border bg-background-2 p-2 text-[13px] text-foreground"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            className="rounded-none"
            onClick={() => onOpenChange(false)}
          >
            CANCEL
          </Button>
          <Button
            type="button"
            className="rounded-none"
            onClick={() => {
              onSave({
                healthState: state,
                healthMarker: marker,
                healthSummary: summary,
              });
              onOpenChange(false);
            }}
          >
            SAVE
          </Button>
        </div>
      </div>
    </SimpleDialog>
  );
}

function OverviewTab({
  quest,
  canEdit,
  spaceTokens,
  openModal,
}: {
  quest: QuestRecord;
  canEdit: boolean;
  spaceTokens: readonly ExtendedToken[];
  openModal: (modal: EditingModal) => void;
}) {
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(
    () => {
      const current = quest.milestones.find((m) => m.status === 'in_progress');
      return current?.id ?? null;
    },
  );
  const [expandedMember, setExpandedMember] = useState<number | null>(
    quest.members[0]?.id ?? null,
  );
  const health = healthBadgeMeta(quest.health.state);
  const healthUpdatedAt = quest.health.generatedAt ?? quest.health.lastUpdateAt;
  const edit = (modal: EditingModal) =>
    canEdit ? () => openModal(modal) : undefined;
  const showDeliverables = quest.status !== 'proposed';

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <section className={CARD_CLASS} data-testid="quest-overview-scope">
          <SectionHeader title="Scope &amp; Goal" />
          <div className="space-y-5">
            <div className="space-y-2 border-b border-border/70 pb-4">
              <SectionHeader
                title="Goal"
                variant="subsection"
                onEdit={edit('goal')}
              />
              <QuestRichText
                markdown={quest.goal}
                className="text-[15px] font-medium leading-relaxed text-foreground"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 border-b border-border/70 pb-4 sm:grid-cols-2">
              <div className="space-y-2 border border-border/60 bg-background-2/40 p-3.5">
                <SectionHeader
                  title="In Scope"
                  variant="subsection"
                  onEdit={edit('scope')}
                />
                <QuestSectionMarkdown
                  markdown={
                    quest.scopeInMarkdown?.trim() ||
                    bulletsToMarkdownList(quest.scopeIn)
                  }
                  empty="—"
                />
              </div>
              <div className="space-y-2 border border-border/60 bg-background-2/40 p-3.5">
                <SectionHeader title="Out of Scope" variant="subsection" />
                <QuestSectionMarkdown
                  markdown={
                    quest.scopeOutMarkdown?.trim() ||
                    bulletsToMarkdownList(quest.scopeOut)
                  }
                  empty="—"
                />
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeader
                title="Success Criteria"
                variant="subsection"
                onEdit={edit('success')}
              />
              <QuestRichText
                markdown={quest.successCriteria}
                className="font-medium"
              />
            </div>
          </div>
        </section>

        <section className={CARD_CLASS} data-testid="quest-overview-reward">
          <SectionHeader title="Quest Reward" onEdit={edit('rewards')} />
          {quest.rewards.length === 0 ? (
            <p className="text-[13px] text-neutral-11">
              No token reward specified
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {quest.rewards.map((reward, idx) => (
                <QuestRewardTokenCard
                  key={`${reward.token}-${idx}`}
                  reward={reward}
                  spaceTokens={spaceTokens}
                />
              ))}
            </div>
          )}
        </section>

        <section className={CARD_CLASS} data-testid="quest-overview-milestones">
          <SectionHeader title="Milestones" onEdit={edit('milestones')} />
          {quest.milestones.length === 0 ? (
            <p className="text-[13px] text-neutral-11">No milestones yet</p>
          ) : (
            <>
              <div className="divide-y divide-border">
                {quest.milestones.map((milestone) => {
                  const meta = milestoneStatusMeta(milestone.status);
                  const expanded = expandedMilestone === milestone.id;
                  return (
                    <div key={milestone.id} className="py-2.5 first:pt-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMilestone(expanded ? null : milestone.id)
                        }
                        className="flex w-full items-center gap-3 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="w-7 shrink-0 text-xs font-semibold text-neutral-11">
                          M{milestone.order}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-foreground">
                            {milestone.name}
                          </span>
                          <span className="block text-[11px] text-neutral-11">
                            {[milestone.ownerName, milestone.dueDate]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 px-2 py-0.5 text-[11px] font-semibold',
                            meta.className,
                          )}
                        >
                          {meta.label}
                        </span>
                        {expanded ? (
                          <ChevronUp className="size-3.5 shrink-0 text-neutral-11" />
                        ) : (
                          <ChevronDown className="size-3.5 shrink-0 text-neutral-11" />
                        )}
                      </button>
                      {expanded ? (
                        <div className="mt-2 pl-10">
                          <QuestRichText
                            markdown={milestone.description}
                            empty="No description yet."
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-neutral-11">
                Click a milestone to expand its description.
              </p>
            </>
          )}
        </section>

        <section className={CARD_CLASS} data-testid="quest-overview-health">
          <SectionHeader
            title="Quest Health"
            onEdit={edit('health')}
            right={
              <span className="text-[11px] text-neutral-11">
                Updated {formatRelativeTimeShort(healthUpdatedAt)}
              </span>
            }
          />
          <div className="space-y-3">
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
              <span
                className={cn('size-2 rounded-full', health.dotClass)}
                aria-hidden
              />
              <span className={health.textClass}>{health.label}</span>
            </p>
            <HealthScale marker={quest.health.marker} />
            <p className="text-[11px] text-neutral-11">
              {quest.health.updatesThisWeek}{' '}
              {quest.health.updatesThisWeek === 1 ? 'update' : 'updates'} this
              week
              {quest.health.daysToTarget != null
                ? quest.health.daysToTarget < 0
                  ? ` · ${-quest.health.daysToTarget} days past target`
                  : ` · ${quest.health.daysToTarget} days to target`
                : ''}
            </p>
            {quest.health.summary ? (
              <p className="text-[13.5px] leading-relaxed text-foreground">
                {quest.health.summary}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="min-w-0 space-y-5">
        <section className={CARD_CLASS} data-testid="quest-overview-members">
          <SectionHeader title="Members" onEdit={edit('members')} />
          {quest.members.length === 0 ? (
            <p className="text-[13px] text-neutral-11">No members yet</p>
          ) : (
            <div className="divide-y divide-border">
              {quest.members.map((member) => {
                const expanded = expandedMember === member.id;
                const count = member.responsibilities.length;
                const role =
                  member.roleLabel || (member.isLead ? 'Lead' : 'Member');
                return (
                  <div key={member.id} className="py-2.5 first:pt-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMember(expanded ? null : member.id)
                      }
                      className="flex w-full items-center gap-2.5 text-left"
                      aria-expanded={expanded}
                    >
                      <span className="grid size-6 shrink-0 place-items-center bg-foreground text-[10px] font-bold text-background">
                        {initialOf(member.memberName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {member.memberName}
                        </span>
                        <span className="block text-[11px] text-neutral-11">
                          {role} · {count}{' '}
                          {count === 1 ? 'responsibility' : 'responsibilities'}
                        </span>
                      </span>
                      {expanded ? (
                        <ChevronUp className="size-3.5 text-neutral-11" />
                      ) : (
                        <ChevronDown className="size-3.5 text-neutral-11" />
                      )}
                    </button>
                    {expanded && count > 0 ? (
                      <div className="mt-2 space-y-1 pl-8">
                        <p className={LABEL_CLASS}>RESPONSIBILITY</p>
                        <BulletList items={member.responsibilities} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {showDeliverables ? (
          <section
            className={CARD_CLASS}
            data-testid="quest-overview-deliverables"
          >
            <SectionHeader title="Deliverables" onEdit={edit('deliverables')} />
            {quest.deliverables.length === 0 ? (
              <p className="text-[13px] text-neutral-11">No deliverables yet</p>
            ) : (
              <div className="divide-y divide-border">
                {quest.deliverables.map((d) => (
                  <div key={d.id} className="space-y-0.5 py-2 first:pt-0">
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] font-semibold text-foreground hover:underline"
                      >
                        {d.name}
                        <ArrowUpRight className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <p className="text-[13px] font-semibold text-foreground">
                        {d.name}
                      </p>
                    )}
                    {d.note ? (
                      <p className="text-[11px] text-neutral-11">{d.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {canEdit ? (
              <p className="mt-3 text-[11px] text-neutral-11">
                Any member can edit · click the section, or mention AI Agents in
                chat
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function UpdatesTab({
  quest,
  canPost,
  onPost,
  posting,
}: {
  quest: QuestRecord;
  canPost: boolean;
  onPost: (input: {
    text: string;
    milestoneOrder: number | null;
    linkUrl: string;
  }) => Promise<boolean>;
  posting: boolean;
}) {
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [milestoneOrder, setMilestoneOrder] = useState<number | null>(null);
  const [linkUrl, setLinkUrl] = useState('');

  const authors = useMemo(
    () => Array.from(new Set(quest.updates.map((u) => u.authorName))),
    [quest.updates],
  );

  const groups = useMemo(() => {
    const sorted = [...quest.updates]
      .filter((u) => !authorFilter || u.authorName === authorFilter)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    const out: Array<{ label: string; items: QuestUpdateRecord[] }> = [];
    for (const update of sorted) {
      const label = dayGroupLabel(update.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) {
        last.items.push(update);
      } else {
        out.push({ label, items: [update] });
      }
    }
    return out;
  }, [authorFilter, quest.updates]);

  const submit = async () => {
    if (!text.trim()) return;
    const posted = await onPost({
      text: text.trim(),
      milestoneOrder,
      linkUrl: linkUrl.trim(),
    });
    if (!posted) return;
    setText('');
    setLinkUrl('');
    setMilestoneOrder(null);
  };

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={LABEL_CLASS}>
          UPDATES · newest first · posted by members
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setAuthorFilter(null)}
            className={cn(
              'px-2.5 py-1 text-[11px] font-semibold',
              authorFilter === null
                ? 'bg-foreground text-background'
                : 'bg-neutral-3 text-foreground hover:bg-neutral-4',
            )}
          >
            All
          </button>
          {authors.map((author) => (
            <button
              key={author}
              type="button"
              onClick={() => setAuthorFilter(author)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold',
                authorFilter === author
                  ? 'bg-foreground text-background'
                  : 'bg-neutral-3 text-foreground hover:bg-neutral-4',
              )}
            >
              {author.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {canPost ? (
        <div
          className="space-y-2 border border-border bg-background p-3"
          data-testid="quest-update-composer"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Share progress with the quest…"
            className="w-full resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-neutral-11"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={milestoneOrder ?? ''}
              onChange={(e) =>
                setMilestoneOrder(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="h-8 border border-border bg-background-2 px-2 text-xs text-foreground"
              aria-label="Milestone"
            >
              <option value="">No milestone</option>
              {quest.milestones.map((m) => (
                <option key={m.id} value={m.order}>
                  M{m.order} · {m.name}
                </option>
              ))}
            </select>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Link (optional)"
              className="h-8 rounded-none text-xs"
              rootClassName="min-w-[160px] flex-1"
            />
            <Button
              type="button"
              disabled={posting || !text.trim()}
              onClick={() => void submit()}
              className="h-8 gap-1.5 rounded-none px-3 text-[11px] font-semibold uppercase tracking-[0.06em]"
            >
              <Send className="size-3" aria-hidden />
              POST
            </Button>
          </div>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="border border-dashed border-border bg-background-2 px-6 py-10 text-center text-sm text-neutral-11">
          No updates yet.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="space-y-2">
            <p className={LABEL_CLASS}>{group.label}</p>
            <div className="divide-y divide-border border border-border bg-background">
              {group.items.map((update) => (
                <QuestUpdateRow key={update.id} update={update} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function QuestUpdateRow({ update }: { update: QuestUpdateRecord }) {
  if (update.kind === 'edit_event') {
    return (
      <div
        className="flex items-start gap-2.5 px-3 py-2 text-[12px] text-neutral-11"
        data-testid="quest-update-edit-event"
      >
        <Pencil className="mt-0.5 size-3 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-semibold text-foreground">
            {update.authorName}
          </span>{' '}
          {update.text}
        </p>
        <span className="shrink-0">{formatClock(update.createdAt)}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 px-3 py-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
        {initialOf(update.authorName)}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">
            {update.authorName}
          </span>
          {update.viaAgent ? (
            <span className="text-[11px] text-[#4b4bff]">✦ via agent</span>
          ) : null}
          {update.milestoneOrder != null || update.milestoneLabel ? (
            <span className="bg-neutral-3 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {update.milestoneLabel || `M${update.milestoneOrder}`}
            </span>
          ) : null}
          <span className="ml-auto text-[11px] text-neutral-11">
            {formatClock(update.createdAt)}
          </span>
        </div>
        <p className="text-[13px] text-foreground">{update.text}</p>
        {update.links.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {update.links.map((link, idx) => (
              <a
                key={`${link.url}-${idx}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-neutral-3"
              >
                {link.label}
                <ArrowUpRight className="size-3" aria-hidden />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MembersTab({
  quest,
  canEdit,
  openModal,
}: {
  quest: QuestRecord;
  canEdit: boolean;
  openModal: (modal: EditingModal) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[760px]">
      <section className={CARD_CLASS}>
        <SectionHeader
          title={`MEMBERS · ${quest.members.length}`}
          onEdit={canEdit ? () => openModal('members') : undefined}
        />
        <div className="divide-y divide-border">
          {quest.members.map((member) => (
            <div key={member.id} className="flex gap-3 py-3 first:pt-0">
              <span className="grid size-8 shrink-0 place-items-center bg-foreground text-[11px] font-bold text-background">
                {initialOf(member.memberName)}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[13px] font-semibold text-foreground">
                  {member.memberName}
                  <span className="ml-2 text-[11px] font-normal text-neutral-11">
                    {member.roleLabel || (member.isLead ? 'Lead' : 'Member')}
                  </span>
                </p>
                <p className={LABEL_CLASS}>RESPONSIBILITY</p>
                <BulletList items={member.responsibilities} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsRow({
  label,
  value,
  action,
  onAction,
  disabled,
  tone = 'default',
}: {
  label: string;
  value?: ReactNode;
  action: string;
  onAction: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        {value ? <p className="text-[12px] text-neutral-11">{value}</p> : null}
      </div>
      <Button
        type="button"
        variant="outline"
        colorVariant={tone === 'danger' ? 'error' : 'neutral'}
        disabled={disabled}
        onClick={onAction}
        className="h-8 shrink-0 rounded-none px-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
      >
        {action}
      </Button>
    </div>
  );
}

function SettingsTab({
  quest,
  isLead,
  canEdit,
  openModal,
  onPatch,
}: {
  quest: QuestRecord;
  isLead: boolean;
  canEdit: boolean;
  openModal: (modal: EditingModal) => void;
  onPatch: (patch: QuestPatch) => void;
}) {
  const leadOnly = !isLead;
  const isPaused = quest.status === 'paused';
  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4">
      {!isLead ? (
        <p className="border border-border bg-background-2 px-3 py-2 text-[12px] text-neutral-11">
          Only the Lead can change status, transfer the lead, or use the danger
          zone.
        </p>
      ) : null}

      <section className={CARD_CLASS}>
        <p className={LABEL_CLASS}>STATUS</p>
        <div className="divide-y divide-border">
          <SettingsRow
            label="Quest status"
            value={statusLabel(quest.status)}
            action="CHANGE"
            disabled={leadOnly || quest.status === 'proposed'}
            onAction={() => openModal('status')}
          />
          <SettingsRow
            label="Target date"
            value={quest.targetDate || '—'}
            action="EDIT"
            disabled={!canEdit}
            onAction={() => openModal('targetDate')}
          />
        </div>
      </section>

      <section className={CARD_CLASS}>
        <p className={LABEL_CLASS}>PEOPLE</p>
        <div className="divide-y divide-border">
          <SettingsRow
            label="Lead"
            value={quest.leadName || '—'}
            action="TRANSFER"
            disabled={leadOnly}
            onAction={() => openModal('lead')}
          />
          <SettingsRow
            label="Members"
            value={`${quest.members.length} ${
              quest.members.length === 1 ? 'member' : 'members'
            }`}
            action="MANAGE"
            disabled={!canEdit}
            onAction={() => openModal('members')}
          />
        </div>
      </section>

      <section className={CARD_CLASS}>
        <p className={LABEL_CLASS}>UPDATES &amp; NOTIFICATIONS</p>
        <div className="divide-y divide-border">
          <SettingsRow
            label="AI health summaries"
            value="AI Agents refresh the health summary from member updates"
            action={quest.stewardHealthSummaries ? 'ON' : 'OFF'}
            disabled={leadOnly}
            onAction={() =>
              onPatch({
                stewardHealthSummaries: !quest.stewardHealthSummaries,
              })
            }
          />
          <SettingsRow
            label="Member update alerts"
            value="Notify Quest members when someone posts an update"
            action={quest.memberUpdateAlerts ? 'ON' : 'OFF'}
            disabled={leadOnly}
            onAction={() =>
              onPatch({ memberUpdateAlerts: !quest.memberUpdateAlerts })
            }
          />
        </div>
      </section>

      <section className={cn(CARD_CLASS, 'border-error-6')}>
        <p className={cn(LABEL_CLASS, 'text-error-11')}>DANGER ZONE</p>
        <div className="divide-y divide-border">
          <SettingsRow
            label={isPaused ? 'Resume quest' : 'Pause quest'}
            value={
              isPaused
                ? 'Return the quest to Active'
                : 'Members keep access; updates are paused'
            }
            action={isPaused ? 'RESUME' : 'PAUSE'}
            disabled={
              leadOnly ||
              !(quest.status === 'active' || quest.status === 'paused')
            }
            onAction={() => onPatch({ status: isPaused ? 'active' : 'paused' })}
            tone="danger"
          />
          <SettingsRow
            label="Archive quest"
            value="Hide from the list; content becomes read-only"
            action="ARCHIVE"
            disabled={leadOnly || quest.status === 'archived'}
            onAction={() => onPatch({ status: 'archived' })}
            tone="danger"
          />
          <SettingsRow
            label="Delete quest"
            value={
              quest.acceptedAt
                ? 'Accepted quests cannot be deleted — archive instead'
                : 'Permanently remove this quest'
            }
            action="DELETE"
            disabled={leadOnly || Boolean(quest.acceptedAt)}
            onAction={() => openModal('delete')}
            tone="danger"
          />
        </div>
      </section>
    </div>
  );
}

export function SpaceQuestDetail({
  spaceSlug,
  questSlug,
  tab = 'overview',
}: {
  spaceSlug: string;
  questSlug: string;
  tab?: SpaceQuestDetailTab;
}) {
  const locale = useLocale();
  const router = useRouter();
  const { person } = useMe();
  const { getAccessToken } = useAuthentication();
  const { closeAiPanel } = useAiPanel();
  const { openCoherenceChat, openHumanChatPanel, setSpaceQuestDraft } =
    useHumanChatPanel();
  const { quest, isLoading, error, refresh } = useSpaceQuestDetail(
    spaceSlug,
    questSlug,
  );
  const spaceMembers = useQuestSpaceMembers(spaceSlug);
  const { spaceTokens } = useQuestRewardTokenCatalog(spaceSlug);
  const [editingModal, setEditingModal] = useState<EditingModal>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<QuestStatus>('active');
  const [detailChatOpen, setDetailChatOpen] = useState(false);
  const [detailChatInput, setDetailChatInput] = useState('');
  const [detailChatTyping, setDetailChatTyping] = useState(false);
  const [detailChatMessages, setDetailChatMessages] = useState<
    SpaceQuestDraftChatMessage[]
  >(() => [
    {
      id: 'detail-m1',
      role: 'member',
      agentSpecialistId: 'operations',
      senderName: 'AI Agents',
      timestamp: new Date(),
      text: 'Ask me to refine the Goal, Scope, Success Criteria, Milestones, Deliverables, or Quest Reward for this quest.',
    },
  ]);

  const viewer = useMemo(
    () =>
      person
        ? {
            id: person.id,
            name: [person.name, person.surname].filter(Boolean).join(' '),
          }
        : null,
    [person],
  );

  const baseHref = `/${locale}/dho/${spaceSlug}/quests/${encodeURIComponent(
    questSlug,
  )}`;
  const listHref = `/${locale}/dho/${spaceSlug}/quests`;

  const sendDetailRef = useRef<(overridePrompt?: string) => void>(() => {});
  const triggerDetailSend = useCallback(() => {
    sendDetailRef.current();
  }, []);
  const triggerDetailQuickPrompt = useCallback((prompt: string) => {
    sendDetailRef.current(prompt);
  }, []);

  useEffect(() => {
    if (!detailChatOpen || !quest) return;
    setSpaceQuestDraft({
      spaceSlug,
      questTitle: quest.name,
      messages: detailChatMessages,
      input: detailChatInput,
      onInputChange: setDetailChatInput,
      onSend: triggerDetailSend,
      onQuickPrompt: triggerDetailQuickPrompt,
      isAgentTyping: detailChatTyping,
    });
  }, [
    detailChatInput,
    detailChatMessages,
    detailChatOpen,
    detailChatTyping,
    quest,
    setSpaceQuestDraft,
    spaceSlug,
    triggerDetailQuickPrompt,
    triggerDetailSend,
  ]);

  useEffect(() => {
    return () => {
      setSpaceQuestDraft(null);
    };
  }, [setSpaceQuestDraft]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !quest) {
    return (
      <div className="border border-error-6 bg-background-2 px-4 py-6">
        <p className="text-2 text-error-11">This quest could not be loaded.</p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            onClick={() => void refresh()}
          >
            Retry
          </Button>
          <Button asChild variant="ghost" colorVariant="neutral">
            <Link href={listHref}>Back to quests</Link>
          </Button>
        </div>
      </div>
    );
  }

  const editableStatus = quest.status === 'active' || quest.status === 'paused';
  const canEdit = editableStatus && canMemberEditQuest(viewer, quest);
  const isLead = editableStatus && isViewerQuestLead(viewer, quest);
  const health = healthBadgeMeta(quest.health.state);
  const memberOptions = Array.from(
    new Set([
      ...spaceMembers.map((m) => m.name),
      ...quest.members.map((m) => m.memberName),
      quest.leadName,
    ]),
  ).filter(Boolean);
  const spaceMemberPersons = toQuestSpaceMemberPersons(
    spaceMembers,
    memberOptions,
  );

  const openQuestChat = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
      closeAiPanel();
    }
    if (quest.chatRoomId) {
      setDetailChatOpen(false);
      setSpaceQuestDraft(null);
      openCoherenceChat(
        quest.chatRoomId,
        quest.name,
        quest.slug,
        quest.goal,
        spaceSlug,
        { channel: 'quest' },
      );
      return;
    }
    setDetailChatOpen(true);
    openHumanChatPanel();
  };

  const handleSendDetailChatMessage = async (overridePrompt?: string) => {
    const rawTrimmed = (overridePrompt ?? detailChatInput).trim();
    if (!rawTrimmed) return;
    if (!overridePrompt) setDetailChatInput('');

    const trimmed =
      rawTrimmed.replace(/^@AI\s+Agents\b[,:\s]*/i, '').trim() || rawTrimmed;
    recordMobilizedAiAgentsForQuestion(spaceSlug, trimmed);

    const viewerName = viewer?.name?.trim() || 'Member';
    const now = new Date();
    setDetailChatMessages((prev) => [
      ...prev,
      {
        id: `du-${now.getTime()}`,
        role: 'user',
        senderName: viewerName,
        avatarUrl: person?.avatarUrl ?? undefined,
        timestamp: now,
        text: rawTrimmed,
      },
    ]);

    const appendAssistantReply = (text: string) => {
      setDetailChatMessages((prev) => [
        ...prev,
        {
          id: `ds-${Date.now()}`,
          role: 'member',
          agentSpecialistId: 'operations',
          senderName: 'AI Agents',
          timestamp: new Date(),
          text,
        },
      ]);
    };

    setDetailChatTyping(true);
    try {
      const token = await getAccessToken?.().catch(() => null);
      if (!token) {
        appendAssistantReply(
          'Could not reach the assistant right now. Try again or click any section to edit directly.',
        );
        return;
      }
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/quests/draft-assist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: trimmed,
            questSlug: quest.slug,
            spaceTitle: quest.spaceTitle,
            spaceMembers: spaceMembers.slice(0, 60).map((m) => ({
              personId: m.personId,
              name: m.name,
            })),
            history: detailChatMessages.slice(-8).map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              text: m.text,
            })),
          }),
        },
      );
      if (!response.ok) {
        appendAssistantReply(
          'Could not reach the assistant right now. Try again or click any section to edit directly.',
        );
        return;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        patch?: QuestDraftPatchInput | null;
        updatedQuest?: QuestRecord | null;
        reply?: string | null;
        specialistId?: string;
        writeError?: string | null;
      };
      let saved = false;
      if (data.updatedQuest) {
        await refresh(data.updatedQuest, { revalidate: false });
        saved = true;
      } else if (data.patch && canEdit && !data.writeError) {
        const patchToSave: QuestPatch = {
          ...(data.patch.name ? { name: data.patch.name } : {}),
          ...(data.patch.goal ? { goal: data.patch.goal } : {}),
          ...(data.patch.scopeIn ? { scopeIn: data.patch.scopeIn } : {}),
          ...(data.patch.scopeOut ? { scopeOut: data.patch.scopeOut } : {}),
          ...(data.patch.successCriteriaBullets
            ? {
                successCriteria: data.patch.successCriteriaBullets
                  .map((b) => `- ${b}`)
                  .join('\n'),
              }
            : {}),
          ...(data.patch.targetDate !== undefined
            ? { targetDate: data.patch.targetDate }
            : {}),
          ...(data.patch.rewards ? { rewards: data.patch.rewards } : {}),
        };
        if (Object.keys(patchToSave).length > 0) {
          saved = await savePatch(patchToSave);
        }
      }
      const replyText =
        data.reply?.trim() ||
        (saved
          ? 'Updated the quest sections on screen.'
          : 'Let me know which section of this quest you want to refine.');
      setDetailChatMessages((prev) => [
        ...prev,
        {
          id: `ds-${Date.now()}`,
          role: 'member',
          agentSpecialistId: data.specialistId ?? 'operations',
          senderName: 'AI Agents',
          timestamp: new Date(),
          text: replyText,
        },
      ]);
    } catch {
      appendAssistantReply(
        'Could not reach the assistant right now. Try again or click any section to edit directly.',
      );
    } finally {
      setDetailChatTyping(false);
    }
  };

  sendDetailRef.current = (overridePrompt?: string) => {
    void handleSendDetailChatMessage(overridePrompt);
  };

  const savePatch = async (patch: QuestPatch): Promise<boolean> => {
    setSaving(true);
    setActionError(null);
    try {
      const updated = await patchSpaceQuestRequest({
        spaceSlug,
        questSlug: quest.slug,
        patch,
        getAccessToken,
      });
      await refresh(updated, { revalidate: false });
      return true;
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update quest',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const postUpdate = async ({
    text,
    milestoneOrder,
    linkUrl,
  }: {
    text: string;
    milestoneOrder: number | null;
    linkUrl: string;
  }) => {
    setSaving(true);
    setActionError(null);
    try {
      const updated = await postSpaceQuestUpdateRequest({
        spaceSlug,
        questSlug: quest.slug,
        body: {
          text,
          milestoneOrder,
          milestoneLabel: milestoneOrder != null ? `M${milestoneOrder}` : null,
          links: linkUrl
            ? [
                {
                  label: linkUrl.replace(/^https?:\/\//, '').slice(0, 60),
                  url: linkUrl,
                  kind: 'link',
                },
              ]
            : [],
        },
        getAccessToken,
      });
      await refresh(updated, { revalidate: false });
      return true;
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to post update',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteQuest = async () => {
    setSaving(true);
    setActionError(null);
    try {
      await deleteSpaceQuestRequest({
        spaceSlug,
        questSlug: quest.slug,
        getAccessToken,
      });
      router.push(listHref);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete quest',
      );
      setSaving(false);
    }
  };

  const closeModal = (open: boolean) => {
    if (!open) setEditingModal(null);
  };

  const tabs: Array<{ key: SpaceQuestDetailTab; label: string; href: string }> =
    [
      { key: 'overview', label: 'OVERVIEW', href: baseHref },
      { key: 'updates', label: 'UPDATES', href: `${baseHref}/updates` },
      { key: 'members', label: 'MEMBERS', href: `${baseHref}/members` },
      { key: 'settings', label: 'SETTINGS', href: `${baseHref}/settings` },
    ];

  return (
    <div className="space-y-4" data-testid="quest-detail">
      <Link
        href={listHref}
        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-11 hover:text-foreground"
      >
        <ArrowLeft className="size-3" aria-hidden />
        Quests
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[22px] font-semibold text-foreground">
              {quest.name}
            </h1>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setEditingModal('name')}
                className="text-neutral-11 hover:text-foreground"
                aria-label="Edit quest name"
              >
                <Pencil className="size-3.5" />
              </button>
            ) : null}
            <span className="bg-neutral-3 px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {statusLabel(quest.status)}
            </span>
            {quest.status !== 'proposed' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span
                  className={cn('size-2 rounded-full', health.dotClass)}
                  aria-hidden
                />
                <span className={health.textClass}>{health.label}</span>
              </span>
            ) : null}
          </div>
          {quest.status !== 'proposed' && (quest.chatRoomId || canEdit) ? (
            <button
              type="button"
              onClick={openQuestChat}
              data-testid="open-quest-chat-button"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-foreground underline-offset-2 hover:underline"
            >
              Open discussion
              <span aria-hidden>→</span>
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-11">
          <span className="inline-flex items-center gap-1.5">
            <PersonAvatar
              size="sm"
              shape="circle"
              showPresence={false}
              avatarSrc={
                quest.members.find((member) => member.isLead)
                  ?.memberAvatarUrl ??
                findQuestSpaceMember(spaceMembers, { name: quest.leadName })
                  ?.avatarUrl ??
                (viewer?.name &&
                quest.leadName.trim().toLowerCase() ===
                  viewer.name.trim().toLowerCase()
                  ? person?.avatarUrl ?? undefined
                  : undefined)
              }
              userName={quest.leadName || 'Lead'}
              personId={
                quest.members.find((member) => member.isLead)?.personId ??
                findQuestSpaceMember(spaceMembers, { name: quest.leadName })
                  ?.personId ??
                (viewer?.name &&
                quest.leadName.trim().toLowerCase() ===
                  viewer.name.trim().toLowerCase()
                  ? person?.id
                  : undefined)
              }
            />
            <span className="font-medium text-foreground">
              {quest.leadName || '—'}
            </span>
            Lead
          </span>
          <span>Target {quest.targetDate || '—'}</span>
          <span>{progressLabel(quest)}</span>
        </div>
      </header>

      {quest.status === 'proposed' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-[#4b4bff]/40 bg-[#f6f5ff] px-4 py-3 dark:bg-accent-2">
          <p className="text-[13px] text-foreground">
            On voting — this quest becomes Active and opens a quest channel when
            the proposal passes.
          </p>
          {quest.proposalSlug ? (
            <Button
              asChild
              variant="outline"
              colorVariant="neutral"
              className="h-8 rounded-none px-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
            >
              <Link
                href={`/${locale}/dho/${spaceSlug}/agreements/proposal/${encodeURIComponent(
                  quest.proposalSlug,
                )}`}
              >
                VIEW PROPOSAL
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <nav
        className="flex gap-1 overflow-x-auto border-b border-border"
        aria-label="Quest sections"
      >
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            scroll={false}
            aria-current={tab === item.key ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2 text-[11px] font-semibold tracking-[0.1em]',
              tab === item.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-neutral-11 hover:text-foreground',
            )}
          >
            {item.label}
            {item.key === 'updates' && quest.updates.length > 0 ? (
              <span className="ml-1.5 text-neutral-11">
                {quest.updates.length}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {actionError ? (
        <p className="border border-error-6 bg-background-2 px-3 py-2 text-[12px] text-error-11">
          {actionError}
        </p>
      ) : null}

      {tab === 'overview' ? (
        <OverviewTab
          quest={quest}
          canEdit={canEdit}
          spaceTokens={spaceTokens}
          openModal={setEditingModal}
        />
      ) : null}
      {tab === 'updates' ? (
        <UpdatesTab
          quest={quest}
          canPost={canEdit}
          onPost={postUpdate}
          posting={saving}
        />
      ) : null}
      {tab === 'members' ? (
        <MembersTab
          quest={quest}
          canEdit={canEdit}
          openModal={setEditingModal}
        />
      ) : null}
      {tab === 'settings' ? (
        <SettingsTab
          quest={quest}
          isLead={isLead}
          canEdit={canEdit}
          openModal={(modal) => {
            if (modal === 'status') {
              setNextStatus(quest.status === 'active' ? 'completed' : 'active');
            }
            setEditingModal(modal);
          }}
          onPatch={(patch) => void savePatch(patch)}
        />
      ) : null}

      <EditQuestNameModal
        open={editingModal === 'name'}
        onOpenChange={closeModal}
        value={quest.name}
        onSave={(name) => void savePatch({ name })}
      />
      <EditQuestGoalModal
        open={editingModal === 'goal'}
        onOpenChange={closeModal}
        value={quest.goal}
        onSave={(goal) => void savePatch({ goal })}
      />
      <EditQuestScopeModal
        open={editingModal === 'scope'}
        onOpenChange={closeModal}
        scopeIn={quest.scopeIn}
        scopeOut={quest.scopeOut}
        scopeInMarkdown={quest.scopeInMarkdown}
        scopeOutMarkdown={quest.scopeOutMarkdown}
        onSave={(next) => void savePatch(next)}
      />
      <EditQuestSuccessModal
        open={editingModal === 'success'}
        onOpenChange={closeModal}
        value={quest.successCriteria}
        onSave={(successCriteria) => void savePatch({ successCriteria })}
      />
      <EditQuestRewardsModal
        open={editingModal === 'rewards'}
        onOpenChange={closeModal}
        rewards={quest.rewards}
        spaceSlug={spaceSlug}
        onSave={(rewards) => void savePatch({ rewards })}
      />
      <EditQuestMilestonesModal
        open={editingModal === 'milestones'}
        onOpenChange={closeModal}
        milestones={quest.milestones.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          dueDate: m.dueDate,
          ownerPersonId: m.ownerPersonId,
          ownerName: m.ownerName,
          status: m.status,
        }))}
        spaceMembers={spaceMemberPersons}
        spaceMemberNames={memberOptions}
        showStatusSelect
        onSave={(next) =>
          void savePatch({
            milestones: next.map((m) => ({
              id: m.id,
              name: m.name.trim() || 'Untitled milestone',
              description: m.description,
              dueDate: m.dueDate,
              ownerPersonId:
                m.ownerPersonId ??
                (m.ownerName
                  ? findQuestSpaceMemberId(spaceMembers, m.ownerName)
                  : null),
              ownerName: m.ownerName,
              status: m.status,
            })),
          })
        }
      />
      <EditQuestMembersModal
        open={editingModal === 'members'}
        onOpenChange={closeModal}
        members={quest.members.map((m) => ({
          id: m.id,
          personId: m.personId,
          memberName: m.memberName,
          memberAvatarUrl: m.memberAvatarUrl,
          roleLabel: m.roleLabel,
          responsibilities: m.responsibilities,
        }))}
        spaceMembers={spaceMemberPersons}
        spaceMemberNames={memberOptions}
        onSave={(next) =>
          void savePatch({
            members: next.map((m) => ({
              id: m.id,
              personId:
                m.personId ??
                findQuestSpaceMemberId(spaceMembers, m.memberName),
              memberName: m.memberName,
              memberAvatarUrl: m.memberAvatarUrl ?? null,
              roleLabel: m.roleLabel ?? null,
              responsibilities: m.responsibilities
                .map((r) => r.trim())
                .filter(Boolean),
            })),
          })
        }
      />
      <EditQuestDeliverablesModal
        open={editingModal === 'deliverables'}
        onOpenChange={closeModal}
        deliverables={quest.deliverables}
        onSave={(next) =>
          void savePatch({
            deliverables: next
              .filter((d) => d.name.trim())
              .map((d) => ({
                id: d.id,
                name: d.name.trim(),
                url: d.url.trim() || null,
                note: d.note.trim() || null,
              })),
          })
        }
      />
      <EditQuestLeadModal
        open={editingModal === 'lead'}
        onOpenChange={closeModal}
        leadName={quest.leadName}
        leadPersonId={quest.leadPersonId}
        spaceMembers={spaceMemberPersons}
        spaceMemberNames={memberOptions}
        onSave={(leadName, leadPersonId) => {
          const match = quest.members.find((m) => m.memberName === leadName);
          void savePatch({
            leadName,
            leadPersonId:
              leadPersonId ??
              match?.personId ??
              findQuestSpaceMemberId(spaceMembers, leadName),
          });
        }}
      />
      <EditQuestTargetDateModal
        open={editingModal === 'targetDate'}
        onOpenChange={closeModal}
        value={quest.targetDate}
        onSave={(targetDate) => void savePatch({ targetDate })}
      />
      <EditHealthDialog
        open={editingModal === 'health'}
        onOpenChange={closeModal}
        quest={quest}
        onSave={(patch) => void savePatch(patch)}
      />

      <SimpleDialog
        open={editingModal === 'status'}
        onOpenChange={closeModal}
        title="Change quest status"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['active', 'paused', 'completed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setNextStatus(status)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold',
                  nextStatus === status
                    ? 'bg-foreground text-background'
                    : 'bg-neutral-3 text-foreground hover:bg-neutral-4',
                )}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="rounded-none"
              onClick={() => setEditingModal(null)}
            >
              CANCEL
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={saving || nextStatus === quest.status}
              onClick={() => {
                setEditingModal(null);
                void savePatch({ status: nextStatus });
              }}
            >
              SAVE
            </Button>
          </div>
        </div>
      </SimpleDialog>

      <SimpleDialog
        open={editingModal === 'delete'}
        onOpenChange={closeModal}
        title="Delete this quest?"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-neutral-11">
            This permanently removes {quest.name} with its milestones, members,
            deliverables and updates.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="rounded-none"
              onClick={() => setEditingModal(null)}
            >
              CANCEL
            </Button>
            <Button
              type="button"
              colorVariant="error"
              className="rounded-none"
              disabled={saving}
              onClick={() => void deleteQuest()}
            >
              DELETE QUEST
            </Button>
          </div>
        </div>
      </SimpleDialog>
    </div>
  );
}
