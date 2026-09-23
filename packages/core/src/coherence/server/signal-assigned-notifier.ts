/**
 * Registration slot for the signal-assigned notification side effect (#2470). `packages/core`
 * cannot depend on `@hypha-platform/notifications` (which itself depends on `core`) without
 * creating a package cycle Turbo refuses to build — so instead of importing notifications here,
 * `core` exposes this slot and `apps/web`'s `instrumentation.ts` wires the real implementation in
 * at server startup (it already depends on both packages, and isn't part of either's graph).
 */
export type SignalAssignedNotifierInput = {
  spaceId: number;
  assigneePersonIds: number[];
  actorPersonId: number | null;
  signalSlug: string;
  signalTitle: string;
};

export type SignalAssignedNotifier = (
  input: SignalAssignedNotifierInput,
) => Promise<void>;

// Stored on `globalThis` rather than a module-scoped variable: `instrumentation-node.ts` sets
// this via the `@hypha-platform/core/server` barrel, while `actions.ts` reads it via a relative
// import — if the bundler ever emits these as separate module instances, a plain module-scoped
// variable would split into two independent slots, silently dropping every notification.
const NOTIFIER_KEY = Symbol.for('hypha.core.signalAssignedNotifier');

type GlobalWithNotifier = typeof globalThis & {
  [NOTIFIER_KEY]?: SignalAssignedNotifier;
};

export function setSignalAssignedNotifier(fn: SignalAssignedNotifier) {
  (globalThis as GlobalWithNotifier)[NOTIFIER_KEY] = fn;
}

export function getSignalAssignedNotifier(): SignalAssignedNotifier | null {
  return (globalThis as GlobalWithNotifier)[NOTIFIER_KEY] ?? null;
}
