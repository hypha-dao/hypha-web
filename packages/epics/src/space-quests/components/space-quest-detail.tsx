'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_HEALTH_STATES,
  QUEST_HELPER_NAME,
  QUEST_MILESTONE_STATUSES,
  QUEST_STEWARD_STEPS,
  buildMilestoneStatusPatch,
  canChangeMilestoneStatus,
  canMemberEditQuest,
  formatQuestCalendarDate,
  isViewerQuestLead,
  questHealthDisplay,
  questOverviewVisibility,
  bulletsToMarkdownList,
  useMe,
  type QuestHealthState,
  type QuestMilestoneStatus,
  type QuestPatchStatus,
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
import { QuestSectionMarkdown } from './quest-section-markdown';
import {
  QuestDetailSubheading,
  QuestMilestonesCard,
  QuestParticipantsCard,
  QuestRewardStrip,
  QuestTargetDateCard,
  questDetailProgressLabel,
  resolveQuestLeadIdentity,
} from './quest-detail-presentation';
import { QuestUpdateCard } from './quest-update-card';
import { ArrowLeft, ArrowUpRight, Pencil, Send } from 'lucide-react';
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
import { useQuestRewardTokenCatalog } from './quest-reward-tokens';
import type { ExtendedToken } from '../../treasury/hooks/use-tokens';
import {
  formatRelativeTimeShort,
  healthBadgeMeta,
} from './space-quests-section';
import {
  spaceQuestDetailTabLinks,
  type SpaceQuestDetailTab,
} from '../space-quest-tabs';
import {
  QUEST_HELPER_OFFLINE_REPLY,
  formatPendingQuestPatch,
  questAssistHistoryEntries,
  questDraftSuggestionStatus,
  questDraftTurnUsesModel,
  questHelperTurnMessage,
  type PendingQuestSectionProposal,
  type QuestDraftModelTurn,
  type QuestDraftPatchInput,
  type QuestDraftStateSnapshot,
} from '../utils/quest-draft-assistant';
import {
  questHelperTypingAfterTurn,
  questHelperTypingForTurn,
} from '../utils/quest-helper-typing';
import {
  SAVED_QUEST_HELPER_INTRO,
  questHelperDraftAssistBody,
  questRecordToDraftSnapshot,
  runSavedQuestHelperTurn,
} from '../utils/quest-saved-helper';

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
  | 'archive'
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

function healthPresentation(quest: QuestRecord) {
  const display = questHealthDisplay(quest);
  if (display.notStarted) {
    return {
      ...display,
      dotClass: 'bg-neutral-9',
      textClass: 'text-neutral-11',
    };
  }
  const meta = healthBadgeMeta(display.state ?? 'on_track');
  return {
    ...display,
    dotClass: meta.dotClass,
    textClass: meta.textClass,
  };
}

function HealthScale({ marker }: { marker: number }) {
  const clamped = Math.min(100, Math.max(0, marker));
  const atStart = clamped <= 0;
  const atEnd = clamped >= 100;
  return (
    <div className="space-y-1.5">
      <div className="relative h-2 w-full bg-gradient-to-r from-[#d2463c] via-[#d99a1e] to-[#2e9e5b]">
        <span
          data-testid="quest-health-marker"
          data-marker={clamped}
          className={cn(
            'absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow',
            atStart ? 'left-0' : atEnd ? 'right-0' : '-translate-x-1/2',
          )}
          style={atStart || atEnd ? undefined : { left: `${clamped}%` }}
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
  spaceTokens,
}: {
  quest: QuestRecord;
  spaceTokens: readonly ExtendedToken[];
}) {
  const locale = useLocale();
  const visibility = questOverviewVisibility(quest);
  const health = healthPresentation(quest);
  const healthUpdatedAt = quest.health.generatedAt ?? quest.health.lastUpdateAt;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        {visibility.showScopeCard ? (
          <section className={CARD_CLASS} data-testid="quest-overview-scope">
            <SectionHeader title="Scope &amp; Goal" />
            <div className="space-y-5">
              {visibility.showGoal ? (
                <div className="space-y-2 border-b border-border/70 pb-4">
                  <SectionHeader title="Goal" variant="subsection" />
                  <QuestRichText
                    markdown={quest.goal}
                    className="text-[15px] font-medium leading-relaxed text-foreground"
                  />
                </div>
              ) : null}

              {visibility.showScopeIn || visibility.showScopeOut ? (
                <div className="grid grid-cols-1 gap-4 border-b border-border/70 pb-4 sm:grid-cols-2">
                  {visibility.showScopeIn ? (
                    <div className="space-y-2 border border-border/60 bg-background-2/40 p-3.5">
                      <SectionHeader title="In Scope" variant="subsection" />
                      <QuestSectionMarkdown
                        markdown={
                          quest.scopeInMarkdown?.trim() ||
                          bulletsToMarkdownList(quest.scopeIn)
                        }
                        empty=""
                      />
                    </div>
                  ) : null}
                  {visibility.showScopeOut ? (
                    <div className="space-y-2 border border-border/60 bg-background-2/40 p-3.5">
                      <SectionHeader
                        title="Out of Scope"
                        variant="subsection"
                      />
                      <QuestSectionMarkdown
                        markdown={
                          quest.scopeOutMarkdown?.trim() ||
                          bulletsToMarkdownList(quest.scopeOut)
                        }
                        empty=""
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {visibility.showSuccess ? (
                <div className="space-y-2">
                  <SectionHeader
                    title="Success Criteria"
                    variant="subsection"
                  />
                  <QuestRichText
                    markdown={quest.successCriteria}
                    className="font-medium"
                  />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {visibility.showRewards ? (
          <section className={CARD_CLASS} data-testid="quest-overview-reward">
            <SectionHeader title="Quest Reward" />
            <QuestRewardStrip
              rewards={quest.rewards}
              spaceTokens={spaceTokens}
            />
          </section>
        ) : null}

        {visibility.showMilestones ? (
          <QuestMilestonesCard milestones={quest.milestones} locale={locale} />
        ) : null}

        <section className={CARD_CLASS} data-testid="quest-overview-health">
          <SectionHeader
            title="Quest Health"
            right={
              <span className="text-[11px] text-neutral-11">
                Updated {formatRelativeTimeShort(healthUpdatedAt)}
              </span>
            }
          />
          <div className="space-y-3">
            <p
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
              data-testid="quest-health-label"
            >
              <span
                className={cn('size-2 rounded-full', health.dotClass)}
                aria-hidden
              />
              <span className={health.textClass}>{health.label}</span>
            </p>
            <HealthScale marker={health.marker} />
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
            {health.summary ? (
              <p
                className="text-[13.5px] leading-relaxed text-foreground"
                data-testid="quest-health-summary"
              >
                {health.summary}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="min-w-0 space-y-5">
        {visibility.showMembers ? (
          <QuestParticipantsCard members={quest.members} />
        ) : null}

        {visibility.showTargetDate ? (
          <QuestTargetDateCard
            label={formatQuestCalendarDate(quest.targetDate, locale)}
          />
        ) : null}

        {visibility.showDeliverables ? (
          <section
            className={CARD_CLASS}
            data-testid="quest-overview-deliverables"
          >
            <SectionHeader title="Deliverables" />
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
}: {
  quest: QuestRecord;
  canPost: boolean;
  onPost: (input: {
    text: string;
    milestoneOrder: number | null;
    linkUrl: string;
  }) => Promise<boolean>;
}) {
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [milestoneOrder, setMilestoneOrder] = useState<number | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [sending, setSending] = useState(false);

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
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const posted = await onPost({
        text: message,
        milestoneOrder,
        linkUrl: linkUrl.trim(),
      });
      if (!posted) return;
      setText('');
      setLinkUrl('');
      setMilestoneOrder(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={LABEL_CLASS}>
          UPDATES · newest first · posted by participants
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
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-11">
              Share progress
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              aria-label="Share progress"
              placeholder="Share progress with the quest…"
              className="w-full resize-none border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none placeholder:text-neutral-11"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={milestoneOrder ?? ''}
              onChange={(e) =>
                setMilestoneOrder(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="h-8 shrink-0 border border-border bg-background-2 px-2 text-xs text-foreground"
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
              aria-label="Link (optional)"
              className="h-8 rounded-none text-xs"
              rootClassName="min-h-8 w-auto min-w-[160px] max-w-xs flex-1"
            />
            <Button
              type="button"
              data-testid="quest-update-post"
              disabled={sending || !text.trim()}
              onClick={() => void submit()}
              className="h-8 shrink-0 gap-1.5 rounded-none px-3 text-[11px] font-semibold uppercase tracking-[0.06em]"
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
                <QuestUpdateCard key={update.id} update={update} />
              ))}
            </div>
          </section>
        ))
      )}
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
        className="shrink-0"
      >
        {action}
      </Button>
    </div>
  );
}

function milestoneStatusLabel(status: QuestMilestoneStatus): string {
  if (status === 'done') return 'Done';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function SettingsTab({
  quest,
  isLead,
  canEdit,
  canChangeMilestones,
  saving,
  openModal,
  onPatch,
  onOpenHelper,
}: {
  quest: QuestRecord;
  isLead: boolean;
  canEdit: boolean;
  canChangeMilestones: boolean;
  saving: boolean;
  openModal: (modal: EditingModal) => void;
  onPatch: (patch: QuestPatch) => void;
  onOpenHelper: () => void;
}) {
  const locale = useLocale();
  const visibility = questOverviewVisibility(quest);
  const leadOnly = !isLead;
  const isPaused = quest.status === 'paused';
  const targetLabel = quest.targetDate
    ? formatQuestCalendarDate(quest.targetDate, locale)
    : '—';
  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4">
      {!isLead ? (
        <p className="border border-border bg-background-2 px-3 py-2 text-[12px] text-neutral-11">
          Only the Lead can change status, transfer the lead, or use the danger
          zone.
        </p>
      ) : null}

      {canEdit ? (
        <section className={CARD_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">
                Quest Helper
              </p>
              <p className="text-[12px] text-neutral-11">
                Suggest one section at a time, then save it
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              data-testid="open-quest-helper-button"
              onClick={onOpenHelper}
              className="shrink-0"
            >
              Quest Helper
            </Button>
          </div>
        </section>
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
            value={targetLabel}
            action="EDIT"
            disabled={!canEdit}
            onAction={() => openModal('targetDate')}
          />
          {quest.status !== 'active' ? (
            <SettingsRow
              label="Quest health"
              action="EDIT"
              disabled={!canEdit}
              onAction={() => openModal('health')}
            />
          ) : null}
        </div>
      </section>

      <section className={CARD_CLASS} data-testid="quest-settings-content">
        <p className={LABEL_CLASS}>QUEST CONTENT</p>
        <div className="divide-y divide-border">
          <SettingsRow
            label="Quest name"
            value={quest.name}
            action="EDIT"
            disabled={!canEdit}
            onAction={() => openModal('name')}
          />
          <SettingsRow
            label="Goal"
            action={visibility.showGoal ? 'EDIT' : 'ADD'}
            disabled={!canEdit}
            onAction={() => openModal('goal')}
          />
          <SettingsRow
            label="Scope"
            action={
              visibility.showScopeIn || visibility.showScopeOut ? 'EDIT' : 'ADD'
            }
            disabled={!canEdit}
            onAction={() => openModal('scope')}
          />
          <SettingsRow
            label="Success criteria"
            action={visibility.showSuccess ? 'EDIT' : 'ADD'}
            disabled={!canEdit}
            onAction={() => openModal('success')}
          />
          <SettingsRow
            label="Quest reward"
            action={visibility.showRewards ? 'EDIT' : 'ADD'}
            disabled={!canEdit}
            onAction={() => openModal('rewards')}
          />
          <SettingsRow
            label="Deliverables"
            value={
              quest.status === 'proposed'
                ? 'Available once the quest is active'
                : `${quest.deliverables.length} ${
                    quest.deliverables.length === 1
                      ? 'deliverable'
                      : 'deliverables'
                  }`
            }
            action={visibility.showDeliverables ? 'EDIT' : 'ADD'}
            disabled={!canEdit || quest.status === 'proposed'}
            onAction={() => openModal('deliverables')}
          />
        </div>
      </section>

      <section className={CARD_CLASS} data-testid="quest-settings-milestones">
        <div className="flex items-center justify-between gap-3">
          <p className={LABEL_CLASS}>MILESTONES</p>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            disabled={!canEdit}
            onClick={() => openModal('milestones')}
          >
            {quest.milestones.length === 0 ? 'Add' : 'Edit'}
          </Button>
        </div>
        {quest.milestones.length === 0 ? (
          <p
            className="pt-3 text-[12px] text-neutral-11"
            data-testid="settings-milestones-empty"
          >
            No milestones yet
          </p>
        ) : (
          <div className="divide-y divide-border">
            {quest.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    M{milestone.order} · {milestone.name}
                  </p>
                  <p className="text-[12px] text-neutral-11">
                    {[
                      milestone.ownerName,
                      formatQuestCalendarDate(milestone.dueDate, locale),
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <select
                  aria-label={`Status for ${milestone.name}`}
                  data-testid={`milestone-status-${milestone.id}`}
                  value={milestone.status}
                  disabled={
                    !canChangeMilestones || saving || milestone.id == null
                  }
                  onChange={(event) => {
                    const status = event.target.value as QuestMilestoneStatus;
                    if (
                      !(QUEST_MILESTONE_STATUSES as readonly string[]).includes(
                        status,
                      )
                    ) {
                      return;
                    }
                    const patch = buildMilestoneStatusPatch(
                      quest.milestones,
                      milestone.id,
                      status,
                    );
                    if (patch) onPatch(patch);
                  }}
                  className="h-10 min-h-10 shrink-0 border border-border bg-background px-2 text-[11px] font-semibold text-foreground disabled:opacity-50"
                >
                  {QUEST_MILESTONE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {milestoneStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
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
            label="Participants"
            value={`${quest.members.length} ${
              quest.members.length === 1 ? 'participant' : 'participants'
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
            value="AI Agents refresh the health summary from participant updates"
            action={quest.stewardHealthSummaries ? 'ON' : 'OFF'}
            disabled={leadOnly}
            onAction={() =>
              onPatch({
                stewardHealthSummaries: !quest.stewardHealthSummaries,
              })
            }
          />
          <SettingsRow
            label="Participant update alerts"
            value="Notify Quest participants when someone posts an update"
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
                : 'Participants keep access; updates are paused'
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
            onAction={() => openModal('archive')}
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
  const [nextStatus, setNextStatus] = useState<QuestPatchStatus>('active');
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
  const [helperOpen, setHelperOpen] = useState(false);
  const [helperInput, setHelperInput] = useState('');
  const [helperTyping, setHelperTyping] = useState(false);
  const [helperMessages, setHelperMessages] = useState<
    SpaceQuestDraftChatMessage[]
  >(() => [
    {
      id: 'helper-m1',
      role: 'member',
      senderName: QUEST_HELPER_NAME,
      timestamp: new Date(),
      text: SAVED_QUEST_HELPER_INTRO,
    },
  ]);
  const helperDraftRef = useRef<QuestDraftStateSnapshot | null>(null);
  const helperPendingRef = useRef<PendingQuestSectionProposal | null>(null);
  const helperStepRef = useRef(0);
  const helperTurnRef = useRef(0);
  const helperSendRef = useRef<(overridePrompt?: string) => void>(() => {});
  const triggerHelperSend = useCallback(() => {
    helperSendRef.current();
  }, []);

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
    if (!quest) {
      helperDraftRef.current = null;
      return;
    }
    helperDraftRef.current = questRecordToDraftSnapshot(quest);
  }, [quest]);

  const helperEditable =
    !!quest &&
    (quest.status === 'active' || quest.status === 'paused') &&
    canMemberEditQuest(viewer, quest);

  useEffect(() => {
    if (!helperOpen) return;
    if (!quest || !helperEditable) {
      setHelperOpen(false);
      if (!detailChatOpen) setSpaceQuestDraft(null);
      return;
    }
    setSpaceQuestDraft({
      spaceSlug,
      questTitle: quest.name,
      messages: helperMessages,
      input: helperInput,
      onInputChange: setHelperInput,
      onSend: triggerHelperSend,
      isAgentTyping: helperTyping,
      coach: 'quest-helper',
    });
  }, [
    detailChatOpen,
    helperEditable,
    helperInput,
    helperMessages,
    helperOpen,
    helperTyping,
    quest,
    setSpaceQuestDraft,
    spaceSlug,
    triggerHelperSend,
  ]);

  useEffect(() => {
    if (!detailChatOpen || !quest || helperOpen) return;
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
    helperOpen,
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
  const canChangeMilestones = canChangeMilestoneStatus(viewer, quest);
  const health = healthPresentation(quest);
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
    setHelperOpen(false);
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

    const viewerName = viewer?.name?.trim() || 'Participant';
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
            history: questAssistHistoryEntries(detailChatMessages.slice(-8)),
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
          saved = Boolean(await savePatch(patchToSave));
        }
      }
      const replyText =
        data.reply?.trim() ||
        (saved
          ? 'Updated the quest sections on screen.'
          : QUEST_HELPER_OFFLINE_REPLY);
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

  const savePatch = async (patch: QuestPatch): Promise<QuestRecord | null> => {
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
      return updated;
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update quest',
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openQuestHelper = () => {
    if (!canEdit) return;
    if (helperOpen) {
      setHelperOpen(false);
      if (!detailChatOpen) setSpaceQuestDraft(null);
      return;
    }
    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
      closeAiPanel();
    }
    setDetailChatOpen(false);
    setHelperOpen(true);
    openHumanChatPanel();
  };

  const handleSendHelperMessage = async (overridePrompt?: string) => {
    const rawTrimmed = (overridePrompt ?? helperInput).trim();
    if (!rawTrimmed || !canEdit) return;
    if (!overridePrompt) setHelperInput('');
    const snapshot = helperDraftRef.current;
    if (!snapshot) return;

    const trimmed = questHelperTurnMessage(rawTrimmed);
    const generation = ++helperTurnRef.current;
    const readTurnState = () => ({
      draft: helperDraftRef.current ?? snapshot,
      pending: helperPendingRef.current,
      currentStep: QUEST_STEWARD_STEPS[helperStepRef.current] ?? 'goal',
    });
    const viewerName = viewer?.name?.trim() || 'Participant';
    const now = new Date();
    setHelperMessages((prev) => [
      ...prev,
      {
        id: `hu-${now.getTime()}`,
        role: 'user',
        senderName: viewerName,
        avatarUrl: person?.avatarUrl ?? undefined,
        timestamp: now,
        text: rawTrimmed,
      },
    ]);
    const history = helperMessages.slice(-8).map((entry) => ({
      role: entry.role === 'user' ? ('user' as const) : ('agent' as const),
      text: entry.text,
    }));
    const usesModel = questDraftTurnUsesModel(trimmed);
    setHelperTyping(questHelperTypingForTurn(usesModel));
    try {
      const outcome = await runSavedQuestHelperTurn({
        message: trimmed,
        history,
        viewerDisplayName: viewerName,
        spaceMembers,
        readState: readTurnState,
        isCurrent: () => helperTurnRef.current === generation,
        saveSection: async (patch) => {
          const updated = await savePatch(patch);
          if (!updated) return false;
          helperDraftRef.current = questRecordToDraftSnapshot(updated);
          return true;
        },
        loadModel: async () => {
          const currentSnapshot = helperDraftRef.current;
          if (!currentSnapshot) return null;
          const token = await getAccessToken?.().catch(() => null);
          if (!token || helperTurnRef.current !== generation) return null;
          const currentStep =
            QUEST_STEWARD_STEPS[helperStepRef.current] ?? 'goal';
          const pendingNow = helperPendingRef.current;
          const suggestion = questDraftSuggestionStatus(trimmed, pendingNow);
          try {
            const response = await fetch(
              `/api/v1/spaces/${encodeURIComponent(
                spaceSlug,
              )}/quests/draft-assist`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(
                  questHelperDraftAssistBody({
                    message: trimmed,
                    currentStep,
                    spaceTitle: quest.spaceTitle,
                    draft: currentSnapshot,
                    spaceMembers,
                    history: questAssistHistoryEntries(history),
                    pendingSuggestion: (() => {
                      const wording =
                        pendingNow &&
                        (suggestion.status === 'awaiting' ||
                          suggestion.status === 'revising')
                          ? formatPendingQuestPatch(pendingNow.patch).slice(
                              0,
                              2000,
                            )
                          : '';
                      return {
                        status: suggestion.status,
                        ...(suggestion.step ? { step: suggestion.step } : {}),
                        ...(wording ? { wording } : {}),
                      };
                    })(),
                  }),
                ),
              },
            );
            if (helperTurnRef.current !== generation || !response.ok) {
              return null;
            }
            return (await response.json()) as QuestDraftModelTurn;
          } catch {
            return null;
          }
        },
      });
      if (!outcome || helperTurnRef.current !== generation) return;
      helperPendingRef.current = outcome.pending;
      helperStepRef.current = Math.max(
        0,
        QUEST_STEWARD_STEPS.indexOf(outcome.focusStep),
      );
      setHelperMessages((prev) => [
        ...prev,
        {
          id: `hs-${Date.now()}`,
          role: 'member',
          senderName: QUEST_HELPER_NAME,
          timestamp: new Date(),
          text: outcome.reply,
        },
      ]);
    } finally {
      const typing = questHelperTypingAfterTurn(
        generation,
        helperTurnRef.current,
      );
      if (typing === false) setHelperTyping(false);
    }
  };

  helperSendRef.current = (overridePrompt?: string) => {
    void handleSendHelperMessage(overridePrompt);
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

  const tabs = spaceQuestDetailTabLinks(baseHref);

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
            <span className="bg-neutral-3 px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {statusLabel(quest.status)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <span
                className={cn('size-2 rounded-full', health.dotClass)}
                aria-hidden
              />
              <span className={health.textClass}>{health.label}</span>
            </span>
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
        <QuestDetailSubheading
          lead={resolveQuestLeadIdentity({
            leadName: quest.leadName,
            avatarSrc:
              quest.members.find((member) => member.isLead)?.memberAvatarUrl ??
              findQuestSpaceMember(spaceMembers, { name: quest.leadName })
                ?.avatarUrl ??
              (viewer?.name &&
              quest.leadName.trim().toLowerCase() ===
                viewer.name.trim().toLowerCase()
                ? person?.avatarUrl ?? undefined
                : undefined),
            personId:
              quest.members.find((member) => member.isLead)?.personId ??
              findQuestSpaceMember(spaceMembers, { name: quest.leadName })
                ?.personId ??
              (viewer?.name &&
              quest.leadName.trim().toLowerCase() ===
                viewer.name.trim().toLowerCase()
                ? person?.id
                : undefined),
          })}
          progress={questDetailProgressLabel(quest)}
        />
      </header>

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
        <OverviewTab quest={quest} spaceTokens={spaceTokens} />
      ) : null}
      {tab === 'updates' ? (
        <UpdatesTab quest={quest} canPost={canEdit} onPost={postUpdate} />
      ) : null}
      {tab === 'settings' ? (
        <SettingsTab
          quest={quest}
          isLead={isLead}
          canEdit={canEdit}
          canChangeMilestones={canChangeMilestones}
          saving={saving}
          openModal={(modal) => {
            if (modal === 'status') {
              setNextStatus(quest.status === 'active' ? 'completed' : 'active');
            }
            setEditingModal(modal);
          }}
          onPatch={(patch) => void savePatch(patch)}
          onOpenHelper={openQuestHelper}
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
        open={editingModal === 'archive'}
        onOpenChange={closeModal}
        title="Archive this quest?"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-neutral-11">
            Hide {quest.name} from the list. Content becomes read-only, and
            there is no restore action for the Lead.
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
              onClick={() => {
                setEditingModal(null);
                void savePatch({ status: 'archived' });
              }}
            >
              ARCHIVE QUEST
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
            This permanently removes {quest.name} with its milestones,
            participants, deliverables and updates.
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
