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
    documentState: string;
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

function inferKind(name: string, url: string): SpaceMemoryAssetKind {
  const target = `${name} ${url}`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(target)) {
    return 'image';
  }
  if (/\.(mp4|webm|mov|mkv|m4v)(\?|$)/i.test(target)) {
    return 'video';
  }
  if (/\.(pdf|doc|docx|txt|md|csv|xls|xlsx|ppt|pptx|zip)(\?|$)/i.test(target)) {
    return 'document';
  }
  return 'other';
}

function stateLabel(state: Document['state']): string {
  if (typeof state === 'string') return state;
  switch (state) {
    case DocumentState.DISCUSSION:
      return 'discussion';
    case DocumentState.PROPOSAL:
      return 'proposal';
    case DocumentState.AGREEMENT:
      return 'agreement';
    default:
      return String(state);
  }
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
    const attachmentUrls = new Set<string>();
    const docTitle = doc.title?.trim() || '';
    const stateStr = stateLabel(doc.state);
    const baseContext = {
      documentId: doc.id,
      documentTitle: docTitle,
      documentState: stateStr,
      documentSlug: doc.slug,
      documentLabel: doc.label?.trim() || undefined,
    };

    const attachments = doc.attachments ?? [];
    attachments.forEach((raw, index) => {
      const { name, url } = normalizeAttachment(raw);
      if (!url?.trim()) return;
      attachmentUrls.add(url);
      items.push({
        id: `${doc.id}:attachment:${index}`,
        name,
        url,
        kind: inferKind(name, url),
        source: 'proposal_upload',
        uploadedAt: doc.updatedAt.toISOString(),
        context: { ...baseContext },
      });
    });

    const lead = doc.leadImage?.trim();
    if (lead && !attachmentUrls.has(lead)) {
      const name = fileNameFromUrl(lead);
      items.push({
        id: `${doc.id}:lead`,
        name,
        url: lead,
        kind: inferKind(name, lead),
        source: 'proposal_upload',
        uploadedAt: doc.updatedAt.toISOString(),
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
