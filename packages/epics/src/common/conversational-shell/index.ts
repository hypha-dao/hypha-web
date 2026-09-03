/**
 * Generic conversational shell — the reusable talk-first core for #2486.
 *
 * Import boundary (spec §5.3 / A6): nothing in this directory may import
 * `@hypha-platform/core` or `@hypha-platform/epics`. `@hypha-platform/ui`
 * primitives and `@hypha-platform/ui-utils` are allowed; `use-canvas` /
 * `use-recap` stay on structural message types (no AI-SDK coupling). Hypha
 * wiring lives in `apps/web/src/app/[lang]/assistant/` and
 * `common/assistant-hypha/`.
 *
 * Milestones 1–2: interaction bar + the generic core (types, registry, canvas
 * reducer, recap, canvas surface, next-actions strip). The shell composition
 * (`assistant-shell.tsx` + `useChat`) lands in milestone 4.
 */
export * from './types';
export { InteractionBar, type InteractionBarProps } from './interaction-bar';
export { createWidgetRegistry } from './widget-registry';
export { validateParams, type ParamsValidation } from './validate-params';
export {
  useCanvas,
  reduceCanvas,
  selectCanvasState,
  extractCanvasIntents,
  extractNextActions,
  EMPTY_CANVAS_STATE,
  type UseCanvasResult,
} from './use-canvas';
export {
  useRecap,
  buildRecap,
  summarizeTurn,
  DEFAULT_RECAP_CAP,
} from './use-recap';
export { CanvasSurface, type CanvasSurfaceProps } from './canvas-surface';
export {
  NextActionsStrip,
  type NextActionsStripProps,
} from './next-actions-strip';
