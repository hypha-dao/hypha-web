'use client';

import {
  resolveEffectiveBoard,
  type QuestRecord,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useLocale } from 'next-intl';
import { QuestCard } from './space-quests-section';
import type { QuestSpaceMember } from '../hooks/use-space-quests';
import {
  QUEST_BOARD_COLUMNS,
  groupQuestsByColumn,
  groupQuestsByLane,
  questDomainChoices,
  questDomainDotClass,
  type QuestBoardColumn,
  type QuestDomainChoice,
} from '../utils/quest-board-groups';

export type QuestBoardLayout = 'kanban' | 'swimlane';

function domainForQuest(
  quest: QuestRecord,
  workflow: SignalWorkflowConfig | null | undefined,
  domains: Map<string, QuestDomainChoice>,
): QuestDomainChoice | null {
  if (!workflow?.boards?.length) return null;
  const slug = resolveEffectiveBoard(quest.domain, workflow);
  return domains.get(slug) ?? null;
}

function QuestBoardCard({
  quest,
  locale,
  spaceSlug,
  spaceMembers,
  domain,
}: {
  quest: QuestRecord;
  locale: string;
  spaceSlug: string;
  spaceMembers: readonly QuestSpaceMember[];
  domain: QuestDomainChoice | null;
}) {
  return (
    <QuestCard
      quest={quest}
      locale={locale}
      spaceMembers={spaceMembers}
      domain={domain}
      className="h-auto"
      href={`/${locale}/dho/${spaceSlug}/quests/${encodeURIComponent(
        quest.slug,
      )}`}
    />
  );
}

function Column({
  column,
  label,
  quests,
  locale,
  spaceSlug,
  spaceMembers,
  workflow,
  domains,
  showDomain,
  testId,
  variant,
}: {
  column: QuestBoardColumn;
  label: string;
  quests: QuestRecord[];
  locale: string;
  spaceSlug: string;
  spaceMembers: readonly QuestSpaceMember[];
  workflow: SignalWorkflowConfig | null | undefined;
  domains: Map<string, QuestDomainChoice>;
  showDomain: boolean;
  testId: string;
  variant: QuestBoardLayout;
}) {
  const swimlane = variant === 'swimlane';
  return (
    <section
      data-testid={testId}
      data-quest-column={column}
      className={cn(
        'flex w-full min-w-0 flex-none flex-col overflow-visible border-b border-border/50 last:border-b-0',
        'md:overflow-hidden md:border-b-0 md:border-r md:last:border-r-0',
        swimlane
          ? 'md:min-h-0 md:min-w-[15.5rem] md:flex-1'
          : 'md:h-auto md:max-h-[min(calc(100dvh-13rem),56rem)] md:min-h-0 md:min-w-[17.5rem] md:flex-1',
      )}
    >
      <header
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b border-border/40',
          swimlane ? 'px-2.5 py-2' : 'px-3 py-2.5',
        )}
      >
        <h2
          className={cn(
            'truncate font-semibold uppercase tracking-wide',
            swimlane
              ? 'text-[11px] text-muted-foreground'
              : 'text-xs text-foreground',
          )}
        >
          {label}
        </h2>
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {quests.length}
        </span>
      </header>
      <div
        className={cn(
          'flex min-h-0 flex-col gap-2 p-2 [&>*]:shrink-0',
          'md:grow md:overflow-y-auto md:overscroll-y-auto md:touch-pan-y md:[scrollbar-gutter:stable] md:[scrollbar-width:thin] md:narrow-scrollbar',
        )}
      >
        {quests.map((quest) => (
          <QuestBoardCard
            key={quest.slug}
            quest={quest}
            locale={locale}
            spaceSlug={spaceSlug}
            spaceMembers={spaceMembers}
            domain={
              showDomain ? domainForQuest(quest, workflow, domains) : null
            }
          />
        ))}
      </div>
    </section>
  );
}

export function QuestBoard({
  layout,
  quests,
  workflow,
  columnLabel,
  spaceSlug,
  spaceMembers,
}: {
  layout: QuestBoardLayout;
  quests: QuestRecord[];
  workflow: SignalWorkflowConfig | null | undefined;
  columnLabel: (column: QuestBoardColumn) => string;
  spaceSlug: string;
  spaceMembers: readonly QuestSpaceMember[];
}) {
  const locale = useLocale();
  const domainList = questDomainChoices(workflow);
  const domains = new Map(domainList.map((domain) => [domain.slug, domain]));

  if (layout === 'swimlane') {
    const lanes = groupQuestsByLane(quests, workflow).filter((lane) =>
      QUEST_BOARD_COLUMNS.some((column) => lane.columns[column].length > 0),
    );
    return (
      <div
        className="flex w-full flex-col"
        data-testid="quest-board"
        data-layout="swimlane"
      >
        {lanes.map((lane) => (
          <section
            key={lane.domain.slug}
            data-testid={`quest-lane-${lane.domain.slug}`}
            className="w-full border-b border-border/50"
          >
            <header className="flex items-center gap-2.5 px-1 py-3">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  questDomainDotClass(lane.domain.color),
                )}
                data-testid="quest-domain-dot"
                data-domain-color={lane.domain.color}
                aria-hidden
              />
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {lane.domain.name}
              </h2>
            </header>
            <div className="flex w-full min-h-0 flex-col overflow-visible md:h-auto md:max-h-[min(calc(100dvh-13rem),46rem)] md:min-h-0 md:flex-row md:overflow-x-auto md:overflow-y-hidden">
              {QUEST_BOARD_COLUMNS.map((column) => (
                <Column
                  key={column}
                  column={column}
                  label={columnLabel(column)}
                  quests={lane.columns[column]}
                  locale={locale}
                  spaceSlug={spaceSlug}
                  spaceMembers={spaceMembers}
                  workflow={workflow}
                  domains={domains}
                  showDomain={false}
                  variant="swimlane"
                  testId={`quest-lane-${lane.domain.slug}-column-${column}`}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const columns = groupQuestsByColumn(quests);
  return (
    <div
      className="flex w-full flex-col overflow-visible pb-3 pt-0.5 md:flex-row md:items-start md:overflow-x-auto"
      data-testid="quest-board"
      data-layout="kanban"
    >
      {QUEST_BOARD_COLUMNS.map((column) => (
        <Column
          key={column}
          column={column}
          label={columnLabel(column)}
          quests={columns[column]}
          locale={locale}
          spaceSlug={spaceSlug}
          spaceMembers={spaceMembers}
          workflow={workflow}
          domains={domains}
          showDomain
          variant="kanban"
          testId={`quest-column-${column}`}
        />
      ))}
    </div>
  );
}
