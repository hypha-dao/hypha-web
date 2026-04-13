import type { Attachment, Document } from '../governance/types';
import { DocumentState } from '../governance/types';

export type SpaceMemorySource = 'proposal_upload';

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

function documentStateForContext(state: Document['state']): DocumentState {
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

export function filterSpaceMemoryItems(
  items: SpaceMemoryItem[],
  searchTerm: string,
): SpaceMemoryItem[] {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (row) =>
      row.name.toLowerCase().includes(q) ||
      row.context.documentTitle.toLowerCase().includes(q) ||
      (row.context.documentLabel?.toLowerCase().includes(q) ?? false),
  );
}
