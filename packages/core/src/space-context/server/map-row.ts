import type { SpaceContextSection } from '@hypha-platform/storage-postgres';
import {
  isBuiltinSpaceContextSectionKey,
  isSpaceContextPendingChange,
  isSpaceContextSectionKey,
  isSpaceContextStatus,
  type SpaceContextSectionKey,
  type SpaceContextStatus,
} from '../constants';
import { headingForSectionKey } from '../markdown';
import type { SpaceContextSectionRecord } from '../types';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function sectionTitleFromRow(
  row: Pick<SpaceContextSection, 'sectionKey' | 'title'>,
): string {
  const key = row.sectionKey as SpaceContextSectionKey;
  if (isBuiltinSpaceContextSectionKey(key)) return headingForSectionKey(key);
  return row.title?.trim() || headingForSectionKey(key);
}

export function mapSectionRow(
  row: SpaceContextSection,
  extras?: {
    proposalTitle?: string | null;
    proposalSlug?: string | null;
    proposalWeb3Id?: number | null;
    proposalStatus?: SpaceContextSectionRecord['proposalStatus'];
    ratifiedTitle?: string | null;
    ratifiedSlug?: string | null;
    ratifiedWeb3Id?: number | null;
    contributorCount?: number;
    lastEditorName?: string | null;
  },
): SpaceContextSectionRecord | null {
  if (!isSpaceContextSectionKey(row.sectionKey)) return null;
  let status: SpaceContextStatus = isSpaceContextStatus(row.status)
    ? row.status
    : 'not_started';
  // Deleting the ratifying agreement nulls the link but leaves the stored status.
  if (status === 'ratified' && row.ratifiedDocumentId == null) {
    status = row.markdown?.trim() ? 'draft' : 'not_started';
  }
  const markdown = row.markdown ?? '';
  const ratifiedMarkdown =
    row.ratifiedDocumentId != null ? row.ratifiedMarkdown ?? markdown : null;
  const createdAt = toIso(row.createdAt) ?? new Date().toISOString();
  const updatedAt = toIso(row.updatedAt) ?? createdAt;
  return {
    id: row.id,
    spaceId: row.spaceId,
    sectionKey: row.sectionKey,
    title: sectionTitleFromRow(row),
    isCustom: !isBuiltinSpaceContextSectionKey(row.sectionKey),
    markdown,
    ratifiedMarkdown,
    hasDraftChanges:
      ratifiedMarkdown != null && markdown.trim() !== ratifiedMarkdown.trim(),
    pendingChange: isSpaceContextPendingChange(row.pendingChange)
      ? row.pendingChange
      : null,
    status,
    version: row.version ?? 1,
    proposalDocumentId: row.proposalDocumentId ?? null,
    ratifiedDocumentId: row.ratifiedDocumentId ?? null,
    ratifiedAt: toIso(row.ratifiedAt),
    chatRoomId: row.chatRoomId?.trim() || null,
    updatedByPersonId: row.updatedByPersonId ?? null,
    createdAt,
    updatedAt,
    proposalTitle: extras?.proposalTitle ?? null,
    proposalSlug: extras?.proposalSlug ?? null,
    proposalWeb3Id: extras?.proposalWeb3Id ?? null,
    proposalStatus: extras?.proposalStatus ?? null,
    ratifiedTitle: extras?.ratifiedTitle ?? null,
    ratifiedSlug: extras?.ratifiedSlug ?? null,
    ratifiedWeb3Id: extras?.ratifiedWeb3Id ?? null,
    contributorCount: extras?.contributorCount ?? 0,
    lastEditorName: extras?.lastEditorName ?? null,
  };
}
