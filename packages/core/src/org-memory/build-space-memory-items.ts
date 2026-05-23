import type { Attachment, Document } from '../governance/types';
import { DocumentState } from '../governance/types';
import { isMemoryDocument } from '../governance/space-memory-document-label';
import { stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';

export type SpaceMemorySource =
  | 'proposal_upload'
  | 'memory'
  | 'matrix_chat'
  | 'call_recording'
  | 'call_transcript'
  | 'discussion_summary';

export type SpaceMemoryAssetKind = 'document' | 'image' | 'video' | 'other';

export type SpaceMemoryItem = {
  id: string;
  name: string;
  url: string;
  kind: SpaceMemoryAssetKind;
  source: SpaceMemorySource;
  uploadedAt: string;
  context: {
    documentId: number;
    documentTitle: string;
    documentState: DocumentState;
    documentSlug?: string;
    documentLabel?: string;
    matrixEventId?: string;
    textExcerpt?: string;
  };
};

/** JSON shape of `org_memory_assets[]` from `/api/v1/spaces/.../org-memory` (dates are ISO strings). */
export type OrgMemoryAssetWire = {
  source:
    | 'proposal_upload'
    | 'memory'
    | 'matrix_chat'
    | 'call_recording'
    | 'call_transcript'
    | 'discussion_summary';
  filename: string;
  asset_key?: string;
  mime?: string;
  app_url?: string;
  mxc_uri?: string;
  matrix_room_id?: string;
  matrix_event_id?: string;
  document_id?: number;
  document_title?: string;
  document_state?: string;
  document_slug?: string;
  document_label?: string;
  call_session_id?: string;
  discussion_summary_id?: number;
  text_excerpt?: string;
  occurred_at: string;
};

export type OrgMemorySpaceMemoryPayload = {
  org_memory_assets: OrgMemoryAssetWire[];
  assets_pagination?: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
  matrix_fetch?: {
    used_bot_access_token?: boolean;
    used_session_matrix_token?: boolean;
    session_matrix_token_unavailable?: boolean;
    skipped_reason?: string | null;
    access_token_configured?: boolean;
  };
};

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last || url;
  } catch {
    return url.split('/').pop() || url;
  }
}

function normalizeAttachment(raw: string | Attachment): {
  name: string;
  url: string;
} {
  if (typeof raw === 'string') {
    return { url: raw, name: fileNameFromUrl(raw) };
  }
  return {
    url: raw.url,
    name: raw.name?.trim() ? raw.name : fileNameFromUrl(raw.url),
  };
}

/** Only http(s) links are emitted to the UI (blocks `javascript:` etc.). */
function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveOrgMemoryMxcUri(asset: OrgMemoryAssetWire): string | null {
  const fromField = asset.mxc_uri?.trim();
  if (fromField?.startsWith('mxc://')) return fromField;
  const fromAppUrl = asset.app_url?.trim();
  if (fromAppUrl?.startsWith('mxc://')) return fromAppUrl;
  return null;
}

function inferKind(name: string, url: string): SpaceMemoryAssetKind {
  const has = (value: string, exts: string) =>
    new RegExp(`\\.(${exts})(\\?|$)`, 'i').test(value);
  if (
    has(name, 'png|jpe?g|gif|webp|svg|avif') ||
    has(url, 'png|jpe?g|gif|webp|svg|avif')
  ) {
    return 'image';
  }
  if (has(name, 'mp4|webm|mov|mkv|m4v') || has(url, 'mp4|webm|mov|mkv|m4v')) {
    return 'video';
  }
  if (
    has(name, 'pdf|doc|docx|txt|md|csv|xls|xlsx|ppt|pptx|zip') ||
    has(url, 'pdf|doc|docx|txt|md|csv|xls|xlsx|ppt|pptx|zip')
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * API JSON and some callers pass ISO strings; server `Document` uses `Date`.
 * Normalize so Space Memory never calls `.toISOString()` on a string.
 */
function timestampMs(value: unknown): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const t = new Date(value).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Prefer `updatedAt`, then `createdAt`, for display and sort. */
function documentActivityIso(doc: Document): string {
  const fromUpdated = timestampMs(doc.updatedAt);
  if (fromUpdated > 0) return new Date(fromUpdated).toISOString();
  const fromCreated = timestampMs(doc.createdAt);
  if (fromCreated > 0) return new Date(fromCreated).toISOString();
  return new Date(0).toISOString();
}

function memoryDocumentExcerpt(description?: string | null): string {
  return stripMarkdown(stripDescription(description ?? ''), {
    extraNewlines: true,
  }).trim();
}

export function documentStateForContext(
  state: Document['state'],
): DocumentState {
  if (
    state === DocumentState.DISCUSSION ||
    state === DocumentState.PROPOSAL ||
    state === DocumentState.AGREEMENT ||
    state === DocumentState.MEMORY
  ) {
    return state;
  }
  const s = String(state).toLowerCase();
  if (s === DocumentState.DISCUSSION) return DocumentState.DISCUSSION;
  if (s === DocumentState.PROPOSAL) return DocumentState.PROPOSAL;
  if (s === DocumentState.AGREEMENT) return DocumentState.AGREEMENT;
  if (s === DocumentState.MEMORY) return DocumentState.MEMORY;
  return DocumentState.PROPOSAL;
}

/**
 * Flattens governance `documents` into org-memory rows (V1: proposal/upload URLs only).
 * Sorted by `updatedAt` descending (fallback `createdAt`).
 */
export function buildSpaceMemoryItemsFromDocuments(
  documents: Document[],
): SpaceMemoryItem[] {
  const items: SpaceMemoryItem[] = [];

  for (const doc of documents) {
    const activityIso = documentActivityIso(doc);
    const docTitle = doc.title?.trim() || '';
    const stateEnum = documentStateForContext(doc.state);
    const baseContext = {
      documentId: doc.id,
      documentTitle: docTitle,
      documentState: stateEnum,
      documentSlug: doc.slug,
      documentLabel: doc.label?.trim() || undefined,
    };

    if (isMemoryDocument(doc)) {
      const excerpt = memoryDocumentExcerpt(doc.description);
      items.push({
        id: `${doc.id}:memory`,
        name: docTitle || 'Memory',
        url: `memory://document/${doc.id}`,
        kind: 'document',
        source: 'memory',
        uploadedAt: activityIso,
        context: {
          ...baseContext,
          documentState: DocumentState.MEMORY,
          textExcerpt: excerpt || undefined,
        },
      });
    }

    const uploadSource: SpaceMemorySource = isMemoryDocument(doc)
      ? 'memory'
      : 'proposal_upload';

    const attachments = doc.attachments ?? [];
    attachments.forEach((raw, index) => {
      const { name, url } = normalizeAttachment(raw);
      const safeUrl = normalizeHttpUrl(url);
      if (!safeUrl) return;
      items.push({
        id: `${doc.id}:attachment:${index}`,
        name,
        url: safeUrl,
        kind: inferKind(name, safeUrl),
        source: uploadSource,
        uploadedAt: activityIso,
        context: { ...baseContext },
      });
    });

    // Proposal/document leadImage is a decorative header banner (often auto-copied
    // from the space hero). Real uploads live in `attachments` — omit leadImage
    // from Space Memory / org_memory_assets.
  }

  items.sort((a, b) => {
    const tb = new Date(b.uploadedAt).getTime();
    const ta = new Date(a.uploadedAt).getTime();
    if (tb !== ta) return tb - ta;
    if (a.context.documentId !== b.context.documentId) {
      return b.context.documentId - a.context.documentId;
    }
    return a.id.localeCompare(b.id);
  });

  return items;
}

function inferKindFromMime(
  mime: string | undefined,
  name: string,
  url: string,
): SpaceMemoryAssetKind {
  const m = mime?.toLowerCase() ?? '';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf' || m.includes('pdf')) return 'document';
  return inferKind(name, url);
}

/**
 * Builds Space Memory rows from `getOrgMemoryBySpaceSlug` / org-memory HTTP payload
 * (`org_memory_assets`), including Matrix rows with `mxc://` (no direct https URL).
 */
export function buildSpaceMemoryItemsFromOrgMemoryPayload(
  payload: OrgMemorySpaceMemoryPayload,
): SpaceMemoryItem[] {
  const assets = payload.org_memory_assets ?? [];
  const items: SpaceMemoryItem[] = [];
  let matrixIdx = 0;

  for (const a of assets) {
    const uploadedAt = a.occurred_at?.trim()
      ? a.occurred_at
      : new Date(0).toISOString();

    if (a.source === 'proposal_upload') {
      const safeUrl = a.app_url ? normalizeHttpUrl(a.app_url) : null;
      if (!safeUrl) continue;
      const docId = a.document_id ?? 0;
      const title = a.document_title?.trim() ?? '';
      const stateEnum = documentStateForContext(
        (a.document_state as Document['state']) ?? DocumentState.PROPOSAL,
      );
      items.push({
        id: `proposal:${docId}:${safeUrl}`,
        name: a.filename?.trim() ? a.filename : fileNameFromUrl(safeUrl),
        url: safeUrl,
        kind: inferKindFromMime(a.mime, a.filename, safeUrl),
        source: 'proposal_upload',
        uploadedAt,
        context: {
          documentId: docId,
          documentTitle: title,
          documentState: stateEnum,
          documentSlug: a.document_slug,
          documentLabel: a.document_label?.trim() || undefined,
        },
      });
      continue;
    }

    if (a.source === 'memory') {
      const docId = a.document_id ?? 0;
      const title = a.document_title?.trim() || a.filename?.trim() || 'Memory';
      const excerpt = a.text_excerpt?.trim() || '';
      const safeUrl = a.app_url ? normalizeHttpUrl(a.app_url) : null;
      if (safeUrl) {
        items.push({
          id: `memory:${docId}:${safeUrl}`,
          name: a.filename?.trim() ? a.filename : fileNameFromUrl(safeUrl),
          url: safeUrl,
          kind: inferKindFromMime(a.mime, a.filename, safeUrl),
          source: 'memory',
          uploadedAt,
          context: {
            documentId: docId,
            documentTitle: title,
            documentState: DocumentState.MEMORY,
            documentSlug: a.document_slug,
            documentLabel: a.document_label?.trim() || undefined,
            textExcerpt: excerpt || undefined,
          },
        });
        continue;
      }
      items.push({
        id: `memory:${docId}:body`,
        name: title,
        url: `memory://document/${docId}`,
        kind: 'document',
        source: 'memory',
        uploadedAt,
        context: {
          documentId: docId,
          documentTitle: title,
          documentState: DocumentState.MEMORY,
          documentSlug: a.document_slug,
          documentLabel: a.document_label?.trim() || undefined,
          textExcerpt: excerpt || undefined,
        },
      });
      continue;
    }

    if (a.source === 'matrix_chat') {
      const mxc = a.mxc_uri?.trim() ?? '';
      const room = a.matrix_room_id?.trim() ?? '';
      const ev = a.matrix_event_id?.trim() ?? '';
      if (!mxc.startsWith('mxc://')) continue;
      matrixIdx += 1;
      const id =
        room && ev
          ? `matrix:${room}:${ev}:${mxc}`
          : `matrix:${matrixIdx}:${mxc}`;
      items.push({
        id,
        name: a.filename?.trim() ? a.filename : 'attachment',
        url: mxc,
        kind: inferKindFromMime(a.mime, a.filename, mxc),
        source: 'matrix_chat',
        uploadedAt,
        context: {
          documentId: 0,
          documentTitle: '',
          documentState: DocumentState.PROPOSAL,
          matrixEventId: ev || undefined,
        },
      });
      continue;
    }

    if (a.source === 'call_recording') {
      const mxc = resolveOrgMemoryMxcUri(a);
      const safeUrl = !mxc && a.app_url ? normalizeHttpUrl(a.app_url) : null;
      const sessionId = a.call_session_id ?? a.filename;
      items.push({
        id: `call-recording:${sessionId}`,
        name: a.filename?.trim() ? a.filename : 'Call recording',
        url: mxc ?? safeUrl ?? `memory://call-recording/${sessionId}`,
        kind: inferKindFromMime(
          a.mime,
          a.filename,
          mxc ?? a.app_url ?? safeUrl ?? '',
        ),
        source: 'call_recording',
        uploadedAt,
        context: {
          documentId: 0,
          documentTitle: a.call_session_id ?? '',
          documentState: DocumentState.PROPOSAL,
        },
      });
      continue;
    }

    if (a.source === 'call_transcript' || a.source === 'discussion_summary') {
      const syntheticId =
        a.source === 'discussion_summary'
          ? String(a.discussion_summary_id ?? a.filename)
          : String(a.call_session_id ?? a.filename);
      items.push({
        id: `${a.source}:${syntheticId}`,
        name: a.filename?.trim()
          ? a.filename
          : a.source === 'discussion_summary'
          ? 'Discussion summary'
          : 'Call transcript',
        url: `memory://${a.source}/${syntheticId}`,
        kind: 'document',
        source: a.source,
        uploadedAt,
        context: {
          documentId: 0,
          documentTitle: a.text_excerpt ?? '',
          documentState: DocumentState.PROPOSAL,
        },
      });
    }
  }

  items.sort((a, b) => {
    const tb = new Date(b.uploadedAt).getTime();
    const ta = new Date(a.uploadedAt).getTime();
    if (tb !== ta) return tb - ta;
    return a.id.localeCompare(b.id);
  });

  return items;
}

export function filterSpaceMemoryItems(
  items: SpaceMemoryItem[],
  searchTerm: string,
): SpaceMemoryItem[] {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (row) =>
      row.name.toLowerCase().includes(q) ||
      row.url.toLowerCase().includes(q) ||
      row.context.documentTitle.toLowerCase().includes(q) ||
      (row.context.documentLabel?.toLowerCase().includes(q) ?? false),
  );
}
