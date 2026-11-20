import 'server-only';

import type { DbConfig } from '../../server';
import {
  readChainClock,
  readProposalCoreBatch,
  readProposalOutcomeIds,
  readSpaceGovernanceBatch,
} from '../../access/chain-reads';
import type { Caller } from '../../access/caller';
import { failure, type Failure } from '../../access/failure';
import { decideSpaceAccess } from '../../access/policy';
import {
  buildProposalTally,
  deriveProposalListStatus,
  type ProposalListStatus,
  type ProposalTally,
} from '../../access/proposal-status';
import { toPublicCreator } from '../../api-v2/public-profile';
import { findProposalDocumentsPage } from '../../governance/server/queries';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';

export type ListProposalsInput = {
  spaceSlug: string;
  /** Default `both`. Discussions and memory entries are never included. */
  state?: 'proposal' | 'agreement' | 'both';
  searchTerm?: string;
  /** Direction of `createdAt`, ties by id. Default `desc`. */
  direction?: 'asc' | 'desc';
  paging: { offset: number; limit: number };
  /** `tally` costs one chain read per page. */
  with?: { tally?: boolean };
};

export type ProposalListItem = {
  slug: string;
  title: string;
  /** The stored state of the document. */
  kind: 'proposal' | 'agreement';
  /**
   * User-defined text on the document (for example `Quest`). `null` when none. A Quest-labelled
   * document is a commitment going through the space's agreement process (K92).
   */
  label: string | null;
  /** `null` only when the document has no on-chain proposal id. */
  status: ProposalListStatus | null;
  /** Display fields only: never an address. */
  creator: {
    name?: string;
    surname?: string;
    type?: 'person' | 'space';
  } | null;
  createdAt: Date;
  /** Only with `with.tally`; `null` = this proposal's chain read failed. */
  tally?: ProposalTally | null;
};

export type ListProposalsData = {
  items: ProposalListItem[];
  /** All the proposals and agreements the caller may see in this space, before paging. */
  total: number;
  asOf: string;
  asOfBlock: number | null;
};

/**
 * Feature function "list proposals": the proposals and agreements of one space. The access
 * policy runs first on the light host lookup. A status that cannot be read for the page fails
 * the call (`chain_read_failed`) so that "status is absent only without an on-chain id" holds.
 * Whether a document is visible depends on the space's access level only: no rule per document
 * exists in the data model.
 */
export async function listProposals(
  input: ListProposalsInput,
  caller: Caller,
  { db }: DbConfig,
): Promise<{ ok: true; data: ListProposalsData } | Failure> {
  try {
    const host = await findSpaceHostFieldsBySlug(
      { slug: input.spaceSlug },
      { db },
    );
    if (!host) return failure('not_found', 'Space not found');

    const decision = await decideSpaceAccess(host, caller, { db });
    if (decision.outcome === 'none') {
      return decision.failure.code === 'access_check_failed'
        ? decision.failure
        : failure('not_found', 'Space not found');
    }

    const state = input.state ?? 'both';
    const page = await findProposalDocumentsPage(
      {
        spaceId: host.id,
        states: state === 'both' ? ['proposal', 'agreement'] : [state],
        searchTerm: input.searchTerm,
        direction: input.direction ?? 'desc',
        offset: input.paging.offset,
        limit: input.paging.limit,
      },
      { db },
    );

    const web3SpaceId =
      typeof host.web3SpaceId === 'number' ? host.web3SpaceId : null;
    let outcomes: Awaited<ReturnType<typeof readProposalOutcomeIds>> | null =
      null;
    if (web3SpaceId !== null && page.data.length > 0) {
      try {
        outcomes = await readProposalOutcomeIds(web3SpaceId);
      } catch (error) {
        console.error('[features] proposal outcome read failed', error);
        return failure(
          'chain_read_failed',
          'Proposal status could not be read from the chain.',
        );
      }
    }

    const proposalIds = page.data
      .map((doc) => doc.web3ProposalId)
      .filter((id): id is number => id != null)
      .map(Number);
    const wantsTally = input.with?.tally === true;
    // Tally reads are optional: a rejected read gives `null` for the affected proposals.
    const optional = <T>(read: Promise<T>): Promise<T | null> =>
      read.catch((error) => {
        console.error('[features] optional chain read failed', error);
        return null;
      });
    const [cores, governance, clock] = await Promise.all([
      wantsTally && proposalIds.length > 0
        ? optional(readProposalCoreBatch(proposalIds))
        : Promise.resolve(null),
      wantsTally && web3SpaceId !== null && proposalIds.length > 0
        ? optional(readSpaceGovernanceBatch([web3SpaceId]))
        : Promise.resolve(null),
      readChainClock(),
    ]);
    const space =
      web3SpaceId !== null ? governance?.get(web3SpaceId) : undefined;

    const items = page.data.map((doc): ProposalListItem => {
      const creator = doc.creator
        ? (toPublicCreator(doc.creator as Record<string, unknown>) as
            | ProposalListItem['creator']
            | undefined) ?? null
        : null;
      const item: ProposalListItem = {
        slug: doc.slug ?? '',
        title: doc.title,
        kind: doc.state === 'agreement' ? 'agreement' : 'proposal',
        label: doc.label ? doc.label : null,
        status: outcomes
          ? deriveProposalListStatus(doc.web3ProposalId, outcomes) ?? null
          : null,
        creator: creator
          ? {
              name: creator.name,
              surname: creator.surname,
              type: creator.type,
            }
          : null,
        createdAt: doc.createdAt,
      };
      if (wantsTally && doc.web3ProposalId != null) {
        const core = cores?.get(Number(doc.web3ProposalId));
        item.tally = core
          ? buildProposalTally(
              core,
              space
                ? { quorum: BigInt(space.quorum), unity: BigInt(space.unity) }
                : null,
              clock.nowSeconds,
            )
          : null;
      }
      return item;
    });

    return {
      ok: true,
      data: {
        items,
        total: page.total,
        asOf: clock.asOf,
        asOfBlock: clock.asOfBlock,
      },
    };
  } catch (error) {
    console.error('[features] list proposals failed', error);
    return failure(
      'access_check_failed',
      'Proposals could not be listed right now.',
    );
  }
}
