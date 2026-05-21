import 'server-only';

import type { Document } from '../types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { and, desc, eq } from 'drizzle-orm';
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
import {
  HYPHA_MEDIA_BUNDLE_FIELD,
  type HyphaMediaBundleItemWire,
} from '../../matrix/rich-reply';
import { coherences } from '@hypha-platform/storage-postgres';
import { withOrgMemoryAssetKeys } from '../../org-memory/with-org-memory-asset-keys';
import { listSpaceCallArtifactsBySpaceId } from './call-artifacts';

/** Aligned with MCP §8.1 / architecture org memory rows. */
export type OrgMemoryAsset = {
  source:
    | 'proposal_upload'
    | 'matrix_chat'
    | 'call_recording'
    | 'call_transcript'
    | 'discussion_summary';
  filename: string;
  /** Opaque key for `fetch_org_memory_asset` (MCP / Chat). */
  asset_key?: string;
  mime?: string;
  app_url?: string;
  mxc_uri?: string;
  matrix_room_id?: string;
  matrix_event_id?: string;
  document_id?: number;
  /** Proposal row only — lets clients show the same governance context as the documents API. */
  document_title?: string;
  document_state?: Document['state'];
  document_slug?: string;
  document_label?: string;
  call_session_id?: string;
  call_recording_id?: number;
  call_transcript_id?: number;
  discussion_summary_id?: number;
  text_excerpt?: string;
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
  /**
   * When set with a valid Privy JWT, Matrix fetch may use this user's stored
   * Matrix access token if `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN` is unset
   * (Space Memory / browser API parity with Human Chat).
   */
  requestUrlForSessionMatrix?: string;
};

/** Why Matrix-backed rows may be empty (MCP / debugging — no secrets). */
export type MatrixOrgMemoryFetchMeta = {
  attempted: boolean;
  skipped_reason:
    | 'missing_homeserver_url'
    | 'missing_access_token'
    | 'missing_chat_room_id'
    | null;
  chat_room_id: string | null;
  homeserver_configured: boolean;
  access_token_configured: boolean;
  /** True when `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN` is set (bot / service user). */
  used_bot_access_token: boolean;
  /**
   * True when the caller supplied a Privy JWT and we resolved a valid Matrix
   * token from `matrix_user_links` (same store as Human Chat).
   */
  used_session_matrix_token: boolean;
  /** Privy JWT was present but no usable Matrix link / token (Human Chat never completed, or token expired). */
  session_matrix_token_unavailable: boolean;
  http_status: number | null;
  events_in_chunk: number;
  media_events_yielded: number;
  hypha_media_bundle_slots: number;
  error: string | null;
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
  matrix_fetch: MatrixOrgMemoryFetchMeta;
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
  matrix_fetch: MatrixOrgMemoryFetchMeta;
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

function proposalDocContextFields(
  doc: Document,
): Pick<
  OrgMemoryAsset,
  'document_title' | 'document_state' | 'document_slug' | 'document_label'
> {
  return {
    document_title: doc.title?.trim() || undefined,
    document_state: doc.state,
    document_slug: doc.slug,
    document_label: doc.label?.trim() || undefined,
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
    ...proposalDocContextFields(doc),
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
          ...proposalDocContextFields(doc),
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

async function listSpaceMatrixRoomIds(
  {
    spaceId,
    primaryRoomId,
  }: {
    spaceId: number;
    primaryRoomId: string | null;
  },
  { db }: DbConfig,
): Promise<string[]> {
  const rows = await db
    .select({ roomId: coherences.roomId })
    .from(coherences)
    .where(and(eq(coherences.spaceId, spaceId), eq(coherences.archived, false)))
    .orderBy(desc(coherences.updatedAt))
    .limit(200);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (roomId: string | null | undefined) => {
    const trimmed = roomId?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  push(primaryRoomId);
  for (const row of rows) {
    push(row.roomId);
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
  /** Pagination token for `from=` on the next `/messages` request (dir=b). */
  end?: string;
};

function matrixEnvFlags(): Pick<
  MatrixOrgMemoryFetchMeta,
  'homeserver_configured' | 'access_token_configured'
> {
  return {
    homeserver_configured: Boolean(
      process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim(),
    ),
    access_token_configured: Boolean(
      process.env.HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN?.trim(),
    ),
  };
}

function idleMatrixFetchMeta(): MatrixOrgMemoryFetchMeta {
  return {
    attempted: false,
    skipped_reason: null,
    chat_room_id: null,
    ...matrixEnvFlags(),
    used_bot_access_token: false,
    used_session_matrix_token: false,
    session_matrix_token_unavailable: false,
    http_status: null,
    events_in_chunk: 0,
    media_events_yielded: 0,
    hypha_media_bundle_slots: 0,
    error: null,
  };
}

function pushMxcAsset(
  out: OrgMemoryAsset[],
  seen: Set<string>,
  matrixRoomId: string,
  eventId: string,
  mxc: string,
  filename: string,
  mime: string | undefined,
  tsIso: string,
): void {
  if (!mxc.startsWith('mxc://')) return;
  const key = `${matrixRoomId}:${eventId}:${mxc}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    source: 'matrix_chat',
    filename: filename || 'attachment',
    mime,
    mxc_uri: mxc,
    matrix_room_id: matrixRoomId,
    matrix_event_id: eventId,
    occurred_at: tsIso,
  });
}

function extractMediaFromMessageEvent(
  matrixRoomId: string,
  ev: NonNullable<MatrixMessagesChunk['chunk']>[number],
  out: OrgMemoryAsset[],
  seen: Set<string>,
  bundleSlotCounter: { n: number },
): void {
  if (ev.type !== 'm.room.message' || !ev.content || !ev.event_id) return;
  const content = ev.content;
  const msgtype = content.msgtype as string | undefined;
  const ts = ev.origin_server_ts
    ? new Date(ev.origin_server_ts).toISOString()
    : new Date().toISOString();

  if (msgtype === 'm.file' || msgtype === 'm.image') {
    const urlField = content.url as string | undefined;
    const bodyText = (content.body as string | undefined)?.trim();
    const info = content.info as { mimetype?: string } | undefined;
    const filename =
      (typeof content.filename === 'string' ? content.filename : undefined) ||
      bodyText ||
      'attachment';
    if (urlField?.startsWith('mxc://')) {
      pushMxcAsset(
        out,
        seen,
        matrixRoomId,
        ev.event_id,
        urlField,
        filename,
        info?.mimetype,
        ts,
      );
    }
  }

  const bundleRaw = content[HYPHA_MEDIA_BUNDLE_FIELD];
  if (!Array.isArray(bundleRaw)) return;
  for (const item of bundleRaw) {
    if (typeof item !== 'object' || item === null) continue;
    const w = item as HyphaMediaBundleItemWire;
    if (w.msgtype !== 'm.file' && w.msgtype !== 'm.image') continue;
    if (typeof w.url !== 'string' || !w.url.startsWith('mxc://')) continue;
    bundleSlotCounter.n += 1;
    const fn =
      (typeof w.filename === 'string' ? w.filename : undefined) ||
      (typeof w.body === 'string' ? w.body : undefined) ||
      'attachment';
    const mime = w.info?.mimetype;
    pushMxcAsset(out, seen, matrixRoomId, ev.event_id, w.url, fn, mime, ts);
  }
}

export async function fetchMatrixChatAssets(
  matrixRoomId: string,
  options?: {
    authToken?: string;
    requestUrlForSessionMatrix?: string;
  },
): Promise<{ assets: OrgMemoryAsset[]; meta: MatrixOrgMemoryFetchMeta }> {
  const env = matrixEnvFlags();
  const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  const botToken =
    process.env.HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN?.trim() ?? '';

  const sessionAuth = options?.authToken?.trim();
  const sessionReqUrl = options?.requestUrlForSessionMatrix?.trim();
  const triedSession =
    !botToken && Boolean(sessionAuth) && Boolean(sessionReqUrl);

  let sessionToken: string | undefined;
  if (triedSession && sessionAuth && sessionReqUrl) {
    const { resolveUserMatrixAccessTokenForOrgMemory } = await import(
      './resolve-user-matrix-access-token-for-org-memory'
    );
    const resolved = await resolveUserMatrixAccessTokenForOrgMemory(
      sessionAuth,
      sessionReqUrl,
    );
    sessionToken = resolved ?? undefined;
  }

  const effectiveToken = (botToken || sessionToken || '').trim();
  const usedBot = Boolean(botToken && effectiveToken === botToken);
  const usedSession = Boolean(sessionToken && effectiveToken === sessionToken);
  const sessionUnavailable =
    triedSession && !sessionToken && effectiveToken.length === 0;

  if (!homeserver) {
    return {
      assets: [],
      meta: {
        attempted: false,
        skipped_reason: 'missing_homeserver_url',
        chat_room_id: matrixRoomId || null,
        ...env,
        used_bot_access_token: false,
        used_session_matrix_token: false,
        session_matrix_token_unavailable: false,
        http_status: null,
        events_in_chunk: 0,
        media_events_yielded: 0,
        hypha_media_bundle_slots: 0,
        error: null,
      },
    };
  }
  if (!effectiveToken) {
    return {
      assets: [],
      meta: {
        attempted: false,
        skipped_reason: 'missing_access_token',
        chat_room_id: matrixRoomId || null,
        ...env,
        used_bot_access_token: false,
        used_session_matrix_token: false,
        session_matrix_token_unavailable: sessionUnavailable,
        http_status: null,
        events_in_chunk: 0,
        media_events_yielded: 0,
        hypha_media_bundle_slots: 0,
        error: null,
      },
    };
  }
  if (!matrixRoomId.trim()) {
    return {
      assets: [],
      meta: {
        attempted: false,
        skipped_reason: 'missing_chat_room_id',
        chat_room_id: null,
        ...env,
        used_bot_access_token: false,
        used_session_matrix_token: false,
        session_matrix_token_unavailable: false,
        http_status: null,
        events_in_chunk: 0,
        media_events_yielded: 0,
        hypha_media_bundle_slots: 0,
        error: null,
      },
    };
  }

  const encodedRoom = encodeURIComponent(matrixRoomId);
  const limit = 100;
  /** Cap back-pagination so a huge room cannot exhaust time/memory in one request. */
  const maxHistoryPages = 20;

  try {
    const out: OrgMemoryAsset[] = [];
    const seen = new Set<string>();
    const bundleStats = { n: 0 };
    let fromToken: string | undefined;
    let totalEvents = 0;
    let lastStatus: number | null = null;
    let lastErrMsg: string | null = null;

    for (let pageIdx = 0; pageIdx < maxHistoryPages; pageIdx++) {
      const params = new URLSearchParams({
        dir: 'b',
        limit: String(limit),
      });
      if (fromToken) {
        params.set('from', fromToken);
      }
      let url = `${homeserver}/_matrix/client/v3/rooms/${encodedRoom}/messages?${params.toString()}`;

      let res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 401) {
        const qp = new URLSearchParams(params);
        qp.set('access_token', effectiveToken);
        url = `${homeserver}/_matrix/client/v3/rooms/${encodedRoom}/messages?${qp.toString()}`;
        res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(20_000),
        });
      }
      lastStatus = res.status;

      const body = (await res.json()) as MatrixMessagesChunk & {
        errcode?: string;
        error?: string;
      };
      const chunk = body.chunk ?? [];
      totalEvents += chunk.length;

      for (const ev of chunk) {
        extractMediaFromMessageEvent(matrixRoomId, ev, out, seen, bundleStats);
      }

      if (!res.ok) {
        lastErrMsg =
          body.error || body.errcode
            ? `${body.errcode ?? 'M_UNKNOWN'}: ${body.error ?? res.statusText}`
            : `HTTP ${res.status}`;
        break;
      }

      const nextFrom =
        typeof body.end === 'string' && body.end.length > 0
          ? body.end
          : undefined;
      if (!chunk.length || !nextFrom) {
        break;
      }
      fromToken = nextFrom;
    }

    return {
      assets: out,
      meta: {
        attempted: true,
        skipped_reason: null,
        chat_room_id: matrixRoomId,
        ...env,
        used_bot_access_token: usedBot,
        used_session_matrix_token: usedSession,
        session_matrix_token_unavailable: sessionUnavailable,
        http_status: lastStatus,
        events_in_chunk: totalEvents,
        media_events_yielded: out.length,
        hypha_media_bundle_slots: bundleStats.n,
        error: lastErrMsg,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      assets: [],
      meta: {
        attempted: true,
        skipped_reason: null,
        chat_room_id: matrixRoomId,
        ...env,
        used_bot_access_token: usedBot,
        used_session_matrix_token: usedSession,
        session_matrix_token_unavailable: sessionUnavailable,
        http_status: null,
        events_in_chunk: 0,
        media_events_yielded: 0,
        hypha_media_bundle_slots: 0,
        error: msg,
      },
    };
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
      (a.text_excerpt?.toLowerCase().includes(q) ?? false) ||
      (a.app_url?.toLowerCase().includes(q) ?? false) ||
      (a.mxc_uri?.toLowerCase().includes(q) ?? false),
  );
}

function inferAssetKindForSignal(asset: OrgMemoryAsset) {
  const name = asset.filename.toLowerCase();
  const target = `${asset.filename} ${
    asset.app_url ?? asset.mxc_uri ?? ''
  }`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(target)) return 'image';
  if (/\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/i.test(target)) return 'video';
  if (/\.(pdf|doc|docx|txt|md|csv|xls|xlsx|ppt|pptx|zip)(\?|#|$)/i.test(target))
    return 'document';
  if ((asset.mime ?? '').toLowerCase().startsWith('image/')) return 'image';
  if ((asset.mime ?? '').toLowerCase().startsWith('video/')) return 'video';
  if (
    name.endsWith('.pdf') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.txt') ||
    name.endsWith('.md')
  ) {
    return 'document';
  }
  return 'other';
}

function looksOpaqueNoiseFilename(filename: string): boolean {
  const raw = filename.trim();
  if (!raw) return true;
  const lower = raw.toLowerCase();
  const hasExtension = /\.[a-z0-9]{2,5}(\?|#|$)/i.test(raw);
  const alphaNumOnly = /^[a-z0-9_-]+$/i.test(raw);
  const hashLike = alphaNumOnly && raw.length >= 28 && !hasExtension;
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      raw,
    );
  const genericScreenshot =
    /(screenshot|screen shot|image)[\s_-]*\d*/i.test(lower) &&
    !/(architecture|roadmap|proposal|budget|decision|minutes|plan|spec)/i.test(
      lower,
    );
  return hashLike || uuidLike || genericScreenshot;
}

function compactOrgMemoryAssetsForSignal(
  assets: OrgMemoryAsset[],
): OrgMemoryAsset[] {
  const dedupeKeys = new Set<string>();
  const imageQuotaByDocument = new Map<number, number>();
  const compacted: OrgMemoryAsset[] = [];

  for (const asset of assets) {
    const uniqueLocator =
      asset.app_url ??
      asset.mxc_uri ??
      (asset.call_recording_id != null
        ? `call-recording:${asset.call_recording_id}`
        : null) ??
      (asset.call_transcript_id != null
        ? `call-transcript:${asset.call_transcript_id}`
        : null) ??
      (asset.discussion_summary_id != null
        ? `discussion-summary:${asset.discussion_summary_id}`
        : null) ??
      `${asset.filename}:${asset.occurred_at}`;
    const dedupeKey = `${asset.source}:${uniqueLocator}`;
    if (dedupeKeys.has(dedupeKey)) continue;
    dedupeKeys.add(dedupeKey);

    const kind = inferAssetKindForSignal(asset);
    const lowSignalName = looksOpaqueNoiseFilename(asset.filename);

    if (asset.source === 'proposal_upload') {
      if (kind === 'other' && lowSignalName) {
        continue;
      }
      if (kind === 'image' && lowSignalName) {
        continue;
      }
      if (kind === 'image' && asset.document_id != null) {
        const used = imageQuotaByDocument.get(asset.document_id) ?? 0;
        if (used >= 1) continue;
        imageQuotaByDocument.set(asset.document_id, used + 1);
      }
    }

    compacted.push(asset);
  }

  return compacted;
}

/**
 * Organisation memory for a space: member roster (same as `getSpaceMembersRoster`)
 * plus `org_memory_assets` from proposal document attachments/lead images and,
 * when `NEXT_PUBLIC_MATRIX_HOMESERVER_URL` is set and either
 * `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN` **or** (for HTTP with Privy JWT)
 * the caller passes `requestUrlForSessionMatrix` so the user's Matrix token
 * from `matrix_user_links` can be used — Matrix human-chat attachments
 * (including `org.hypha.media_bundle` slots).
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
    requestUrlForSessionMatrix,
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
        matrix_fetch: idleMatrixFetchMeta(),
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
        matrix_fetch: idleMatrixFetchMeta(),
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

  const matrixRoomIds = await listSpaceMatrixRoomIds(
    {
      spaceId: host.id,
      primaryRoomId: host.chatRoomId ?? null,
    },
    { db },
  );
  const matrixResults =
    matrixRoomIds.length > 0
      ? await Promise.all(
          matrixRoomIds.map((roomId) =>
            fetchMatrixChatAssets(roomId, {
              authToken,
              requestUrlForSessionMatrix,
            }),
          ),
        )
      : [];
  const matrixAssets = matrixResults.flatMap((result) => result.assets);
  const matrixMetaFallback: MatrixOrgMemoryFetchMeta = {
    attempted: false,
    skipped_reason: 'missing_chat_room_id',
    chat_room_id: null,
    ...matrixEnvFlags(),
    used_bot_access_token: false,
    used_session_matrix_token: false,
    session_matrix_token_unavailable: false,
    http_status: null,
    events_in_chunk: 0,
    media_events_yielded: 0,
    hypha_media_bundle_slots: 0,
    error: null,
  };
  const matrixFetchMeta = matrixResults.reduce<MatrixOrgMemoryFetchMeta>(
    (aggregate, current) => {
      aggregate.attempted = aggregate.attempted || current.meta.attempted;
      aggregate.used_bot_access_token =
        aggregate.used_bot_access_token || current.meta.used_bot_access_token;
      aggregate.used_session_matrix_token =
        aggregate.used_session_matrix_token ||
        current.meta.used_session_matrix_token;
      aggregate.session_matrix_token_unavailable =
        aggregate.session_matrix_token_unavailable ||
        current.meta.session_matrix_token_unavailable;
      aggregate.events_in_chunk += current.meta.events_in_chunk;
      aggregate.media_events_yielded += current.meta.media_events_yielded;
      aggregate.hypha_media_bundle_slots +=
        current.meta.hypha_media_bundle_slots;
      if (current.meta.http_status != null) {
        aggregate.http_status = current.meta.http_status;
      }
      if (current.meta.error) {
        aggregate.error = aggregate.error
          ? `${aggregate.error} | ${current.meta.error}`
          : current.meta.error;
      }
      return aggregate;
    },
    {
      ...matrixMetaFallback,
      chat_room_id: matrixRoomIds[0] ?? null,
      skipped_reason: matrixRoomIds.length > 0 ? null : 'missing_chat_room_id',
    },
  );

  const callArtifacts = await listSpaceCallArtifactsBySpaceId(host.id, { db });
  const recordingAssets: OrgMemoryAsset[] = callArtifacts.recordings.map(
    (r) => ({
      source: 'call_recording',
      filename:
        r.mediaUri.split('/').pop()?.trim() ||
        `call-recording-${r.callSessionId}.webm`,
      app_url: r.mediaUri,
      mime: r.mimeType,
      occurred_at: r.createdAt.toISOString(),
      call_session_id: r.callSessionId,
      call_recording_id: r.id,
    }),
  );
  const transcriptAssets: OrgMemoryAsset[] = callArtifacts.transcripts.map(
    (t) => ({
      source: 'call_transcript',
      filename: `call-transcript-${t.callSessionId}.txt`,
      mime: 'text/plain',
      occurred_at: t.createdAt.toISOString(),
      call_session_id: t.callSessionId,
      call_transcript_id: t.id,
      text_excerpt: t.summary ?? t.text.slice(0, 240),
    }),
  );
  const discussionSummaryAssets: OrgMemoryAsset[] = callArtifacts.summaries.map(
    (s) => ({
      source: 'discussion_summary',
      filename: `discussion-summary-${s.id}.md`,
      mime: 'text/markdown',
      occurred_at: s.createdAt.toISOString(),
      discussion_summary_id: s.id,
      text_excerpt: s.summary,
    }),
  );

  let combined = [
    ...proposalAssets,
    ...matrixAssets,
    ...recordingAssets,
    ...transcriptAssets,
    ...discussionSummaryAssets,
  ].sort((a, b) =>
    a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0,
  );
  combined = compactOrgMemoryAssetsForSignal(combined);
  combined = filterAssetsBySearch(combined, assetsSearch);

  const total = combined.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safeAssetsPageSize);
  const offset = (safeAssetsPage - 1) * safeAssetsPageSize;
  const pageSlice = combined.slice(offset, offset + safeAssetsPageSize);
  const assetsWithKeys = withOrgMemoryAssetKeys(pageSlice);

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
      org_memory_assets: assetsWithKeys,
      matrix_fetch: matrixFetchMeta,
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
