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
}) {
  return (
    <section
      data-testid={testId}
      data-quest-column={column}
      className="flex min-h-0 w-[17rem] shrink-0 flex-col border border-border bg-background-2"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-1 font-medium uppercase tracking-[0.12em] text-foreground">
          {label}
        </h2>
        <span className="text-1 text-neutral-11">{quests.length}</span>
      </header>
      <div className="flex min-h-[8rem] flex-col gap-2 overflow-y-auto p-2 [&>*]:shrink-0">
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
    const lanes = groupQuestsByLane(quests, workflow);
    return (
      <div
        className="space-y-3"
        data-testid="quest-board"
        data-layout="swimlane"
      >
        {lanes.map((lane) => (
          <section
            key={lane.domain.slug}
            data-testid={`quest-lane-${lane.domain.slug}`}
            className="border border-border bg-background"
          >
            <header className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  questDomainDotClass(lane.domain.color),
                )}
                data-testid="quest-domain-dot"
                data-domain-color={lane.domain.color}
                aria-hidden
              />
              <h2 className="text-2 font-medium text-foreground">
                {lane.domain.name}
              </h2>
            </header>
            <div className="flex gap-3 overflow-x-auto p-3">
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
      className="flex gap-3 overflow-x-auto pb-2"
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
          testId={`quest-column-${column}`}
        />
      ))}
    </div>
  );
}
