import {
  resolveEffectiveBoard,
  type SignalBoardDefinition,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';

/** Boards a signal can be placed on: not archived, in position order. */
export function activeSignalBoards(
  workflow: SignalWorkflowConfig | null | undefined,
): SignalBoardDefinition[] {
  if (!workflow) return [];
  return workflow.boards
    .filter((board) => !board.archived)
    .sort((a, b) => a.position - b.position);
}

/**
 * Whether the board is worth showing. A space with one board (the default
 * `General`) has nothing to choose or tell apart, so the picker and the label
 * stay out of the way until a space adds a second board.
 */
export function hasSignalBoardChoice(
  workflow: SignalWorkflowConfig | null | undefined,
): boolean {
  return activeSignalBoards(workflow).length > 1;
}

/**
 * Display name of the board a signal sits on, or null when the space has a
 * single board or the workflow is not loaded. An unset or unknown slug reads
 * as the space default board, the same as the swimlanes.
 */
export function signalBoardLabel(
  board: string | null | undefined,
  workflow: SignalWorkflowConfig | null | undefined,
): string | null {
  if (!workflow || !hasSignalBoardChoice(workflow)) return null;
  const slug = resolveEffectiveBoard(board, workflow);
  const match = workflow.boards.find((item) => item.slug === slug);
  return match?.name?.trim() || null;
}
