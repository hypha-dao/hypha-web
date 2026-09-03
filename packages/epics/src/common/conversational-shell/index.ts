/**
 * Generic conversational shell — the reusable talk-first core for #2486.
 *
 * Import boundary (spec §5.3 / A6): nothing in this directory may import
 * `@hypha-platform/core` or `@hypha-platform/epics`. `@hypha-platform/ui`
 * primitives and `@hypha-platform/ui-utils` are allowed. Hypha wiring lives
 * in `apps/web/src/app/[lang]/assistant/` and `common/assistant-hypha/`.
 *
 * Milestone 1: the static interaction bar only. The registry, canvas reducer,
 * recap hook, canvas surface, next-actions strip and the shell composition
 * land in milestones 2+.
 */
export { InteractionBar, type InteractionBarProps } from './interaction-bar';
