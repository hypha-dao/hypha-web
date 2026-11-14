'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_LIST_FILTERS,
  formatQuestCalendarDate,
  isRejectedProposedQuest,
  questHealthDisplay,
  questListBucket,
  type QuestListFilter,
  type QuestRecord,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  Skeleton,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ChevronDown, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { PersonAvatar } from '../../people/components/person-avatar';
import { QuestStatusBadge } from './quest-status-badge';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import {
  deleteQuestDraftRequest,
  findQuestSpaceMember,
  useMyQuestDrafts,
  useQuestSpaceMembers,
  useSpaceQuests,
  type QuestSpaceMember,
} from '../hooks/use-space-quests';
import { questRichTextPlain } from '../utils/quest-rich-text';
import { formatRelativeTimeShort, healthBadgeMeta } from '../quest-health-meta';

export { formatRelativeTimeShort, healthBadgeMeta } from '../quest-health-meta';

function showQuestHealthTag(
  quest: Pick<QuestRecord, 'status' | 'proposalStatus'>,
): boolean {
  return quest.status !== 'completed' && !isRejectedProposedQuest(quest);
}

function milestoneProgressMeta(quest: QuestRecord): {
  label: string;
  percent: number;
} {
  const total = quest.milestones.length;
  if (quest.status === 'proposed') {
    return { label: total === 0 ? '—' : `M1 of ${total}`, percent: 0 };
  }
  if (total === 0) {
    return { label: '—', percent: 2 };
  }
  const doneCount = quest.milestones.filter((m) => m.status === 'done').length;
  const inProgressIndex = quest.milestones.findIndex(
    (m) => m.status === 'in_progress',
  );
  const currentMilestone =
    quest.status === 'completed' || doneCount === total
      ? total
      : inProgressIndex >= 0
      ? inProgressIndex + 1
      : Math.min(total, doneCount + 1);
  const rawPercent =
    quest.status === 'completed' || doneCount === total
      ? 100
      : Math.max(12, Math.round(((doneCount + 0.5) / total) * 100));
  return {
    label: `M${currentMilestone} of ${total}`,
    percent: Math.min(100, rawPercent),
  };
}

export function questCardTargetLabel(
  targetDate: string | null | undefined,
  locale: string,
): string | null {
  const raw = targetDate?.trim() ?? '';
  if (!raw) return null;
  const formatted = formatQuestCalendarDate(raw, locale).trim();
  return formatted ? `Target ${formatted}` : null;
}

/** Same title treatment as space tab `TabScreenTitle` (`craft-page-title text-6 font-medium`). */
export const QUEST_LIST_TITLE_CLASS =
  'craft-page-title min-w-0 text-6 font-medium';

export const QUEST_LIST_GRID_CLASS =
  'grid min-w-0 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3 [grid-auto-rows:1fr]';

function cardHealth(quest: QuestRecord): {
  dotClass: string;
  textClass: string;
  label: string;
} {
  const display = questHealthDisplay(quest);
  if (display.notStarted) {
    return {
      dotClass: 'bg-neutral-9',
      textClass: 'text-neutral-11',
      label: display.label,
    };
  }
  const meta = healthBadgeMeta(display.state ?? 'on_track');
  return { ...meta, label: display.label };
}

function latestCardUpdateLine(
  quest: QuestRecord,
  proposalRejectedLabel: string,
): string {
  const latest = quest.updates[0];
  if (isRejectedProposedQuest(quest)) {
    const name = latest?.authorName || quest.leadName || 'Participant';
    const first = name.split(' ')[0] || 'Participant';
    const rel = latest ? formatRelativeTimeShort(latest.createdAt) : 'just now';
    return `${first} · ${rel}: ${proposalRejectedLabel}`;
  }
  if (!latest) {
    const first = (quest.leadName || 'Participant').split(' ')[0];
    return quest.status === 'proposed'
      ? `${first} · just now: proposed, waiting for votes`
      : `${first} · recently: quest active`;
  }
  const first = (latest.authorName || 'Participant').split(' ')[0];
  const rel = formatRelativeTimeShort(latest.createdAt);
  const linkSuffix =
    latest.links[0]?.label && !latest.text.includes(latest.links[0].label)
      ? ` — ${latest.links[0].label}`
      : '';
  return `${first} · ${rel}: ${latest.text.replace(/\.$/, '')}${linkSuffix}`;
}

function questLeadPortrait(
  quest: QuestRecord,
  spaceMembers: readonly QuestSpaceMember[],
): { avatarSrc?: string; personId?: number } {
  const leadName = quest.leadName.trim().toLowerCase();
  const lead =
    quest.members.find((member) => member.isLead) ??
    quest.members.find(
      (member) => member.memberName.trim().toLowerCase() === leadName,
    );
  const roster = findQuestSpaceMember(spaceMembers, {
    personId: lead?.personId ?? quest.leadPersonId,
    name: quest.leadName,
  });
  const avatarSrc =
    lead?.memberAvatarUrl?.trim() ||
    quest.leadAvatarUrl?.trim() ||
    roster?.avatarUrl?.trim() ||
    undefined;
  const personId =
    (lead?.personId && lead.personId > 0 ? lead.personId : undefined) ??
    (quest.leadPersonId && quest.leadPersonId > 0
      ? quest.leadPersonId
      : undefined) ??
    roster?.personId;
  return { avatarSrc: avatarSrc || undefined, personId };
}

export function QuestCard({
  quest,
  href,
  locale = 'en',
  spaceMembers = [],
}: {
  quest: QuestRecord;
  href: string;
  locale?: string;
  spaceMembers?: readonly QuestSpaceMember[];
}) {
  const t = useTranslations('SpaceQuests');
  const health = cardHealth(quest);
  const progress = milestoneProgressMeta(quest);
  const leadName = quest.leadName.trim();
  const leadInitial = leadName[0]?.toUpperCase() ?? '';
  const leadPortrait = questLeadPortrait(quest, spaceMembers);
  const goalPlain = questRichTextPlain(quest.goal);
  const targetLabel = questCardTargetLabel(quest.targetDate, locale);

  return (
    <Link
      href={href}
      data-testid={`quest-card-${quest.slug}`}
      className="craft-card-interactive group flex h-full min-w-0 w-full max-w-full flex-col gap-2.5 p-3.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex h-8 shrink-0 flex-nowrap items-center justify-between gap-2 overflow-hidden">
        <QuestStatusBadge quest={quest} />
        {showQuestHealthTag(quest) ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold">
            <span
              className={cn('size-2 shrink-0 rounded-full', health.dotClass)}
              aria-hidden
            />
            <span className={health.textClass}>{health.label}</span>
          </span>
        ) : null}
      </div>

      <h2
        data-testid={`quest-card-title-${quest.slug}`}
        className="line-clamp-2 h-[2lh] shrink-0 break-words font-display text-4 font-medium leading-tight tracking-tight text-foreground [overflow-wrap:anywhere]"
      >
        {quest.name}
      </h2>
      <p
        data-testid={`quest-card-goal-${quest.slug}`}
        className="line-clamp-2 h-[2lh] shrink-0 break-words text-[13px] leading-relaxed text-neutral-11 [overflow-wrap:anywhere]"
      >
        {goalPlain}
      </p>

      <div
        className="flex h-5 shrink-0 min-w-0 items-center gap-1.5"
        data-testid={`quest-card-lead-${quest.slug}`}
      >
        {leadName ? (
          <>
            {leadPortrait.avatarSrc ? (
              <PersonAvatar
                size="sm"
                shape="circle"
                showPresence={false}
                avatarSrc={leadPortrait.avatarSrc}
                userName={leadName}
                personId={leadPortrait.personId}
                className="h-5 w-5"
              />
            ) : (
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[9px] font-bold text-background">
                {leadInitial}
              </span>
            )}
            <span className="min-w-0 truncate text-xs font-medium text-foreground">
              {leadName}
            </span>
          </>
        ) : null}
      </div>
      <p
        className="flex h-5 min-w-0 shrink-0 items-center truncate text-xs font-medium text-neutral-11"
        data-testid={`quest-card-target-${quest.slug}`}
      >
        {targetLabel ?? ''}
      </p>

      <div
        className="flex shrink-0 items-center gap-2.5"
        data-testid={`quest-card-progress-${quest.slug}`}
      >
        <div className="h-1.5 flex-1 overflow-hidden bg-neutral-4">
          <div
            className="h-full bg-foreground transition-[width]"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-foreground">
          {progress.label}
        </span>
      </div>

      <div
        className="mt-auto shrink-0 border-t border-border pt-2.5"
        data-testid={`quest-card-footer-${quest.slug}`}
      >
        <p className="line-clamp-2 h-[2lh] break-words text-xs leading-relaxed text-neutral-11 [overflow-wrap:anywhere]">
          {latestCardUpdateLine(quest, t('activity.proposalRejected'))}
        </p>
      </div>
    </Link>
  );
}

type QuestListView = QuestListFilter | 'drafts';

const STATUS_MENU_CLASS =
  'min-w-44 rounded-none border border-border bg-background p-1 text-foreground shadow-none';

const STATUS_ITEM_CLASS =
  'rounded-none text-1 uppercase tracking-[0.12em] data-[state=checked]:bg-foreground/5';

function QuestStatusFilter({
  value,
  options,
  onChange,
}: {
  value: QuestListView;
  options: ReadonlyArray<{ value: QuestListView; label: string }>;
  onChange: (value: QuestListView) => void;
}) {
  const t = useTranslations('SpaceQuests');
  const portalStyle = useSpaceAccentPortalStyles();
  const label =
    options.find((option) => option.value === value)?.label ??
    t('filters.active');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid="quest-status-filter"
          className="data-[state=open]:border-foreground/40 data-[state=open]:bg-foreground/5"
        >
          {label}
          <ChevronDown
            className="size-3.5 shrink-0"
            strokeWidth={1.25}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className={STATUS_MENU_CLASS}
        style={portalStyle}
        data-space-accent-scope
        data-testid="quest-status-filter-menu"
      >
        <DropdownMenuLabel className="px-3 pb-1.5 pt-2 text-1 font-medium text-muted-foreground">
          {t('filters.status')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as QuestListView)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className={STATUS_ITEM_CLASS}
              data-testid={`quest-filter-${option.value}`}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SpaceQuestsSection({ spaceSlug }: { spaceSlug: string }) {
  const locale = useLocale();
  const t = useTranslations('SpaceQuests');
  const { getAccessToken } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({ spaceSlug, space });
  const { overview, isLoading, error, refresh } = useSpaceQuests(spaceSlug);
  const { drafts, visible: draftsVisible } = useMyQuestDrafts(spaceSlug);
  const spaceMembers = useQuestSpaceMembers(spaceSlug);
  const [filter, setFilter] = useState<QuestListView>('active');
  const [search, setSearch] = useState('');
  const [draftToDelete, setDraftToDelete] = useState<number | null>(null);
  const [draftDeleteError, setDraftDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftDeleteError) return;
    const timer = window.setTimeout(() => setDraftDeleteError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [draftDeleteError]);

  const quests = useMemo(() => overview?.quests ?? [], [overview]);
  const counts = overview?.counts ?? {
    active: 0,
    proposed: 0,
    paused: 0,
    completed: 0,
    rejected: 0,
    archived: 0,
    total: 0,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quests
      .filter(
        (quest) => filter !== 'drafts' && questListBucket(quest) === filter,
      )
      .filter((quest) => {
        if (!q) return true;
        return (
          quest.name.toLowerCase().includes(q) ||
          quest.goal.toLowerCase().includes(q) ||
          quest.leadName.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.latestUpdateAt).getTime() -
          new Date(a.latestUpdateAt).getTime(),
      );
  }, [filter, quests, search]);

  const visibleDrafts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drafts.filter((draft) => {
      if (!q) return true;
      return draft.name.toLowerCase().includes(q);
    });
  }, [drafts, search]);
  const showingDrafts = filter === 'drafts' && draftsVisible;

  const newQuestHref = `/${locale}/dho/${spaceSlug}/quests/new?fresh=1`;

  const confirmDeleteDraft = () => {
    if (draftToDelete == null) return;
    const draftId = draftToDelete;
    setDraftToDelete(null);
    setDraftDeleteError(null);
    void Promise.resolve(
      deleteQuestDraftRequest({
        spaceSlug,
        draftId,
        getAccessToken,
      }),
    ).catch(() => {
      setDraftDeleteError(t('drafts.deleteFailed'));
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="border border-error-6 bg-background-2 px-4 py-6">
        <p className="text-2 text-error-11">{t('error.load')}</p>
        <Button
          type="button"
          className="mt-3"
          variant="outline"
          colorVariant="neutral"
          onClick={() => void refresh()}
        >
          {t('error.retry')}
        </Button>
      </div>
    );
  }

  const filterLabels: Record<QuestListFilter, string> = {
    active: t('filters.active'),
    proposed: t('filters.proposed'),
    paused: t('filters.paused'),
    completed: t('filters.completed'),
    rejected: t('filters.rejected'),
  };

  return (
    <div className="space-y-4">
      {draftDeleteError ? (
        <div
          role="alert"
          data-testid="quest-draft-delete-error"
          className="fixed bottom-4 left-1/2 z-50 max-w-sm -translate-x-1/2 border border-error-6 bg-background px-4 py-2 text-sm text-error-11"
        >
          {draftDeleteError}
        </div>
      ) : null}
      <header className="flex w-full flex-wrap items-center justify-between gap-3">
        <h1 className={QUEST_LIST_TITLE_CLASS}>
          {t('title')}
          <span className="ml-2 text-4 font-normal text-muted-foreground">
            | {new Intl.NumberFormat(locale).format(counts.total)}
          </span>
        </h1>
      </header>

      <div
        className="flex w-full items-center gap-3"
        data-testid="quest-list-toolbar"
      >
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          rootClassName="min-w-0 flex-1"
          className="min-w-0"
          data-testid="search-quests-input"
        />
        {canMutate ? (
          <Button
            asChild
            className="shrink-0 bg-foreground text-background hover:bg-foreground/90"
            data-testid="new-quest-button"
          >
            <Link href={newQuestHref}>{t('newQuest')}</Link>
          </Button>
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="quest-status-filter-row"
      >
        <QuestStatusFilter
          value={filter}
          options={[
            ...QUEST_LIST_FILTERS.map((key) => ({
              value: key,
              label: filterLabels[key],
            })),
            ...(draftsVisible
              ? [{ value: 'drafts' as const, label: t('filters.drafts') }]
              : []),
          ]}
          onChange={setFilter}
        />
      </div>

      {/* Grid of Quest cards (no Kanban board) */}
      {showingDrafts ? (
        visibleDrafts.length === 0 ? (
          <div
            className="border border-dashed border-border bg-background-2 px-6 py-10 text-center"
            data-testid="quest-drafts-empty"
          >
            <p className="text-sm text-neutral-11">{t('drafts.empty')}</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="quest-drafts-list">
            {visibleDrafts.map((draft) => (
              <div
                key={draft.id}
                data-testid={`quest-draft-${draft.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {draft.name.trim() || t('drafts.untitled')}
                  </p>
                  <p className="text-xs text-neutral-11">
                    {t('drafts.edited', {
                      when: formatRelativeTimeShort(draft.updatedAt),
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" className="rounded-none">
                    <Link
                      href={`/${locale}/dho/${spaceSlug}/quests/new?draft=${draft.id}`}
                      data-testid={`continue-quest-draft-${draft.id}`}
                    >
                      {t('drafts.continue')}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    className="rounded-none"
                    onClick={() => setDraftToDelete(draft.id)}
                    data-testid={`delete-quest-draft-${draft.id}`}
                  >
                    {t('drafts.delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div
          className="border border-dashed border-border bg-background-2 px-6 py-10 text-center"
          data-testid="quest-list-empty"
        >
          <p className="text-sm text-neutral-11">{t('subtitle')}</p>
          {canMutate ? (
            <Button asChild variant="outline" className="mt-3 rounded-none">
              <Link href={newQuestHref}>{t('newQuest')}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={QUEST_LIST_GRID_CLASS}>
          {filtered.map((quest) => (
            <QuestCard
              key={quest.slug}
              quest={quest}
              locale={locale}
              spaceMembers={spaceMembers}
              href={`/${locale}/dho/${spaceSlug}/quests/${encodeURIComponent(
                quest.slug,
              )}`}
            />
          ))}
        </div>
      )}

      <Dialog
        open={draftToDelete != null}
        onOpenChange={(open) => {
          if (!open) setDraftToDelete(null);
        }}
      >
        <DialogContent
          hideCloseButton
          className="max-w-[480px] rounded-none border border-border bg-background p-6"
        >
          <div className="space-y-4">
            <DialogTitle className="font-display text-[18px] font-bold text-foreground">
              {t('drafts.deleteTitle')}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed text-neutral-11">
              {t('drafts.deleteBody')}
            </DialogDescription>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                className="rounded-none"
                onClick={() => setDraftToDelete(null)}
              >
                {t('drafts.cancel')}
              </Button>
              <Button
                type="button"
                className="bg-foreground text-background hover:bg-foreground/90"
                onClick={confirmDeleteDraft}
                data-testid="confirm-delete-quest-draft"
              >
                {t('drafts.deleteConfirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
