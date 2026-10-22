'use client';

import type { Space } from '@hypha-platform/core/client';
import { useEffect, useMemo, useState } from 'react';

export type DirectoryCensusUpdate = {
  web3SpaceId: number;
  memberCount: number | null;
  memberAddresses: `0x${string}`[];
  documentCount: number | null;
  creatorAddress: string | null;
};

function isRow(value: unknown): value is DirectoryCensusUpdate {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<DirectoryCensusUpdate>;
  return (
    typeof row.web3SpaceId === 'number' &&
    Number.isInteger(row.web3SpaceId) &&
    row.web3SpaceId > 0 &&
    (row.memberCount === null || typeof row.memberCount === 'number') &&
    Array.isArray(row.memberAddresses) &&
    (row.documentCount === null || typeof row.documentCount === 'number') &&
    (row.creatorAddress === null || typeof row.creatorAddress === 'string')
  );
}

function directoryIds(spaces: readonly Space[]): number[] {
  const ids = new Set<number>();
  for (const space of spaces) {
    if (typeof space.web3SpaceId === 'number' && space.web3SpaceId > 0) {
      ids.add(space.web3SpaceId);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * Postgres paints the directory. This fills member and agreement figures
 * as each chain batch returns. A confirmed empty member list is memberCount 0,
 * which the page then drops. A failed read stays null and the space stays.
 */
export function useDeferredDirectoryCensus(spaces: readonly Space[]): {
  byWeb3Id: Readonly<Record<number, DirectoryCensusUpdate>>;
  settled: boolean;
} {
  const idsKey = useMemo(() => directoryIds(spaces).join(','), [spaces]);
  const [byWeb3Id, setByWeb3Id] = useState<
    Record<number, DirectoryCensusUpdate>
  >({});
  const [settled, setSettled] = useState(idsKey.length === 0);

  useEffect(() => {
    const ids = idsKey.length === 0 ? [] : idsKey.split(',').map(Number);
    if (ids.length === 0) {
      setByWeb3Id({});
      setSettled(true);
      return;
    }

    setByWeb3Id({});
    setSettled(false);
    const controller = new AbortController();

    const applyLines = (buffer: string, flush: boolean) => {
      const lines = buffer.split('\n');
      const rest = flush ? '' : lines.pop() ?? '';
      const batch: Record<number, DirectoryCensusUpdate> = {};
      for (const line of flush ? lines.concat(rest ? [rest] : []) : lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (!Array.isArray(parsed)) continue;
        for (const entry of parsed) {
          if (!isRow(entry)) continue;
          batch[entry.web3SpaceId] = entry;
        }
      }
      if (Object.keys(batch).length > 0) {
        setByWeb3Id((current) => ({ ...current, ...batch }));
      }
      return rest;
    };

    const run = async () => {
      const response = await fetch('/api/v1/network/directory-census', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ web3SpaceIds: ids }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          applyLines(buffer, true);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = applyLines(buffer, false);
      }
    };

    void run()
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(
          '[useDeferredDirectoryCensus] failed to load census',
          error,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettled(true);
      });

    return () => controller.abort();
  }, [idsKey]);

  return { byWeb3Id, settled };
}

export function applyDirectoryCensus(
  space: Space,
  row: DirectoryCensusUpdate | undefined,
): Space {
  if (!row) return space;
  return {
    ...space,
    ...(row.memberCount != null
      ? {
          memberCount: row.memberCount,
          ...(row.memberCount > 0
            ? { memberAddresses: row.memberAddresses }
            : {}),
        }
      : {}),
    ...(row.documentCount != null ? { documentCount: row.documentCount } : {}),
    ...(row.creatorAddress ? { creatorAddress: row.creatorAddress } : {}),
  };
}
