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

let notifier: SignalAssignedNotifier | null = null;

export function setSignalAssignedNotifier(fn: SignalAssignedNotifier) {
  notifier = fn;
}

export function getSignalAssignedNotifier(): SignalAssignedNotifier | null {
  return notifier;
}
