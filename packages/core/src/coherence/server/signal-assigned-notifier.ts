/**
 * Registration slot for signal notification side effects. `packages/core` cannot depend on
 * `@hypha-platform/notifications` (which itself depends on `core`) without creating a package
 * cycle — `apps/web`'s `instrumentation.ts` wires the real implementation in at server startup.
 */
export type SignalLifecycleKind =
  | 'assigned'
  | 'deadline_changed'
  | 'mentioned'
  | 'deadline_reminder'
  | 'deadline_overdue';

export type SignalLifecycleNotifierInput = {
  kind: SignalLifecycleKind;
  spaceId: number;
  recipientPersonIds: number[];
  actorPersonId: number | null;
  signalSlug: string;
  signalTitle: string;
  dueAt?: Date | string | null;
  mentionExcerpt?: string;
};

export type SignalAssignedNotifierInput = {
  spaceId: number;
  assigneePersonIds: number[];
  actorPersonId: number | null;
  signalSlug: string;
  signalTitle: string;
  dueAt?: Date | string | null;
};

export type SignalLifecycleNotifier = (
  input: SignalLifecycleNotifierInput,
) => Promise<void>;

export type SignalAssignedNotifier = (
  input: SignalAssignedNotifierInput,
) => Promise<void>;

const LIFECYCLE_KEY = Symbol.for('hypha.core.signalLifecycleNotifier');
const ASSIGNED_KEY = Symbol.for('hypha.core.signalAssignedNotifier');

type GlobalWithNotifier = typeof globalThis & {
  [LIFECYCLE_KEY]?: SignalLifecycleNotifier;
  [ASSIGNED_KEY]?: SignalAssignedNotifier;
};

export function setSignalLifecycleNotifier(fn: SignalLifecycleNotifier) {
  (globalThis as GlobalWithNotifier)[LIFECYCLE_KEY] = fn;
}

export function getSignalLifecycleNotifier(): SignalLifecycleNotifier | null {
  return (globalThis as GlobalWithNotifier)[LIFECYCLE_KEY] ?? null;
}

export function setSignalAssignedNotifier(fn: SignalAssignedNotifier) {
  (globalThis as GlobalWithNotifier)[ASSIGNED_KEY] = fn;
}

export function getSignalAssignedNotifier(): SignalAssignedNotifier | null {
  return (globalThis as GlobalWithNotifier)[ASSIGNED_KEY] ?? null;
}
