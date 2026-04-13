import 'server-only';

import type { Document } from '../types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import type { DbConfig } from '../../server';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';
import { getSpaceMembersRoster } from '../../space/server/get-space-members-roster';
import {
  serializeSpaceMembersRosterDatesForJson,
  type SpaceMemberRosterEntryJson,
} from '../../space/server/serialize-space-members-roster-for-json';
import { findAllDocumentsBySpaceSlugWithoutPagination } from './queries';
import {
  attachProposalStatusToDocument,
  fetchProposalOutcomeSetsForSpace,
} from './resolve-document-proposal-status';

/** Aligned with MCP §8.1 / architecture org memory rows. */
export type OrgMemoryAsset = {
  source: 'proposal_upload' | 'matrix_chat';
  filename: string;
  mime?: string;
  app_url?: string;
  mxc_uri?: string;
  matrix_room_id?: string;
  matrix_event_id?: string;
  document_id?: number;
  occurred_at: string;
};

export type GetOrgMemoryBySpaceSlugInput = {
  spaceSlug: string;
  /** Roster pagination (same as `get_people_by_space_slug`). */
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  /** Pagination for `org_memory_assets` only (defaults: page 1, size 50). */
  assetsPage?: number;
  assetsPageSize?: number;
  /** Optional filter on asset filenames / URLs (does not affect roster search). */
  assetsSearch?: string;
};

export type OrgMemoryBySpaceSlugSuccess = {
  found: true;
  space_slug: string;
  space: {
    id: number;
    slug: string;
    title: string;
    parent_id: number | null;
  };
  source: 'db';
  source_chain: 'rpc' | null;
  asOf: string;
  members: SpaceMemberRosterEntryJson[];
  org_memory_assets: OrgMemoryAsset[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
  assets_pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
};

export type OrgMemoryBySpaceSlugNotFound = {
  found: false;
  space_slug: string;
  space: null;
  source: 'db';
  source_chain: null;
  asOf: string;
  members: [];
  org_memory_assets: [];
  pagination: OrgMemoryBySpaceSlugSuccess['pagination'];
  assets_pagination: OrgMemoryBySpaceSlugSuccess['assets_pagination'];
};

export type GetOrgMemoryBySpaceSlugResult =
  | OrgMemoryBySpaceSlugSuccess
  | OrgMemoryBySpaceSlugNotFound;

function emptyMemberPagination(
  page: number,
  pageSize: number,
): OrgMemoryBySpaceSlugNotFound['pagination'] {
  return {
    total: 0,
    page,
    page_size: pageSize,
    total_pages: 0,
    has_next_page: false,
    has_previous_page: false,
  };
}

function emptyAssetsPagination(
  page: number,
  pageSize: number,
): OrgMemoryBySpaceSlugNotFound['assets_pagination'] {
  return {
    total: 0,
    page,
    page_size: pageSize,
    total_pages: 0,
    has_next_page: false,
    has_previous_page: false,
  };
}

function normalizeAttachment(
  doc: Document,
  raw: string | { name: string; url: string },
  index: number,
): OrgMemoryAsset | null {
  const url = typeof raw === 'string' ? raw : raw.url;
  const filename =
    typeof raw === 'string'
      ? url.split('/').pop() || `attachment-${index + 1}`
      : raw.name || url.split('/').pop() || `attachment-${index + 1}`;
  if (!url?.trim()) return null;
  return {
    source: 'proposal_upload',
    filename,
    app_url: url,
    document_id: doc.id,
    occurred_at: doc.updatedAt.toISOString(),
  };
}

function collectProposalAssets(
  documents: Array<
    Document & { creator?: Document['creator']; status?: Document['status'] }
  >,
): OrgMemoryAsset[] {
  const out: OrgMemoryAsset[] = [];
  const seen = new Set<string>();
  for (const doc of documents) {
    if (doc.leadImage?.trim()) {
      const url = doc.leadImage;
      const key = `doc:${doc.id}:lead`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          source: 'proposal_upload',
          filename: url.split('/').pop() || 'lead-image',
          app_url: url,
          document_id: doc.id,
          occurred_at: doc.updatedAt.toISOString(),
        });
      }
    }
    const attachments = doc.attachments ?? [];
    attachments.forEach((a, i) => {
      const row = normalizeAttachment(doc, a, i);
      if (!row?.app_url) return;
      const key = `doc:${doc.id}:att:${row.app_url}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(row);
    });
  }
  return out;
}

type MatrixMessagesChunk = {
  chunk?: Array<{
    type?: string;
    content?: Record<string, unknown>;
    event_id?: string;
    origin_server_ts?: number;
  }>;
};

async function fetchMatrixChatAssets(
  matrixRoomId: string,
): Promise<OrgMemoryAsset[]> {
  const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  const token = process.env.HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN?.trim();
  if (!homeserver || !token) {
    return [];
  }

  const encodedRoom = encodeURIComponent(matrixRoomId);
  const url = `${homeserver}/_matrix/client/v3/rooms/${encodedRoom}/messages?dir=b&limit=50`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return [];
    }
    const body = (await res.json()) as MatrixMessagesChunk;
    const chunk = body.chunk ?? [];
    const out: OrgMemoryAsset[] = [];
    const seen = new Set<string>();

    for (const ev of chunk) {
      if (ev.type !== 'm.room.message' || !ev.content || !ev.event_id) continue;
      const msgtype = ev.content.msgtype as string | undefined;
      if (msgtype !== 'm.file' && msgtype !== 'm.image') continue;
      const urlField = ev.content.url as string | undefined;
      if (!urlField?.startsWith('mxc://')) continue;
      const bodyText = (ev.content.body as string | undefined)?.trim();
      const info = ev.content.info as { mimetype?: string } | undefined;
      const filename =
        bodyText ||
        (typeof ev.content.filename === 'string'
          ? ev.content.filename
          : undefined) ||
        'attachment';
      const ts = ev.origin_server_ts
        ? new Date(ev.origin_server_ts).toISOString()
        : new Date().toISOString();
      const key = `${matrixRoomId}:${ev.event_id}:${urlField}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        source: 'matrix_chat',
        filename,
        mime: info?.mimetype,
        mxc_uri: urlField,
        matrix_room_id: matrixRoomId,
        matrix_event_id: ev.event_id,
        occurred_at: ts,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function filterAssetsBySearch(
  assets: OrgMemoryAsset[],
  search: string | undefined,
): OrgMemoryAsset[] {
  if (!search?.trim()) return assets;
  const q = search.trim().toLowerCase();
  return assets.filter(
    (a) =>
      a.filename.toLowerCase().includes(q) ||
      (a.app_url?.toLowerCase().includes(q) ?? false) ||
      (a.mxc_uri?.toLowerCase().includes(q) ?? false),
  );
}

/**
 * Organisation memory for a space: member roster (same as `getSpaceMembersRoster`)
 * plus `org_memory_assets` from proposal document attachments/lead images and,
 * when `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN` is set, Matrix human-chat attachments.
 */
export async function getOrgMemoryBySpaceSlug(
  {
    spaceSlug,
    page = 1,
    pageSize = 20,
    searchTerm,
    assetsPage = 1,
    assetsPageSize = 50,
    assetsSearch,
  }: GetOrgMemoryBySpaceSlugInput,
  { db, authToken }: DbConfig & { authToken?: string },
): Promise<
  | { access: 'ok'; result: GetOrgMemoryBySpaceSlugResult }
  | { access: 'denied'; message: string; space_slug: string }
> {
  const asOf = new Date().toISOString();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const safeAssetsPage = Math.max(1, assetsPage);
  const safeAssetsPageSize = Math.min(100, Math.max(1, assetsPageSize));

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
        members: [],
        org_memory_assets: [],
        pagination: emptyMemberPagination(safePage, safePageSize),
        assets_pagination: emptyAssetsPagination(
          safeAssetsPage,
          safeAssetsPageSize,
        ),
      },
    };
  }

  if (host.web3SpaceId != null) {
    if (!canConvertToBigInt(host.web3SpaceId)) {
      return {
        access: 'denied',
        message: `Space "${host.slug}" (${spaceSlug}) has an invalid on-chain space id in the database. An operator must fix web3SpaceId before org memory can be listed.`,
        space_slug: spaceSlug,
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

  const rosterRaw = await getSpaceMembersRoster(
    {
      spaceSlug,
      page: safePage,
      pageSize: safePageSize,
      searchTerm,
    },
    { db },
  );

  const roster = serializeSpaceMembersRosterDatesForJson(rosterRaw);

  if (!roster.found) {
    return {
      access: 'ok',
      result: {
        ...roster,
        org_memory_assets: [],
        assets_pagination: emptyAssetsPagination(
          safeAssetsPage,
          safeAssetsPageSize,
        ),
      },
    };
  }

  const docs = await findAllDocumentsBySpaceSlugWithoutPagination(
    { spaceSlug, searchTerm: undefined, order: [] },
    { db },
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

  const docsWithStatus = docs.map((d) =>
    attachProposalStatusToDocument(d, proposalOutcomes),
  );

  const proposalAssets = collectProposalAssets(docsWithStatus);

  const matrixRoomId = host.chatRoomId?.trim() ?? '';
  const matrixAssets =
    matrixRoomId.length > 0 ? await fetchMatrixChatAssets(matrixRoomId) : [];

  let combined = [...proposalAssets, ...matrixAssets].sort((a, b) =>
    a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0,
  );
  combined = filterAssetsBySearch(combined, assetsSearch);

  const total = combined.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safeAssetsPageSize);
  const offset = (safeAssetsPage - 1) * safeAssetsPageSize;
  const pageSlice = combined.slice(offset, offset + safeAssetsPageSize);

  return {
    access: 'ok',
    result: {
      found: true,
      space_slug: roster.space_slug,
      space: roster.space,
      source: 'db',
      source_chain,
      asOf,
      members: roster.members,
      org_memory_assets: pageSlice,
      pagination: roster.pagination,
      assets_pagination: {
        total,
        page: safeAssetsPage,
        page_size: safeAssetsPageSize,
        total_pages: totalPages,
        has_next_page: totalPages > 0 && safeAssetsPage < totalPages,
        has_previous_page: totalPages > 0 && safeAssetsPage > 1,
      },
    },
  };
}
