import type { Attachment, Document } from '../governance/types';
import { DocumentState } from '../governance/types';

export type SpaceMemorySource =
  | 'proposal_upload'
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
  };
};

/** JSON shape of `org_memory_assets[]` from `/api/v1/spaces/.../org-memory` (dates are ISO strings). */
export type OrgMemoryAssetWire = {
  source:
    | 'proposal_upload'
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

export function documentStateForContext(
  state: Document['state'],
): DocumentState {
  if (
    state === DocumentState.DISCUSSION ||
    state === DocumentState.PROPOSAL ||
    state === DocumentState.AGREEMENT
  ) {
    return state;
  }
  const s = String(state).toLowerCase();
  if (s === DocumentState.DISCUSSION) return DocumentState.DISCUSSION;
  if (s === DocumentState.PROPOSAL) return DocumentState.PROPOSAL;
  if (s === DocumentState.AGREEMENT) return DocumentState.AGREEMENT;
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
    const attachmentUrls = new Set<string>();
    const docTitle = doc.title?.trim() || '';
    const stateEnum = documentStateForContext(doc.state);
    const baseContext = {
      documentId: doc.id,
      documentTitle: docTitle,
      documentState: stateEnum,
      documentSlug: doc.slug,
      documentLabel: doc.label?.trim() || undefined,
    };

    const attachments = doc.attachments ?? [];
    attachments.forEach((raw, index) => {
      const { name, url } = normalizeAttachment(raw);
      const safeUrl = normalizeHttpUrl(url);
      if (!safeUrl) return;
      attachmentUrls.add(safeUrl);
      items.push({
        id: `${doc.id}:attachment:${index}`,
        name,
        url: safeUrl,
        kind: inferKind(name, safeUrl),
        source: 'proposal_upload',
        uploadedAt: activityIso,
        context: { ...baseContext },
      });
    });

    const lead = doc.leadImage ? normalizeHttpUrl(doc.leadImage) : null;
    if (lead && !attachmentUrls.has(lead)) {
      const name = fileNameFromUrl(lead);
      items.push({
        id: `${doc.id}:lead`,
        name,
        url: lead,
        kind: inferKind(name, lead),
        source: 'proposal_upload',
        uploadedAt: activityIso,
        context: { ...baseContext },
      });
    }
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
      const safeUrl = a.app_url ? normalizeHttpUrl(a.app_url) : null;
      items.push({
        id: `call-recording:${a.call_session_id ?? a.filename}`,
        name: a.filename?.trim() ? a.filename : 'Call recording',
        url:
          safeUrl ??
          `memory://call-recording/${a.call_session_id ?? 'unknown'}`,
        kind: inferKindFromMime(a.mime, a.filename, a.app_url ?? ''),
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
