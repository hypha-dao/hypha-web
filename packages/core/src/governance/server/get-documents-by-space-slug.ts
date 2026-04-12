import 'server-only';

import { DirectionType } from '../../common/types';
import type { Document } from '../types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import type { DbConfig } from '../../server';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';
import { findAllDocumentsBySpaceSlug } from './queries';
import {
  attachProposalStatusToDocument,
  fetchProposalOutcomeSetsForSpace,
} from './resolve-document-proposal-status';

export type DocumentWithCreatorJson = Omit<
  Document & { creator?: Document['creator']; status?: Document['status'] },
  'createdAt' | 'updatedAt'
> & {
  createdAt: string;
  updatedAt: string;
};

export type GetDocumentsBySpaceSlugSuccess = {
  found: true;
  space_slug: string;
  space: {
    id: number;
    slug: string;
    title: string;
    parent_id: number | null;
  };
  source: 'db';
  /** Present when `web3SpaceId` is set: `rpc` if proposal outcome lists were read; `null` if read failed. */
  source_chain: 'rpc' | null;
  asOf: string;
  documents: DocumentWithCreatorJson[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
};

export type GetDocumentsBySpaceSlugNotFound = {
  found: false;
  space_slug: string;
  space: null;
  source: 'db';
  source_chain: null;
  asOf: string;
  documents: [];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
};

export type GetDocumentsBySpaceSlugResult =
  | GetDocumentsBySpaceSlugSuccess
  | GetDocumentsBySpaceSlugNotFound;

export type GetDocumentsBySpaceSlugInput = {
  spaceSlug: string;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  /** When set, filters `documents.state` (same as governance list APIs). */
  state?: 'discussion' | 'proposal' | 'agreement';
};

function emptyPagination(
  page: number,
  pageSize: number,
): GetDocumentsBySpaceSlugNotFound['pagination'] {
  return {
    total: 0,
    page,
    page_size: pageSize,
    total_pages: 0,
    has_next_page: false,
    has_previous_page: false,
  };
}

export function serializeDocumentsForToolJson(
  doc: Document & {
    creator?: Document['creator'];
    status?: Document['status'];
  },
): DocumentWithCreatorJson {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Paginated documents for a space (DB `documents` joined with creator resolution),
 * with the same space access gating as `get_people_by_space_slug` / members roster.
 */
export async function getDocumentsBySpaceSlug(
  {
    spaceSlug,
    page = 1,
    pageSize = 20,
    searchTerm,
    state,
  }: GetDocumentsBySpaceSlugInput,
  { db, authToken }: DbConfig & { authToken?: string },
): Promise<
  | { access: 'ok'; result: GetDocumentsBySpaceSlugResult }
  | { access: 'denied'; message: string; space_slug: string }
> {
  const asOf = new Date().toISOString();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));

  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) {
    return {
      access: 'ok',
      result: {
        found: false,
        space_slug: spaceSlug,
        space: null,
        source: 'db',
        source_chain: null,
        asOf,
        documents: [],
        pagination: emptyPagination(safePage, safePageSize),
      },
    };
  }

  if (host.web3SpaceId != null) {
    if (!canConvertToBigInt(host.web3SpaceId)) {
      return {
        access: 'ok',
        result: {
          found: false,
          space_slug: spaceSlug,
          space: null,
          source: 'db',
          source_chain: null,
          asOf,
          documents: [],
          pagination: emptyPagination(safePage, safePageSize),
        },
      };
    }
    const gate = await checkSpaceAccessForSpace(host, authToken);
    if (!gate.hasAccess) {
      return {
        access: 'denied',
        message: gate.message,
        space_slug: spaceSlug,
      };
    }
  }

  const { data, pagination } = await findAllDocumentsBySpaceSlug(
    { spaceSlug },
    {
      db,
      searchTerm,
      filter: state ? { state } : {},
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        order: [{ name: 'createdAt', dir: DirectionType.DESC }],
      },
    },
  );

  let proposalOutcomes = null as Awaited<
    ReturnType<typeof fetchProposalOutcomeSetsForSpace>
  >;
  let source_chain: 'rpc' | null = null;
  if (host.web3SpaceId != null && canConvertToBigInt(host.web3SpaceId)) {
    proposalOutcomes = await fetchProposalOutcomeSetsForSpace(
      host.web3SpaceId as number,
    );
    source_chain = proposalOutcomes !== null ? 'rpc' : null;
  }

  return {
    access: 'ok',
    result: {
      found: true,
      space_slug: spaceSlug,
      space: {
        id: host.id,
        slug: host.slug,
        title: host.title,
        parent_id: host.parentId ?? null,
      },
      source: 'db',
      source_chain,
      asOf,
      documents: data.map((doc) =>
        serializeDocumentsForToolJson(
          attachProposalStatusToDocument(doc, proposalOutcomes),
        ),
      ),
      pagination: {
        total: pagination.total,
        page: pagination.page,
        page_size: pagination.pageSize,
        total_pages: pagination.totalPages,
        has_next_page: pagination.hasNextPage,
        has_previous_page: pagination.hasPreviousPage,
      },
    },
  };
}
