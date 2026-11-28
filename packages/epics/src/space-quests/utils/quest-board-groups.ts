import {
  DEFAULT_SIGNAL_WORKFLOW,
  QUEST_LIST_FILTERS,
  questListBucket,
  resolveEffectiveBoard,
  type QuestListFilter,
  type QuestRecord,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';

/** Lifecycle order for the board. Rejected is a derived bucket. */
export const QUEST_BOARD_COLUMNS = [
  'proposed',
  'active',
  'paused',
  'completed',
  'rejected',
] as const satisfies readonly QuestListFilter[];

export type QuestBoardColumn = (typeof QUEST_BOARD_COLUMNS)[number];

export type QuestDomainChoice = {
  slug: string;
  name: string;
  color: string;
};

export type QuestBoardColumns = Record<QuestBoardColumn, QuestRecord[]>;

export function questDomainDotClass(color: string | null | undefined): string {
  switch (color) {
    case 'accent':
      return 'bg-accent-9';
    case 'warn':
    case 'warning':
      return 'bg-warning-9';
    case 'success':
      return 'bg-success-9';
    case 'error':
      return 'bg-error-9';
    case 'sky':
      return 'bg-domain-sky';
    case 'teal':
      return 'bg-domain-teal';
    case 'indigo':
      return 'bg-domain-indigo';
    case 'purple':
      return 'bg-domain-purple';
    case 'pink':
      return 'bg-domain-pink';
    case 'orange':
      return 'bg-domain-orange';
    default:
      return 'bg-neutral-9';
  }
}

export function questDomainChoices(
  workflow: SignalWorkflowConfig | null | undefined,
): QuestDomainChoice[] {
  const boards = workflow?.boards?.length
    ? workflow.boards
    : DEFAULT_SIGNAL_WORKFLOW.boards;
  return boards
    .filter((board) => !board.archived)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((board) => ({
      slug: board.slug,
      name: board.name,
      color: board.color,
    }));
}

function emptyColumns(): QuestBoardColumns {
  return {
    proposed: [],
    active: [],
    paused: [],
    completed: [],
    rejected: [],
  };
}

/**
 * A proposed quest whose vote was not accepted belongs in Rejected.
 * The list stamp can miss that outcome; the chain's rejected set is the
 * same list the agreements board uses. A withdrawal is in that set too,
 * and stays Proposed.
 */
export function withChainRejectedProposals(
  quests: readonly QuestRecord[],
  rejectedIds: readonly (bigint | number)[] | null | undefined,
  withdrawnIds: readonly (bigint | number)[] | null | undefined,
): QuestRecord[] {
  if (!rejectedIds?.length) return [...quests];
  const rejected = new Set(rejectedIds.map((id) => Number(id)));
  const withdrawn = new Set((withdrawnIds ?? []).map((id) => Number(id)));
  return quests.map((quest) => {
    if (quest.status !== 'proposed' || quest.proposalStatus === 'rejected') {
      return quest;
    }
    const proposalId = quest.proposalWeb3Id;
    if (
      proposalId == null ||
      !rejected.has(Number(proposalId)) ||
      withdrawn.has(Number(proposalId))
    ) {
      return quest;
    }
    return { ...quest, proposalStatus: 'rejected' };
  });
}

function columnOf(quest: QuestRecord): QuestBoardColumn | null {
  const bucket = questListBucket(quest);
  return (QUEST_LIST_FILTERS as readonly string[]).includes(bucket) &&
    bucket !== 'archived'
    ? (bucket as QuestBoardColumn)
    : null;
}

export function groupQuestsByColumn(quests: QuestRecord[]): QuestBoardColumns {
  const columns = emptyColumns();
  for (const quest of quests) {
    const column = columnOf(quest);
    if (column) columns[column].push(quest);
  }
  return columns;
}

export function groupQuestsByLane(
  quests: QuestRecord[],
  workflow: SignalWorkflowConfig | null | undefined,
): Array<{ domain: QuestDomainChoice; columns: QuestBoardColumns }> {
  const config = workflow?.boards?.length ? workflow : DEFAULT_SIGNAL_WORKFLOW;
  const lanes = new Map<
    string,
    { domain: QuestDomainChoice; columns: QuestBoardColumns }
  >();
  for (const domain of questDomainChoices(config)) {
    lanes.set(domain.slug, { domain, columns: emptyColumns() });
  }
  for (const quest of quests) {
    const column = columnOf(quest);
    if (!column) continue;
    const slug = resolveEffectiveBoard(quest.domain, config);
    const lane = lanes.get(slug);
    if (lane) lane.columns[column].push(quest);
  }
  return [...lanes.values()];
}
