import type { SpaceContextSection } from '@hypha-platform/storage-postgres';
import {
  isSpaceContextSectionKey,
  isSpaceContextStatus,
  type SpaceContextSectionKey,
  type SpaceContextStatus,
} from '../constants';
import type { SpaceContextSectionRecord } from '../types';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function mapSectionRow(
  row: SpaceContextSection,
  extras?: {
    proposalTitle?: string | null;
    proposalSlug?: string | null;
    proposalWeb3Id?: number | null;
    proposalStatus?: SpaceContextSectionRecord['proposalStatus'];
    contributorCount?: number;
    lastEditorName?: string | null;
  },
): SpaceContextSectionRecord | null {
  if (!isSpaceContextSectionKey(row.sectionKey)) return null;
  const status: SpaceContextStatus = isSpaceContextStatus(row.status)
    ? row.status
    : 'not_started';
  const createdAt = toIso(row.createdAt) ?? new Date().toISOString();
  const updatedAt = toIso(row.updatedAt) ?? createdAt;
  return {
    id: row.id,
    spaceId: row.spaceId,
    sectionKey: row.sectionKey as SpaceContextSectionKey,
    markdown: row.markdown ?? '',
    status,
    version: row.version ?? 1,
    proposalDocumentId: row.proposalDocumentId ?? null,
    ratifiedDocumentId: row.ratifiedDocumentId ?? null,
    ratifiedAt: toIso(row.ratifiedAt),
    updatedByPersonId: row.updatedByPersonId ?? null,
    createdAt,
    updatedAt,
    proposalTitle: extras?.proposalTitle ?? null,
    proposalSlug: extras?.proposalSlug ?? null,
    proposalWeb3Id: extras?.proposalWeb3Id ?? null,
    proposalStatus: extras?.proposalStatus ?? null,
    contributorCount: extras?.contributorCount ?? 0,
    lastEditorName: extras?.lastEditorName ?? null,
  };
}
