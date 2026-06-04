/**
 * In-call dock stage layouts for phone-width viewports only.
 * Tablet/desktop keep container-query grid in {@link HumanChatPanelCallStage}.
 */

/** At this count, phone panel uses paginated gallery instead of a fixed-row grid. */
export const CALL_PANEL_MOBILE_PAGINATED_MIN = 7;

export type CallPanelMobileGridLayout = {
  /** Grid wrapper classes (must include flex-1 + h-full to fill the stage). */
  gridClass: string;
  /** Per-tile wrapper — tiles share row height via grid, not fixed 40vh mins. */
  cellClass: string;
};

/** Phone panel: balanced grids that fill vertical space (no top-hugging void). */
export function getCallPanelMobileGridLayout(
  tileCount: number,
): CallPanelMobileGridLayout | null {
  const cellClass =
    'flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden';

  if (tileCount <= 1) {
    return {
      gridClass:
        'grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-1 grid-rows-1 gap-1.5',
      cellClass,
    };
  }
  if (tileCount === 2) {
    return {
      gridClass:
        'grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-1 grid-rows-2 gap-1.5 [grid-template-rows:minmax(0,1fr)_minmax(0,1fr)]',
      cellClass,
    };
  }
  if (tileCount === 3) {
    return {
      gridClass:
        'grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-1 grid-rows-3 gap-1.5 [grid-template-rows:repeat(3,minmax(0,1fr))]',
      cellClass,
    };
  }
  if (tileCount === 4) {
    return {
      gridClass:
        'grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5 [grid-template-rows:repeat(2,minmax(0,1fr))]',
      cellClass,
    };
  }
  if (tileCount <= 6) {
    return {
      gridClass:
        'grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-2 grid-rows-3 gap-1.5 [grid-template-rows:repeat(3,minmax(0,1fr))]',
      cellClass,
    };
  }
  return null;
}
