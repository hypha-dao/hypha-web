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

function asSignalSlug(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith(INTELLIGENCE_SIGNAL_NODE_PREFIX)) {
    return trimmed.slice(INTELLIGENCE_SIGNAL_NODE_PREFIX.length).trim();
  }
  return trimmed;
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
  const signalsBySlug = new Map(
    (input.signals ?? []).map((signal) => [signal.slug.trim(), signal]),
  );
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
    const slug = asSignalSlug(rawSlug);
    if (!slug) return;
    const id = intelligenceSignalNodeId(slug);
    if (nodes.has(id)) return;
    const hit = signalsBySlug.get(slug);
    const title = hit?.title?.trim();
    nodes.set(id, {
      id,
      kind: hit ? 'signal' : 'signal-missing',
      title: title || slug,
      type: 'signal',
      slug,
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
      const slug = asSignalSlug(rawSlug);
      if (!slug) continue;
      ensureSignal(slug);
      addEdge(artifact.id, intelligenceSignalNodeId(slug), 'linked-signal');
    }
  }

  for (const patch of input.patches ?? []) {
    if (patch.status !== 'pending') continue;
    const signalSlug = asSignalSlug(patch.signal_slug ?? '');
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
