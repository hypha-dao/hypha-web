import type {
  SpaceMemoryItem,
  SpaceMemorySource,
} from './build-space-memory-items';

export type SpaceMemoryBranch = 'conversations' | 'calls' | 'ai' | 'files';

export const SPACE_MEMORY_BRANCHES = [
  'conversations',
  'calls',
  'ai',
  'files',
] as const satisfies readonly SpaceMemoryBranch[];

export type SpaceMemoryBranchCounts = Record<SpaceMemoryBranch, number>;

export const EMPTY_SPACE_MEMORY_BRANCH_COUNTS: SpaceMemoryBranchCounts = {
  conversations: 0,
  calls: 0,
  ai: 0,
  files: 0,
};

export function isSpaceMemoryAiChatLabel(
  documentLabel: string | null | undefined,
): boolean {
  return documentLabel?.toLowerCase().includes('ai chat') === true;
}

/** Branch for a raw org-memory asset (server + client). */
export function spaceMemoryBranchForAsset(input: {
  source: SpaceMemorySource | string;
  documentLabel?: string | null;
}): SpaceMemoryBranch {
  if (input.source === 'discussion_summary' || input.source === 'memory') {
    return 'conversations';
  }
  if (input.source === 'call_recording' || input.source === 'call_transcript') {
    return 'calls';
  }
  if (
    input.source === 'matrix_chat' &&
    isSpaceMemoryAiChatLabel(input.documentLabel)
  ) {
    return 'ai';
  }
  return 'files';
}

export function spaceMemoryBranchForItem(
  item: SpaceMemoryItem,
): SpaceMemoryBranch {
  return spaceMemoryBranchForAsset({
    source: item.source,
    documentLabel: item.context.documentLabel,
  });
}

export function countSpaceMemoryBranches(
  assets: ReadonlyArray<{
    source: SpaceMemorySource | string;
    documentLabel?: string | null;
  }>,
): SpaceMemoryBranchCounts {
  const counts: SpaceMemoryBranchCounts = {
    conversations: 0,
    calls: 0,
    ai: 0,
    files: 0,
  };
  for (const asset of assets) {
    counts[spaceMemoryBranchForAsset(asset)] += 1;
  }
  return counts;
}
