import type { SpaceHighlightProfile } from '@hypha-platform/storage-postgres';
import type {
  HighlightsBlock,
  HighlightsProfile,
  HighlightsSupportAction,
} from '../types';

function asBlocks(value: unknown): HighlightsBlock[] {
  return Array.isArray(value) ? (value as HighlightsBlock[]) : [];
}

function asSupportActions(value: unknown): HighlightsSupportAction[] {
  return Array.isArray(value) ? (value as HighlightsSupportAction[]) : [];
}

export function mapHighlightProfileRow(
  row: SpaceHighlightProfile,
): HighlightsProfile {
  return {
    published: row.published,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    summary: row.summary ?? null,
    coverImageUrl: row.coverImageUrl ?? null,
    goalAmount: row.goalAmount ?? null,
    goalCurrency: row.goalCurrency ?? null,
    blocks: asBlocks(row.blocks),
    supportActions: asSupportActions(row.supportActions),
  };
}

export function redactSupportActionsForPublic(
  actions: HighlightsSupportAction[],
): HighlightsSupportAction[] {
  return actions.map((action) => ({
    ...action,
    walletAddress: undefined,
    copyInstructions: undefined,
    bankingRail: action.destination === 'iban' ? action.bankingRail : undefined,
  }));
}
