/**
 * CSS insets for viewport-fixed chrome (DHO sticky space banner, MenuTop
 * underline). They must match the real flex gap reserved beside the main
 * column — not the expanded sheet width.
 *
 * On mobile the AI / chat sidebars are Sheets: there is no gap node, and the
 * main column is full width. Falling back to the desktop icon-rail width
 * (72px) insets the sticky banner over the content and looks like a floating
 * card. Measured gap width 0 (icon rail collapsed below xl) is the same.
 */

export type ResolveSidebarInsetPxInput = {
  isOnboarding: boolean;
  isMobileViewport: boolean;
  sideActive: boolean;
  /** Width from `[data-sidebar-gap]` when present. */
  measuredPx: number;
  /** True when at least one gap node exists for this layout. */
  hasGapNodes: boolean;
  /** Desktop SSR / pre-measure fallback (icon rail or expanded width). */
  fallbackPx: string;
};

export function resolveSidebarInsetPx(
  input: ResolveSidebarInsetPxInput,
): string {
  if (input.isOnboarding || input.isMobileViewport || !input.sideActive) {
    return '0px';
  }
  if (Number.isFinite(input.measuredPx) && input.measuredPx > 0) {
    return `${Math.round(input.measuredPx)}px`;
  }
  // Gap exists but collapsed (e.g. icon rail `max-xl:!w-0`). Do not use the
  // desktop icon fallback — that would inset fixed chrome over full-width content.
  if (input.hasGapNodes) {
    return '0px';
  }
  return input.fallbackPx;
}
