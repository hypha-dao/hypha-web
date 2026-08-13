import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { findAllCoherences } from '../../coherence/server/queries';
import { findSpaceBySlug } from '../../space/server/queries';
import type { IntelligenceManifestEntry } from '../types';
import {
  buildIntelligenceSignalGraph,
  type IntelligenceGraph,
  type IntelligenceGraphPatchLink,
  type IntelligenceGraphSignal,
} from '../graph';
import { spaceIntelligencePrefix } from '../paths';
import {
  isIntelligenceBlobConfigured,
  listIntelligenceBlobPrefix,
  readIntelligenceBlobText,
} from './blob-client';

const PATCH_LIST_LIMIT = 100;

function patchesPrefix(spaceSlug: string): string {
  return `${spaceIntelligencePrefix(spaceSlug)}_patches/`;
}

function parsePatchLink(raw: string): IntelligenceGraphPatchLink | null {
  try {
    const parsed = JSON.parse(raw) as {
      status?: string;
      signal_slug?: string;
      target_id?: string;
    };
    if (
      !parsed ||
      typeof parsed.signal_slug !== 'string' ||
      typeof parsed.target_id !== 'string'
    ) {
      return null;
    }
    return {
      signal_slug: parsed.signal_slug,
      target_id: parsed.target_id,
      status: parsed.status ?? 'pending',
    };
  } catch {
    return null;
  }
}

async function loadPendingPatchLinks(
  spaceSlug: string,
): Promise<IntelligenceGraphPatchLink[]> {
  if (!isIntelligenceBlobConfigured()) return [];
  const prefix = patchesPrefix(spaceSlug);
  const listed = await listIntelligenceBlobPrefix({
    prefix,
    limit: PATCH_LIST_LIMIT,
  });
  const links: IntelligenceGraphPatchLink[] = [];
  for (const blob of listed.blobs) {
    if (!blob.pathname.endsWith('.json')) continue;
    const text = await readIntelligenceBlobText(blob.pathname);
    if (!text) continue;
    const link = parsePatchLink(text);
    if (link) links.push(link);
  }
  return links;
}

export async function buildIntelligenceGraphForSpace(
  input: {
    spaceSlug: string;
    artifacts: IntelligenceManifestEntry[];
  },
  { db }: { db: DatabaseInstance },
): Promise<IntelligenceGraph> {
  let patches: IntelligenceGraphPatchLink[] = [];
  try {
    patches = await loadPendingPatchLinks(input.spaceSlug);
  } catch {
    patches = [];
  }
  const linkedSlugs = new Set<string>();
  for (const artifact of input.artifacts) {
    for (const slug of artifact.linked_signals ?? []) {
      if (slug) linkedSlugs.add(slug);
    }
  }
  for (const patch of patches) {
    if (patch.status === 'pending' && patch.signal_slug) {
      linkedSlugs.add(patch.signal_slug);
    }
  }

  let signals: IntelligenceGraphSignal[] = [];
  if (linkedSlugs.size > 0) {
    const space = await findSpaceBySlug({ slug: input.spaceSlug }, { db });
    if (space) {
      const coherences = await findAllCoherences(
        { db },
        { spaceId: space.id, includeArchived: true },
      );
      signals = coherences
        .filter((row) => row.slug && linkedSlugs.has(row.slug))
        .map((row) => ({
          slug: row.slug as string,
          title: row.title,
        }));
    }
  }

  return buildIntelligenceSignalGraph({
    artifacts: input.artifacts,
    signals,
    patches,
  });
}
