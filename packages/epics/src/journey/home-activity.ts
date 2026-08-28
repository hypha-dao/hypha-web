import type { Document } from '@hypha-platform/core/client';

export const HOME_ACTIVITY_SPACE_LIMIT = 16;
export const HOME_ACTIVITY_ITEM_LIMIT = 5;
export const ATTENTION_MAX_PER_SPACE = 2;
export const ATTENTION_RECENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export type HomeSpaceRef = {
  slug: string;
  title: string;
  logoUrl?: string | null;
  web3SpaceId?: number | null;
};

export type HomeVoteItem = {
  id: string;
  title: string;
  spaceSlug: string;
  spaceTitle: string;
  spaceLogoUrl?: string | null;
  proposalSlug: string;
  happenedAt: number;
};

export type HomeSignalItem = {
  id: string;
  title: string;
  spaceSlug: string;
  spaceTitle: string;
  spaceLogoUrl?: string | null;
  signalSlug: string | null;
  roomId?: string | null;
  happenedAt: number;
};

export type HomeAttentionItem =
  | (HomeVoteItem & { kind: 'vote' })
  | (HomeSignalItem & { kind: 'signal' });

export type ProposalOutcomeLookup = {
  accepted: ReadonlySet<string>;
  rejected: ReadonlySet<string>;
  withdrawn: ReadonlySet<string>;
};

export type ProposalLiveness = {
  endTime?: Date | number | string | null;
  executed?: boolean;
  expired?: boolean;
};

export type VoteActivityOptions = {
  now?: Date;
  outcomes?: ProposalOutcomeLookup | null;
  liveness?: ProposalLiveness | null;
};

const CLOSED_DOCUMENT_STATES = new Set(['discussion', 'agreement', 'memory']);
const CLOSED_DOCUMENT_STATUSES = new Set(['accepted', 'rejected']);
const INACTIVE_SIGNAL_PROGRESS = new Set([
  'done',
  'cancelled',
  'canceled',
  'complete',
  'completed',
  'closed',
  'archived',
]);

export function proposalIdKey(
  id: bigint | number | string | null | undefined,
): string | null {
  if (id == null || id === '') return null;
  return String(id);
}

export function toProposalIdSet(
  ids: ReadonlyArray<bigint | number | string> | null | undefined,
): Set<string> {
  return new Set(
    (ids ?? []).map((id) => String(id)).filter((id) => id.length > 0),
  );
}

/**
 * Active vote recommendations only — same closed outcomes as the space
 * agreements list (`accepted` / `rejected` / withdrawn), plus liveness:
 * voting window still open, not executed, not expired.
 *
 * Bare `state === 'proposal'` is not enough. `/documents/all` does not
 * attach on-chain `status`, so closed proposals often remain `proposal`
 * in the DB after the vote ends.
 */
export function isActiveVoteRecommendation(
  document: {
    state?: string;
    status?: string | null;
    web3ProposalId?: number | null;
  },
  options: VoteActivityOptions = {},
): boolean {
  if (document.state && CLOSED_DOCUMENT_STATES.has(document.state)) {
    return false;
  }
  if (document.status && CLOSED_DOCUMENT_STATUSES.has(document.status)) {
    return false;
  }

  const proposalKey = proposalIdKey(document.web3ProposalId);
  const { outcomes, liveness, now = new Date() } = options;

  if (proposalKey && outcomes) {
    if (outcomes.withdrawn.has(proposalKey)) return false;
    if (outcomes.accepted.has(proposalKey)) return false;
    if (outcomes.rejected.has(proposalKey)) return false;
  }

  if (liveness) {
    if (liveness.executed || liveness.expired) return false;
    if (liveness.endTime != null) {
      const end = new Date(liveness.endTime);
      if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) {
        return false;
      }
    }
  }

  if (document.status === 'onVoting') {
    return true;
  }

  // Without an explicit onVoting status, only trust proposals we could
  // confirm are still open on-chain. Never recommend a bare DB proposal.
  if (
    document.state === 'proposal' &&
    proposalKey &&
    outcomes &&
    liveness &&
    !liveness.executed &&
    !liveness.expired
  ) {
    return true;
  }

  return false;
}

/** @deprecated Use isActiveVoteRecommendation — kept for existing imports. */
export const isOpenForVote = isActiveVoteRecommendation;

export function isActiveSignalRecommendation(signal: {
  archived?: boolean | null;
  progressStatus?: string | null;
}): boolean {
  if (signal.archived) return false;
  const status = signal.progressStatus?.trim().toLowerCase();
  if (!status) return true;
  if (INACTIVE_SIGNAL_PROGRESS.has(status)) return false;
  return true;
}

export function votesFromDocuments(
  documents: Document[],
  space: HomeSpaceRef,
  options: Omit<VoteActivityOptions, 'liveness'> & {
    livenessByProposalId?: Map<number, ProposalLiveness>;
  } = {},
): HomeVoteItem[] {
  const { livenessByProposalId, ...rest } = options;
  return documents.flatMap((document) => {
    const proposalId = document.web3ProposalId ?? undefined;
    const liveness =
      proposalId != null ? livenessByProposalId?.get(proposalId) : undefined;
    if (
      !isActiveVoteRecommendation(document, {
        ...rest,
        liveness: liveness ?? null,
      })
    ) {
      return [];
    }
    if (!document.slug) return [];
    return [
      {
        id: `${space.slug}:${document.id}`,
        title: document.title,
        spaceSlug: space.slug,
        spaceTitle: space.title,
        spaceLogoUrl: space.logoUrl ?? null,
        proposalSlug: document.slug,
        happenedAt: activityTimestamp(document.updatedAt, document.createdAt),
      },
    ];
  });
}

export function activityTimestamp(
  ...values: Array<Date | string | number | null | undefined>
): number {
  let newest = 0;
  for (const value of values) {
    if (value == null) continue;
    const time =
      value instanceof Date
        ? value.getTime()
        : typeof value === 'number'
        ? value
        : new Date(value).getTime();
    if (!Number.isNaN(time) && time > newest) newest = time;
  }
  return newest;
}

export function sortVotes(items: HomeVoteItem[]): HomeVoteItem[] {
  return [...items].sort((a, b) => b.happenedAt - a.happenedAt);
}

export function selectAttentionItems<
  T extends {
    id: string;
    happenedAt: number;
    spaceSlug?: string;
    kind?: 'vote' | 'signal';
  },
>(
  items: T[],
  {
    now = new Date(),
    limit = HOME_ACTIVITY_ITEM_LIMIT,
    recentWindowMs = ATTENTION_RECENT_WINDOW_MS,
    maxPerSpace = ATTENTION_MAX_PER_SPACE,
  }: {
    now?: Date;
    limit?: number;
    recentWindowMs?: number;
    maxPerSpace?: number;
  } = {},
): T[] {
  const kindRank = (kind?: 'vote' | 'signal') => (kind === 'vote' ? 0 : 1);
  const sorted = [...items].sort((a, b) => {
    const byKind = kindRank(a.kind) - kindRank(b.kind);
    if (byKind !== 0) return byKind;
    if (b.happenedAt !== a.happenedAt) return b.happenedAt - a.happenedAt;
    return a.id.localeCompare(b.id);
  });
  const nowMs = now.getTime();
  const dated = sorted.filter((item) => item.happenedAt > 0);
  const recent = dated.filter(
    (item) => nowMs - item.happenedAt <= recentWindowMs,
  );
  const pool = (recent.length > 0 ? recent : dated).length
    ? recent.length > 0
      ? recent
      : dated
    : sorted;

  const picked: T[] = [];
  const seen = new Set<string>();
  const perSpace = new Map<string, number>();

  const take = (allowOverCap: boolean) => {
    for (const item of pool) {
      if (picked.length >= limit) break;
      const key = `${item.kind ?? 'item'}:${item.id}`;
      if (seen.has(key)) continue;
      const slug = item.spaceSlug ?? '';
      const count = perSpace.get(slug) ?? 0;
      if (!allowOverCap && slug && count >= maxPerSpace) continue;
      seen.add(key);
      picked.push(item);
      perSpace.set(slug, count + 1);
    }
  };

  take(false);
  if (picked.length < limit) take(true);
  return picked;
}

export function attentionSeeAllHref(
  lang: string,
  items: Array<{ kind: 'vote' | 'signal'; spaceSlug: string }>,
  fallbackSpaces: Array<{ slug?: string | null }>,
): string {
  const slugs = [
    ...new Set(items.map((item) => item.spaceSlug).filter(Boolean)),
  ];
  if (slugs.length === 1) {
    const onlySignals =
      items.length > 0 && items.every((item) => item.kind === 'signal');
    return onlySignals
      ? `/${lang}/dho/${slugs[0]}/coherence`
      : `/${lang}/dho/${slugs[0]}/agreements`;
  }
  const fallback = fallbackSpaces.find((space) => space.slug?.trim());
  if (fallback?.slug && fallbackSpaces.length === 1) {
    return `/${lang}/dho/${fallback.slug}/agreements`;
  }
  return `/${lang}/my-spaces`;
}
