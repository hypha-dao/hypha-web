import { fetchJson } from '../../../common/fetch-json';

export type ProposalVoter = {
  id?: number;
  name: string;
  avatarUrl: string;
  vote: 'yes' | 'no';
  address: `0x${string}`;
};

/** Slugs asked for in one request; matches the route's cap. */
export const MAX_BATCH_SLUGS = 25;
/** Requests made within this window share one fetch. */
export const BATCH_WINDOW_MS = 25;

type Entry = {
  promise: Promise<ProposalVoter[]>;
  resolve: (voters: ProposalVoter[]) => void;
  reject: (error: unknown) => void;
};

type BatchResponse = {
  voters: Record<string, ProposalVoter[]>;
  failed?: string[];
};

let pending = new Map<string, Entry>();
let timer: ReturnType<typeof setTimeout> | undefined;

const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

async function sendChunk(chunk: [string, Entry][]) {
  const query = chunk.map(([slug]) => encodeURIComponent(slug)).join(',');
  try {
    const { voters, failed = [] } = await fetchJson<BatchResponse>(
      `/api/v1/proposal-voters?slugs=${query}`,
      undefined,
      'proposal voters',
    );
    for (const [slug, entry] of chunk) {
      if (failed.includes(slug)) {
        entry.reject(httpError(502, 'Failed to fetch proposal voters'));
      } else if (Object.hasOwn(voters, slug) && Array.isArray(voters[slug])) {
        // Own entries only: `constructor` must not resolve to an inherited function.
        entry.resolve(voters[slug]);
      } else {
        // Same shape as the single-proposal route's 404, so callers see no change.
        entry.reject(
          httpError(404, 'Failed to fetch proposal voters: Not Found'),
        );
      }
    }
  } catch (error) {
    for (const [, entry] of chunk) entry.reject(error);
  }
}

function flush() {
  timer = undefined;
  const entries = [...pending];
  pending = new Map();
  for (let i = 0; i < entries.length; i += MAX_BATCH_SLUGS) {
    void sendChunk(entries.slice(i, i + MAX_BATCH_SLUGS));
  }
}

/**
 * Voters of one proposal, fetched together with every other proposal asked for
 * in the same short window (one request instead of one per proposal). A slug
 * the server does not return rejects with a 404 and a failed chain read with a
 * 502, each only for that slug; a failed request rejects every slug in it.
 */
export function fetchProposalVoters(slug: string): Promise<ProposalVoter[]> {
  let entry = pending.get(slug);
  if (!entry) {
    let resolve!: Entry['resolve'];
    let reject!: Entry['reject'];
    const promise = new Promise<ProposalVoter[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    entry = { promise, resolve, reject };
    pending.set(slug, entry);
  }
  timer ??= setTimeout(flush, BATCH_WINDOW_MS);
  return entry.promise;
}
