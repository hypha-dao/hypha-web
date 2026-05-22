import { DocumentState } from './types';
import { normalizeProposalDocumentLabel } from './proposal-document-label';

/** Canonical English `documents.label` for manual Space Memory entries (no on-chain vote). */
export const SPACE_MEMORY_DOCUMENT_LABEL = 'Space Memory';

export function isMemoryDocument(doc: {
  state?: DocumentState | string | null;
  label?: string | null;
}): boolean {
  if (doc.state === DocumentState.MEMORY || doc.state === 'memory') {
    return true;
  }
  const label = doc.label?.trim();
  if (!label) return false;
  return normalizeProposalDocumentLabel(label) === SPACE_MEMORY_DOCUMENT_LABEL;
}
