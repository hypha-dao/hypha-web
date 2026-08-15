import type { IntelligenceManifestEntry } from './types';

export const INTELLIGENCE_SIGNAL_NODE_PREFIX = 'signal:' as const;

export type IntelligenceGraphNodeKind =
  | 'artifact'
  | 'signal'
  | 'signal-missing';

export type IntelligenceGraphNode = {
  id: string;
  kind: IntelligenceGraphNodeKind;
  title: string;
  type?: string;
  status?: string;
  /** Coherence signal slug when `kind` is signal / signal-missing. */
  slug?: string;
};

export type IntelligenceGraphRelation = 'linked-signal' | 'proposed-patch';

export type IntelligenceGraphEdge = {
  from: string;
  to: string;
  relation: IntelligenceGraphRelation;
};

export type IntelligenceGraph = {
  nodes: IntelligenceGraphNode[];
  edges: IntelligenceGraphEdge[];
};

export type IntelligenceGraphSignal = {
  slug: string;
  title: string;
  /** Other ids that appear in `linked_signals` for this row (`coh-{id}`, numeric id). */
  aliases?: string[];
};

export type IntelligenceGraphPatchLink = {
  signal_slug: string;
  target_id: string;
  status: string;
};

export function intelligenceSignalNodeId(signalSlug: string): string {
  return `${INTELLIGENCE_SIGNAL_NODE_PREFIX}${signalSlug}`;
}

export function intelligenceSignalSlugFromNodeId(
  nodeId: string,
): string | null {
  if (!nodeId.startsWith(INTELLIGENCE_SIGNAL_NODE_PREFIX)) return null;
  const slug = nodeId.slice(INTELLIGENCE_SIGNAL_NODE_PREFIX.length).trim();
  return slug || null;
}

export function normalizeIntelligenceSignalSlug(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith(INTELLIGENCE_SIGNAL_NODE_PREFIX)) {
    return trimmed.slice(INTELLIGENCE_SIGNAL_NODE_PREFIX.length).trim();
  }
  return trimmed;
}

/**
 * Map linked_signals / patch slugs onto coherence rows.
 * Packs store signal slugs, numeric ids, or `coh-{id}` aliases.
 */
export function graphSignalsFromCoherenceRows(
  linkedSlugs: Iterable<string>,
  rows: Array<{ id: number; slug: string | null; title: string }>,
): IntelligenceGraphSignal[] {
  const linked = new Set(
    [...linkedSlugs]
      .map((value) => normalizeIntelligenceSignalSlug(value))
      .filter(Boolean),
  );
  if (linked.size === 0) return [];

  const signals: IntelligenceGraphSignal[] = [];
  const seenRowIds = new Set<number>();
  for (const row of rows) {
    if (seenRowIds.has(row.id)) continue;
    const slug = row.slug?.trim() ?? '';
    const aliases = [slug, String(row.id), `coh-${row.id}`].filter(Boolean);
    const linkedAlias = aliases.find((alias) => linked.has(alias));
    if (!linkedAlias) continue;
    seenRowIds.add(row.id);
    const canonical = slug || linkedAlias;
    signals.push({
      slug: canonical,
      title: row.title.trim() || canonical,
      aliases:
        linkedAlias !== canonical
          ? [linkedAlias]
          : aliases.filter((alias) => alias !== canonical),
    });
  }
  return signals;
}

/**
 * Knowledge graph: Intelligence artifacts ↔ Coherence signals only.
 * `related` cross-references are not rendered.
 */
export function buildIntelligenceSignalGraph(input: {
  artifacts: IntelligenceManifestEntry[];
  signals?: IntelligenceGraphSignal[];
  patches?: IntelligenceGraphPatchLink[];
}): IntelligenceGraph {
  const signalsBySlug = new Map<string, IntelligenceGraphSignal>();
  for (const signal of input.signals ?? []) {
    const canonical = normalizeIntelligenceSignalSlug(signal.slug);
    if (canonical) signalsBySlug.set(canonical, signal);
    for (const alias of signal.aliases ?? []) {
      const key = normalizeIntelligenceSignalSlug(alias);
      if (key) signalsBySlug.set(key, signal);
    }
  }
  const artifactsById = new Map(input.artifacts.map((a) => [a.id, a]));
  const nodes = new Map<string, IntelligenceGraphNode>();
  const edges: IntelligenceGraphEdge[] = [];
  const edgeKeys = new Set<string>();

  const ensureArtifact = (id: string) => {
    if (nodes.has(id)) return;
    const artifact = artifactsById.get(id);
    if (!artifact) return;
    nodes.set(id, {
      id,
      kind: 'artifact',
      title: artifact.title,
      type: artifact.type,
      status: artifact.status,
    });
  };

  const ensureSignal = (rawSlug: string) => {
    const slug = normalizeIntelligenceSignalSlug(rawSlug);
    if (!slug) return;
    const id = intelligenceSignalNodeId(slug);
    if (nodes.has(id)) return;
    const hit = signalsBySlug.get(slug);
    const title = hit?.title?.trim();
    const nodeSlug = hit?.slug?.trim() || slug;
    nodes.set(id, {
      id,
      kind: hit ? 'signal' : 'signal-missing',
      title: title || slug,
      type: 'signal',
      slug: nodeSlug,
    });
  };

  const addEdge = (
    from: string,
    to: string,
    relation: IntelligenceGraphRelation,
  ) => {
    const key = `${relation}:${from}->${to}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, relation });
  };

  for (const artifact of input.artifacts) {
    ensureArtifact(artifact.id);
    for (const rawSlug of artifact.linked_signals ?? []) {
      const slug = normalizeIntelligenceSignalSlug(rawSlug);
      if (!slug) continue;
      ensureSignal(slug);
      addEdge(artifact.id, intelligenceSignalNodeId(slug), 'linked-signal');
    }
  }

  for (const patch of input.patches ?? []) {
    if (patch.status !== 'pending') continue;
    const signalSlug = normalizeIntelligenceSignalSlug(patch.signal_slug ?? '');
    if (!signalSlug || !patch.target_id) continue;
    if (!artifactsById.has(patch.target_id)) continue;
    ensureArtifact(patch.target_id);
    ensureSignal(signalSlug);
    addEdge(
      intelligenceSignalNodeId(signalSlug),
      patch.target_id,
      'proposed-patch',
    );
  }

  return {
    nodes: [...nodes.values()],
    edges,
  };
}

/** @deprecated Use buildIntelligenceSignalGraph. Kept for client fallback. */
export function buildIntelligenceRelatedGraph(
  artifacts: IntelligenceManifestEntry[],
): IntelligenceGraph {
  return buildIntelligenceSignalGraph({ artifacts });
}
