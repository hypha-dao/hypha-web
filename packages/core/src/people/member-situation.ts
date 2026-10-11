import type { MemberHomeThreadItem } from './member-home-thread';
import type { MemberMovement, MemberMovementKind } from './member-intelligence';

/** How many things the home puts in front of one person. */
export const HOME_FOCUS_LIMIT = 8;

const NEW_SIGNAL_MS = 14 * 24 * 60 * 60 * 1000;

const CLOSED = new Set(['done', 'cancelled', 'complete', 'completed']);

type FocusBucket =
  | 'overdue'
  | 'urgent'
  | 'vote'
  | 'fresh'
  | 'discussion'
  | 'other'
  | 'network';

const BUCKET_ORDER: FocusBucket[] = [
  'overdue',
  'urgent',
  'vote',
  'fresh',
  'discussion',
  'other',
  'network',
];

const BUCKET_CAP: Record<FocusBucket, number> = {
  overdue: 2,
  urgent: 2,
  vote: 2,
  fresh: 2,
  discussion: 1,
  other: 2,
  network: 2,
};

export type FocusSignal = {
  slug: string | null;
  priority: string | null;
  assignedToMember: boolean;
  dueAt?: string | null;
  createdAt?: string | null;
  progressStatus?: string | null;
};

export type HomeThreadFocus = {
  signals: readonly FocusSignal[];
  networkSignals?: readonly { slug: string | null }[];
};

function closed(status: string | null | undefined): boolean {
  return CLOSED.has((status ?? '').trim().toLowerCase());
}

function urgent(priority: string | null | undefined): boolean {
  const value = (priority ?? '').trim().toLowerCase();
  return value === 'critical' || value === 'high';
}

/**
 * Spaces first, then the network if a slot is left. Overdue work they were
 * asked to hold, then high and critical signals, then votes, then what just
 * arrived. One kind cannot fill the home.
 */
export function balanceMemberHomeThread<T extends MemberHomeThreadItem>(
  items: readonly T[],
  home: HomeThreadFocus,
  now = new Date(),
): T[] {
  const signals = new Map(
    home.signals.flatMap((signal) =>
      signal.slug ? [[signal.slug, signal] as const] : [],
    ),
  );
  const network = new Set(
    (home.networkSignals ?? []).flatMap((signal) =>
      signal.slug ? [signal.slug] : [],
    ),
  );
  const groups = new Map<FocusBucket, T[]>();
  for (const item of items) {
    const bucket = bucketFor(item, signals.get(item.slug), network, now);
    if (!bucket) continue;
    const list = groups.get(bucket) ?? [];
    list.push(item);
    groups.set(bucket, list);
  }

  const picked: T[] = [];
  const counts = new Map<FocusBucket, number>();
  for (const bucket of BUCKET_ORDER) {
    for (const item of groups.get(bucket) ?? []) {
      if (picked.length >= HOME_FOCUS_LIMIT) return picked;
      const used = counts.get(bucket) ?? 0;
      if (used >= BUCKET_CAP[bucket]) continue;
      counts.set(bucket, used + 1);
      picked.push(item);
    }
  }
  return picked;
}

function bucketFor(
  item: MemberHomeThreadItem,
  signal: FocusSignal | undefined,
  network: ReadonlySet<string>,
  now: Date,
): FocusBucket | null {
  if (item.kind === 'signal' && network.has(item.slug)) return 'network';
  if (item.kind === 'signal') {
    if (closed(signal?.progressStatus)) return null;
    const due = signal?.dueAt ? Date.parse(signal.dueAt) : NaN;
    if (
      signal?.assignedToMember &&
      Number.isFinite(due) &&
      due < now.getTime()
    ) {
      return 'overdue';
    }
    if (urgent(signal?.priority)) return 'urgent';
    const created = signal?.createdAt ? Date.parse(signal.createdAt) : NaN;
    if (Number.isFinite(created) && now.getTime() - created <= NEW_SIGNAL_MS) {
      return 'fresh';
    }
    if (signal?.assignedToMember || !signal) return 'other';
    return null;
  }
  if (item.documentKind === 'discussion') return 'discussion';
  if (item.action === 'decision' || item.kind === 'proposal') return 'vote';
  return 'other';
}

const MOVEMENT_CAP: Record<MemberMovementKind, number> = {
  joined: 1,
  treasury: 1,
  voice: 1,
  agreed: 1,
};

/** One of each kind, newest first. A join, a payment, and a vote do not stack. */
export function selectMemberMovement(
  items: readonly MemberMovement[],
): MemberMovement[] {
  const sorted = [...items].sort((left, right) =>
    left.at === right.at
      ? left.id.localeCompare(right.id)
      : left.at < right.at
      ? 1
      : -1,
  );
  const counts = new Map<MemberMovementKind, number>();
  const picked: MemberMovement[] = [];
  for (const item of sorted) {
    const used = counts.get(item.kind) ?? 0;
    if (used >= MOVEMENT_CAP[item.kind]) continue;
    counts.set(item.kind, used + 1);
    picked.push(item);
  }
  return picked;
}

/** What a finished agreement changed, from its label and whether it mints voice. */
export function movementKindForAgreement(input: {
  label: string | null;
  voting: boolean;
  tokenType: string | null;
}): MemberMovementKind {
  const token = (input.tokenType ?? '').trim().toLowerCase();
  if (input.voting || token === 'voice') return 'voice';
  const label = (input.label ?? '').trim().toLowerCase();
  if (
    label.includes('deploy') ||
    label.includes('pay') ||
    label.includes('expense') ||
    label.includes('transfer') ||
    label.includes('treasury') ||
    label.includes('investment') ||
    label.includes('token purchase')
  ) {
    return 'treasury';
  }
  if (label.includes('invite') || label.includes('join')) return 'joined';
  return 'agreed';
}
