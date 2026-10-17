import 'server-only';

import { eq } from 'drizzle-orm';
import { documents } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../server';
import type { Order } from '../../common/types';
import type { Document } from '../../governance/types';
import { findAllDocumentsBySpaceSlug } from '../../governance/server/queries';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';
import { getMemberVotingPower } from '../../coherence/server/web3/get-member-voting-power';
import { DOCUMENT_INCLUDE_BLOCKS, parseInclude } from '../include';
import { toPublicCreator } from '../public-profile';
import {
  buildProposalTally,
  decideCanVote,
  deriveProposalListStatus,
  type CanVoteReason,
  type ProposalListStatus,
  type ProposalTally,
} from '../proposal-status';
import { authorizeSpaceRead, type V2Caller, type V2Failure } from './access';
import {
  readChainClock,
  readIsProposalWithdrawn,
  readMemberAndDelegate,
  readProposalCoreBatch,
  readProposalOutcomeIds,
  readProposalVoters,
  readSpaceGovernanceBatch,
} from './chain-reads';

type Failure =
  | V2Failure
  | { ok: false; status: 400 | 404 | 502; error: string; message?: string };

export type DocumentsListQuery = {
  spaceSlug: string;
  page?: number;
  pageSize?: number;
  state?: string | null;
  searchTerm?: string;
  order?: Order<Document>;
  include?: string | null;
};

export const DOCUMENTS_V2_DEFAULT_PAGE_SIZE = 20;
export const DOCUMENTS_V2_MAX_PAGE_SIZE = 100;

type DocumentRow = Awaited<
  ReturnType<typeof findAllDocumentsBySpaceSlug>
>['data'][number];

export type DocumentV2 = Omit<DocumentRow, 'status'> & {
  /** Absent only when the document has no `web3ProposalId`. */
  status?: ProposalListStatus;
  /** Only with `include=tally`; `null` = this proposal's chain read failed. */
  tally?: ProposalTally | null;
};

export type DocumentsListV2 = {
  data: DocumentV2[];
  pagination: Awaited<
    ReturnType<typeof findAllDocumentsBySpaceSlug>
  >['pagination'];
  asOf: string;
  asOfBlock: number | null;
};

export async function buildDocumentsListV2(
  query: DocumentsListQuery,
  caller: V2Caller,
  { db }: DbConfig,
): Promise<{ ok: true; body: DocumentsListV2 } | Failure> {
  const include = parseInclude(query.include, DOCUMENT_INCLUDE_BLOCKS);
  if (!include.ok) {
    return {
      ok: false,
      status: 400,
      error: 'Unknown include block',
      message: `Unknown include: ${include.unknown.join(
        ', ',
      )}. Allowed: ${include.allowed.join(', ')}.`,
    };
  }

  const host = await findSpaceHostFieldsBySlug(
    { slug: query.spaceSlug },
    { db },
  );
  if (!host) return { ok: false, status: 404, error: 'Space not found' };

  const gate = await authorizeSpaceRead(host, caller, { db });
  if (!gate.ok) return gate;

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(
    DOCUMENTS_V2_MAX_PAGE_SIZE,
    Math.max(1, query.pageSize ?? DOCUMENTS_V2_DEFAULT_PAGE_SIZE),
  );

  // Same core query, same filter/search/order semantics as the v1 route.
  const listed = await findAllDocumentsBySpaceSlug(
    { spaceSlug: query.spaceSlug },
    {
      db,
      searchTerm: query.searchTerm,
      filter: query.state ? { state: query.state } : {},
      pagination: { page, pageSize, order: query.order ?? [] },
    } as Parameters<typeof findAllDocumentsBySpaceSlug>[1],
  );

  const web3SpaceId =
    typeof host.web3SpaceId === 'number' ? host.web3SpaceId : null;

  let outcomes = null as Awaited<
    ReturnType<typeof readProposalOutcomeIds>
  > | null;
  if (web3SpaceId !== null) {
    try {
      outcomes = await readProposalOutcomeIds(web3SpaceId);
    } catch (error) {
      // Keeps the "status absent only without a web3ProposalId" invariant.
      console.error('[api-v2] proposal outcome read failed', error);
      return {
        ok: false,
        status: 502,
        error: 'Chain read failed',
        message: 'Proposal status could not be read from the chain.',
      };
    }
  }

  const proposalIds = listed.data
    .map((doc) => doc.web3ProposalId)
    .filter((id): id is number => id != null)
    .map(Number);

  const wantsTally = include.blocks.has('tally');
  const [cores, governance, clock] = await Promise.all([
    wantsTally ? readProposalCoreBatch(proposalIds) : Promise.resolve(null),
    wantsTally && web3SpaceId !== null && proposalIds.length > 0
      ? readSpaceGovernanceBatch([web3SpaceId])
      : Promise.resolve(null),
    readChainClock(),
  ]);
  const space = web3SpaceId !== null ? governance?.get(web3SpaceId) : undefined;

  const data = listed.data.map((doc): DocumentV2 => {
    // `creator` is rebuilt from the public allowlist: v1's `creator.address`
    // (wallet) is an intentional omission.
    const out: DocumentV2 = { ...doc };
    if (doc.creator) {
      out.creator = toPublicCreator(
        doc.creator as Record<string, unknown>,
      ) as DocumentRow['creator'];
    }
    if (outcomes) {
      const status = deriveProposalListStatus(doc.web3ProposalId, outcomes);
      if (status) out.status = status;
    }
    if (wantsTally && doc.web3ProposalId != null) {
      const core = cores?.get(Number(doc.web3ProposalId));
      out.tally = core
        ? buildProposalTally(
            core,
            space
              ? { quorum: BigInt(space.quorum), unity: BigInt(space.unity) }
              : null,
            clock.nowSeconds,
          )
        : null;
    }
    return out;
  });

  return {
    ok: true,
    body: {
      data,
      pagination: listed.pagination,
      asOf: clock.asOf,
      asOfBlock: clock.asOfBlock,
    },
  };
}

export type MyVoteV2 = {
  hasVoted: boolean;
  vote: 'yes' | 'no' | null;
  isMember: boolean;
  isDelegate: boolean;
  /** Current `getVotingPower` view as a decimal string (token decimals in `votingPowerDecimals`). */
  votingPower: string;
  votingPowerDecimals: number;
  /** 1 token, 2 member, 3 voice. */
  votingPowerSource: number;
  /** Necessary conditions only; see `decideCanVote`. */
  canVote: boolean;
  reason: CanVoteReason;
  asOf: string;
  asOfBlock: number | null;
};

export async function buildMyVoteV2(
  {
    spaceSlug,
    documentSlug,
    caller,
  }: { spaceSlug: string; documentSlug: string; caller: V2Caller },
  { db }: DbConfig,
): Promise<{ ok: true; body: MyVoteV2 } | Failure> {
  if (caller.kind !== 'user') {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required',
      message: 'This route needs a verified user token.',
    };
  }
  if (!caller.address) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid authentication',
      message: 'Could not verify your identity.',
    };
  }
  const address = caller.address;

  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) return { ok: false, status: 404, error: 'Space not found' };

  const gate = await authorizeSpaceRead(host, caller, { db });
  if (!gate.ok) return gate;

  // The document must belong to the space in the path.
  const [row] = await db
    .select({
      spaceId: documents.spaceId,
      web3ProposalId: documents.web3ProposalId,
    })
    .from(documents)
    .where(eq(documents.slug, documentSlug))
    .limit(1);
  if (
    !row ||
    row.spaceId !== host.id ||
    row.web3ProposalId == null ||
    typeof host.web3SpaceId !== 'number'
  ) {
    return { ok: false, status: 404, error: 'Document not found' };
  }
  const proposalId = Number(row.web3ProposalId);
  const web3SpaceId = host.web3SpaceId;

  try {
    const [cores, withdrawn, voters, membership, power, clock] =
      await Promise.all([
        readProposalCoreBatch([proposalId]),
        readIsProposalWithdrawn(proposalId),
        readProposalVoters(proposalId),
        readMemberAndDelegate(web3SpaceId, address),
        getMemberVotingPower({ memberAddress: address, web3SpaceId }),
        readChainClock(),
      ]);
    const core = cores.get(proposalId);
    if (!core) throw new Error('proposal core read failed');

    const lower = address.toLowerCase();
    const yes = voters.yesVoters.some((v) => v.toLowerCase() === lower);
    const no = voters.noVoters.some((v) => v.toLowerCase() === lower);
    const verdict = decideCanVote({
      withdrawn,
      executed: core.executed,
      expired: core.expired,
      startTime: Number(core.startTime),
      endTime: Number(core.endTime),
      nowSeconds: clock.nowSeconds,
      isMember: membership.isMember,
      isDelegate: membership.isDelegate,
      votingPower: power.votingPower,
    });

    return {
      ok: true,
      body: {
        hasVoted: yes || no,
        vote: yes ? 'yes' : no ? 'no' : null,
        isMember: membership.isMember,
        isDelegate: membership.isDelegate,
        votingPower: power.votingPower.toString(),
        votingPowerDecimals: power.tokenDecimals,
        votingPowerSource: power.votingPowerSource,
        canVote: verdict.canVote,
        reason: verdict.reason,
        asOf: clock.asOf,
        asOfBlock: clock.asOfBlock,
      },
    };
  } catch (error) {
    console.error('[api-v2] voting/me chain read failed', error);
    return {
      ok: false,
      status: 502,
      error: 'Chain read failed',
      message: 'Vote state could not be read from the chain.',
    };
  }
}
