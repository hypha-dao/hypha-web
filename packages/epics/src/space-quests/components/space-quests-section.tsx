'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_LIST_FILTERS,
  formatQuestCalendarDate,
  questHealthDisplay,
  type QuestHealthState,
  type QuestListFilter,
  type QuestRecord,
  type QuestStatus,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Skeleton,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import {
  deleteQuestDraftRequest,
  useMyQuestDrafts,
  useSpaceQuests,
} from '../hooks/use-space-quests';
import { questRichTextPlain } from '../utils/quest-rich-text';

function statusBadgeClasses(status: QuestStatus): string {
  switch (status) {
    case 'proposed':
      return 'bg-[#edebff] text-[#4b4bff] dark:bg-accent-3 dark:text-accent-11';
    case 'completed':
      return 'bg-neutral-3 text-foreground';
    case 'paused':
      return 'bg-neutral-3 text-neutral-11';
    case 'archived':
      return 'bg-neutral-3 text-neutral-11';
    default:
      return 'bg-neutral-3 text-foreground';
  }
}

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

export function healthBadgeMeta(state: QuestHealthState): {
  dotClass: string;
  textClass: string;
  label: string;
} {
  switch (state) {
    case 'at_risk':
      return {
        dotClass: 'bg-[#d99a1e]',
        textClass: 'text-[#d99a1e]',
        label: 'At risk',
      };
    case 'off_track':
      return {
        dotClass: 'bg-[#d2463c]',
        textClass: 'text-[#d2463c]',
        label: 'Off track',
      };
    default:
      return {
        dotClass: 'bg-[#2e9e5b]',
        textClass: 'text-[#2e9e5b]',
        label: 'On track',
      };
  }
}

export function formatRelativeTimeShort(
  iso: string | null | undefined,
): string {
  if (!iso) return 'just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 90) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 14) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
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

function latestCardUpdateLine(quest: QuestRecord): string {
  const latest = quest.updates[0];
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

export function QuestCard({
  quest,
  href,
  locale = 'en',
}: {
  quest: QuestRecord;
  href: string;
  locale?: string;
}) {
  const health = cardHealth(quest);
  const progress = milestoneProgressMeta(quest);
  const leadName = quest.leadName.trim();
  const leadInitial = leadName[0]?.toUpperCase() ?? '';
  const goalPlain = questRichTextPlain(quest.goal);
  const targetLabel = questCardTargetLabel(quest.targetDate, locale);

  return (
    <Link
      href={href}
      data-testid={`quest-card-${quest.slug}`}
      className="craft-card-interactive group flex h-full min-w-0 w-full max-w-full flex-col gap-2.5 p-3.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold',
            statusBadgeClasses(quest.status),
          )}
        >
          {statusLabel(quest.status)}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold">
          <span
            className={cn('size-2 shrink-0 rounded-full', health.dotClass)}
            aria-hidden
          />
          <span className={health.textClass}>{health.label}</span>
        </span>
      </div>

      <h2 className="break-words font-display text-4 font-medium tracking-tight text-foreground [overflow-wrap:anywhere]">
        {quest.name}
      </h2>
      {goalPlain ? (
        <p className="line-clamp-2 break-words text-[13px] text-neutral-11 [overflow-wrap:anywhere]">
          {goalPlain}
        </p>
      ) : null}

      {leadName || targetLabel ? (
        <div className="flex min-w-0 flex-col gap-0.5 text-xs">
          {leadName ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[9px] font-bold text-background">
                {leadInitial}
              </span>
              <span className="break-words font-medium text-foreground [overflow-wrap:anywhere]">
                {leadName}
              </span>
            </span>
          ) : null}
          {targetLabel ? (
            <span
              className="break-words font-medium text-neutral-11 [overflow-wrap:anywhere]"
              data-testid={`quest-card-target-${quest.slug}`}
            >
              {targetLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Progress bar + Mx of N */}
      <div className="flex items-center gap-2.5">
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

      {/* Latest update line (desktop 01-quests-list) */}
      <div className="mt-auto border-t border-border pt-2.5">
        <p className="line-clamp-2 break-words text-xs text-neutral-11 [overflow-wrap:anywhere]">
          {latestCardUpdateLine(quest)}
        </p>
      </div>
    </Link>
  );
}

type QuestListView = QuestListFilter | 'drafts';

export function SpaceQuestsSection({ spaceSlug }: { spaceSlug: string }) {
  const locale = useLocale();
  const t = useTranslations('SpaceQuests');
  const { getAccessToken } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({ spaceSlug, space });
  const { overview, isLoading, error, refresh } = useSpaceQuests(spaceSlug);
  const { drafts, visible: draftsVisible } = useMyQuestDrafts(spaceSlug);
  const [filter, setFilter] = useState<QuestListView>('active');
  const [search, setSearch] = useState('');
  const [draftToDelete, setDraftToDelete] = useState<number | null>(null);
  const [deletingDraft, setDeletingDraft] = useState(false);

  const quests = useMemo(() => overview?.quests ?? [], [overview]);
  const counts = overview?.counts ?? {
    active: 0,
    proposed: 0,
    paused: 0,
    completed: 0,
    archived: 0,
    total: 0,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quests
      .filter((quest) => quest.status === filter)
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

  const confirmDeleteDraft = async () => {
    if (draftToDelete == null) return;
    setDeletingDraft(true);
    try {
      await deleteQuestDraftRequest({
        spaceSlug,
        draftId: draftToDelete,
        getAccessToken,
      });
      setDraftToDelete(null);
    } catch {
      // Leave the confirm open so the author can retry.
    } finally {
      setDeletingDraft(false);
    }
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
  };

  return (
    <div className="space-y-4">
      <header className="flex w-full flex-wrap items-center justify-between gap-3">
        <h1 className={QUEST_LIST_TITLE_CLASS}>
          {t('title')}
          <span className="ml-2 text-4 font-normal text-muted-foreground">
            | {new Intl.NumberFormat(locale).format(counts.total)}
          </span>
        </h1>
        {canMutate ? (
          <Button
            asChild
            className="ml-auto shrink-0 bg-foreground text-background hover:bg-foreground/90"
            data-testid="new-quest-button"
          >
            <Link href={newQuestHref}>{t('newQuest')}</Link>
          </Button>
        ) : null}
      </header>

      {/* Search bar */}
      <div className="w-full">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          leftIcon={<Search className="size-3.5 text-neutral-11" />}
          rootClassName="w-full"
          className="rounded-none"
          data-testid="search-quests-input"
        />
      </div>

      {/* Status filter chips: Active, Proposed, Paused, Completed */}
      <div
        role="tablist"
        aria-label={t('title')}
        className="flex flex-wrap items-center gap-2"
      >
        {QUEST_LIST_FILTERS.map((key) => {
          const active = filter === key;
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`quest-filter-${key}`}
              onClick={() => setFilter(key)}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold transition-colors',
                active
                  ? 'bg-foreground text-background'
                  : 'bg-neutral-3 text-foreground hover:bg-neutral-4',
              )}
            >
              <span>{filterLabels[key]}</span>
              <span>{count}</span>
            </button>
          );
        })}
        {draftsVisible ? (
          <button
            type="button"
            role="tab"
            aria-selected={showingDrafts}
            data-testid="quest-filter-drafts"
            onClick={() => setFilter('drafts')}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold transition-colors',
              showingDrafts
                ? 'bg-foreground text-background'
                : 'bg-neutral-3 text-foreground hover:bg-neutral-4',
            )}
          >
            <span>{t('filters.drafts')}</span>
            <span>{drafts.length}</span>
          </button>
        ) : null}
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
          if (!open && !deletingDraft) setDraftToDelete(null);
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
                disabled={deletingDraft}
                onClick={() => setDraftToDelete(null)}
              >
                {t('drafts.cancel')}
              </Button>
              <Button
                type="button"
                className="bg-foreground text-background hover:bg-foreground/90"
                disabled={deletingDraft}
                onClick={() => void confirmDeleteDraft()}
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
