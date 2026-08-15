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
  /** Coherence priority (`critical` / `high` / `medium` / `low`). */
  priority?: string;
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
  type?: string;
  priority?: string;
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
 * Accept a stored slug, `signal:` node id, or a Coherence deep-link URL
 * (`?signal=coh-…`).
 */
export function extractLinkedSignalSlug(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const fromQuery = url.searchParams.get('signal');
      if (fromQuery?.trim()) {
        return normalizeIntelligenceSignalSlug(fromQuery);
      }
    } catch {
      // Not a usable URL — fall through to slug normalize.
    }
  }
  return normalizeIntelligenceSignalSlug(trimmed);
}

function looksLikeSignalRef(value: string): boolean {
  const slug = extractLinkedSignalSlug(value);
  if (!slug) return false;
  return (
    slug.startsWith('coh-') ||
    /^\d+$/.test(slug) ||
    /^https?:\/\//i.test(value.trim())
  );
}

function artifactSignalRefs(artifact: IntelligenceManifestEntry): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const slug = extractLinkedSignalSlug(raw);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    refs.push(slug);
  };
  for (const raw of artifact.linked_signals ?? []) add(raw);
  for (const raw of artifact.related ?? []) {
    if (looksLikeSignalRef(raw)) add(raw);
  }
  return refs;
}

export function collectIntelligenceLinkedSignalSlugs(
  artifacts: IntelligenceManifestEntry[],
  patches?: IntelligenceGraphPatchLink[],
): string[] {
  const slugs = new Set<string>();
  for (const artifact of artifacts) {
    for (const slug of artifactSignalRefs(artifact)) slugs.add(slug);
  }
  for (const patch of patches ?? []) {
    if (patch.status !== 'pending') continue;
    const slug = extractLinkedSignalSlug(patch.signal_slug ?? '');
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

/**
 * Map linked_signals / patch slugs onto coherence rows.
 * Packs store signal slugs, numeric ids, or `coh-{id}` aliases.
 */
export function graphSignalsFromCoherenceRows(
  linkedSlugs: Iterable<string>,
  rows: Array<{
    id: number;
    slug: string | null;
    title: string;
    type?: string | null;
    priority?: string | null;
  }>,
): IntelligenceGraphSignal[] {
  const linked = new Set(
    [...linkedSlugs]
      .map((value) => extractLinkedSignalSlug(value))
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
    const type = row.type?.trim();
    const priority = row.priority?.trim();
    signals.push({
      slug: canonical,
      title: row.title.trim() || canonical,
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
      aliases:
        linkedAlias !== canonical
          ? [
              ...new Set([
                linkedAlias,
                ...aliases.filter((alias) => alias !== canonical),
              ]),
            ]
          : aliases.filter((alias) => alias !== canonical),
    });
  }
  return signals;
}

/**
 * Knowledge graph: Intelligence artifacts ↔ Coherence signals.
 * Edges come from `linked_signals` and from `related` values that look like
 * signal refs (coh-* slugs, numeric ids, or Coherence deep-link URLs).
 */
export function buildIntelligenceSignalGraph(input: {
  artifacts: IntelligenceManifestEntry[];
  signals?: IntelligenceGraphSignal[];
  patches?: IntelligenceGraphPatchLink[];
}): IntelligenceGraph {
  const signalsBySlug = new Map<string, IntelligenceGraphSignal>();
  for (const signal of input.signals ?? []) {
    const canonical = extractLinkedSignalSlug(signal.slug);
    if (canonical) signalsBySlug.set(canonical, signal);
    for (const alias of signal.aliases ?? []) {
      const key = extractLinkedSignalSlug(alias);
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

  const ensureSignal = (rawSlug: string): string | null => {
    const slug = extractLinkedSignalSlug(rawSlug);
    if (!slug) return null;
    const hit = signalsBySlug.get(slug);
    const nodeSlug = hit?.slug?.trim() || slug;
    const id = intelligenceSignalNodeId(nodeSlug);
    if (!nodes.has(id)) {
      const title = hit?.title?.trim();
      nodes.set(id, {
        id,
        kind: hit ? 'signal' : 'signal-missing',
        title: title || slug,
        type: hit?.type?.trim() || 'signal',
        slug: nodeSlug,
        ...(hit?.priority?.trim() ? { priority: hit.priority.trim() } : {}),
      });
    }
    return id;
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
    for (const rawSlug of artifactSignalRefs(artifact)) {
      const signalId = ensureSignal(rawSlug);
      if (!signalId) continue;
      addEdge(artifact.id, signalId, 'linked-signal');
    }
  }

  for (const patch of input.patches ?? []) {
    if (patch.status !== 'pending') continue;
    const signalSlug = extractLinkedSignalSlug(patch.signal_slug ?? '');
    if (!signalSlug || !patch.target_id) continue;
    if (!artifactsById.has(patch.target_id)) continue;
    ensureArtifact(patch.target_id);
    const signalId = ensureSignal(signalSlug);
    if (!signalId) continue;
    addEdge(signalId, patch.target_id, 'proposed-patch');
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
