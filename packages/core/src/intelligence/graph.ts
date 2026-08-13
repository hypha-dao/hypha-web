import type { IntelligenceManifestEntry } from './types';

export type IntelligenceGraphNode = {
  id: string;
  kind: 'artifact' | 'related-missing';
  title: string;
  type?: string;
  status?: string;
};

export type IntelligenceGraphEdge = {
  from: string;
  to: string;
  relation: 'related';
};

export type IntelligenceGraph = {
  nodes: IntelligenceGraphNode[];
  edges: IntelligenceGraphEdge[];
};

/**
 * Build an undirected-style related graph from manifest entries (M3).
 * Signal linkage via Coherence is layered in when patch flow lands (M5).
 */
export function buildIntelligenceRelatedGraph(
  artifacts: IntelligenceManifestEntry[],
): IntelligenceGraph {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const nodes = new Map<string, IntelligenceGraphNode>();
  const edges: IntelligenceGraphEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const artifact of artifacts) {
    nodes.set(artifact.id, {
      id: artifact.id,
      kind: 'artifact',
      title: artifact.title,
      type: artifact.type,
      status: artifact.status,
    });

    for (const relatedId of artifact.related) {
      if (!nodes.has(relatedId)) {
        const hit = byId.get(relatedId);
        nodes.set(relatedId, {
          id: relatedId,
          kind: hit ? 'artifact' : 'related-missing',
          title: hit?.title ?? relatedId,
          type: hit?.type,
          status: hit?.status,
        });
      }
      const [a, b] = [artifact.id, relatedId].sort();
      const key = `${a}::${b}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ from: artifact.id, to: relatedId, relation: 'related' });
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
  };
}
