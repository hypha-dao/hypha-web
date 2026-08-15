import { extractLinkedSignalSlug } from './graph';

export const SIGNAL_SUNBURST_UNCATEGORIZED_ID = 'uncategorized' as const;

export const SIGNAL_SUNBURST_CATEGORIES = [
  {
    id: 'market',
    label: 'Market Signal',
    keywords: [
      'competitor',
      'customer demand',
      'investment trend',
      'market',
      'product-market',
    ],
  },
  {
    id: 'customer',
    label: 'Customer Signal',
    keywords: [
      'customer',
      'feedback',
      'support ticket',
      'nps',
      'usage pattern',
      'users',
      'beneficiaries',
      'serving audience',
    ],
  },
  {
    id: 'financial',
    label: 'Financial Signal',
    keywords: [
      'treasury',
      'cash flow',
      'fundraising',
      'runway',
      'financial',
      'revenue',
      'costs',
    ],
  },
  {
    id: 'algorithmic',
    label: 'Algorithmic Signal',
    keywords: [
      'ai signal',
      'ai summar',
      'anomaly',
      'prediction',
      'recommendation',
      'algorithm',
    ],
  },
  {
    id: 'regulatory',
    label: 'Regulatory Signal',
    keywords: ['legislation', 'compliance', 'regulation', 'policy'],
  },
  {
    id: 'governance',
    label: 'Governance Signal',
    keywords: [
      'governance',
      'voting',
      'participation',
      'proposal outcome',
      'proposal',
    ],
  },
  {
    id: 'operational',
    label: 'Operational Signal',
    keywords: [
      'bottleneck',
      'delivery metric',
      'workflow',
      'operational',
      'process',
      'project',
      'rhythms',
    ],
  },
  {
    id: 'business',
    label: 'Business Signal',
    keywords: ['kpi', 'productivity', 'business model', 'business'],
  },
  {
    id: 'technology',
    label: 'Technology Signal',
    keywords: [
      'ai model',
      'software release',
      'cybersecurity',
      'technology',
      'software',
    ],
  },
  {
    id: 'environmental',
    label: 'Environmental Signal',
    keywords: [
      'climate',
      'biodiversity',
      'planetary',
      'environmental',
      'water',
      'energy production',
    ],
  },
  {
    id: 'scientific',
    label: 'Scientific Signal',
    keywords: [
      'research paper',
      'discovery',
      'scientific',
      'evidence',
      'research',
    ],
  },
  {
    id: 'political',
    label: 'Political Signal',
    keywords: ['election', 'geopolitical', 'public policy', 'political'],
  },
  {
    id: 'ecosystem',
    label: 'Ecosystem Signal',
    keywords: [
      'partner',
      'grant',
      'alliance',
      'collaboration',
      'ecosystem',
      'matchmaking',
    ],
  },
  {
    id: 'human',
    label: 'Human Signal',
    keywords: [
      'interview',
      'discussion',
      'community observation',
      'communities',
      'community',
      'human',
    ],
  },
  {
    id: 'social',
    label: 'Social Signal',
    keywords: [
      'sentiment',
      'demographic',
      'public opinion',
      'social conditions',
      'social',
    ],
  },
  {
    id: 'network',
    label: 'Network Signal',
    keywords: ['network'],
  },
] as const;

export type SignalSunburstCategoryId =
  | (typeof SIGNAL_SUNBURST_CATEGORIES)[number]['id']
  | typeof SIGNAL_SUNBURST_UNCATEGORIZED_ID;

export const SIGNAL_SUNBURST_CATEGORY_COLORS: Record<
  SignalSunburstCategoryId,
  string
> = {
  market: '#3b82f6',
  customer: '#ec4899',
  financial: '#22c55e',
  algorithmic: '#06b6d4',
  regulatory: '#a855f7',
  governance: '#6366f1',
  operational: '#64748b',
  business: '#8b5cf6',
  technology: '#0ea5e9',
  environmental: '#84cc16',
  scientific: '#14b8a6',
  political: '#ef4444',
  ecosystem: '#10b981',
  human: '#f59e0b',
  social: '#f97316',
  network: '#eab308',
  uncategorized: '#94a3b8',
};

export type IntelligenceSunburstKind =
  | 'root'
  | 'category'
  | 'signal'
  | 'artifact'
  | 'file';

export type IntelligenceSunburstNode = {
  id: string;
  name: string;
  kind: IntelligenceSunburstKind;
  categoryId?: SignalSunburstCategoryId;
  color?: string;
  slug?: string;
  href?: string;
  artifactId?: string;
  value?: number;
  children?: IntelligenceSunburstNode[];
};

export type SunburstSignalInput = {
  slug: string;
  title: string;
  tags?: string[];
  type?: string;
  description?: string;
};

export type SunburstArtifactInput = {
  id: string;
  title: string;
  linked_signals?: string[];
};

export type SunburstFileInput = {
  id: string | number;
  title: string;
  linked_artifact_id: string;
  slug?: string | null;
  href?: string;
};

function haystackForSignal(signal: SunburstSignalInput): string {
  return [signal.title, signal.type, signal.description, ...(signal.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function keywordScore(haystack: string, keywords: readonly string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 1;
  }
  return score;
}

export function categorizeSignal(
  signal: SunburstSignalInput,
): SignalSunburstCategoryId {
  const haystack = haystackForSignal(signal);
  let bestId: SignalSunburstCategoryId = SIGNAL_SUNBURST_UNCATEGORIZED_ID;
  let bestScore = 0;
  for (const category of SIGNAL_SUNBURST_CATEGORIES) {
    const score = keywordScore(haystack, category.keywords);
    if (score > bestScore) {
      bestScore = score;
      bestId = category.id;
    }
  }
  return bestId;
}

function categoryMeta(categoryId: SignalSunburstCategoryId): {
  id: SignalSunburstCategoryId;
  label: string;
  color: string;
} {
  const listed = SIGNAL_SUNBURST_CATEGORIES.find(
    (category) => category.id === categoryId,
  );
  return {
    id: categoryId,
    label: listed?.label ?? 'Uncategorized',
    color: SIGNAL_SUNBURST_CATEGORY_COLORS[categoryId],
  };
}

function asLeaf(node: IntelligenceSunburstNode): IntelligenceSunburstNode {
  if (node.children && node.children.length > 0) return node;
  return { ...node, value: 1, children: undefined };
}

function filesForArtifact(
  artifactId: string,
  filesByArtifact: Map<string, SunburstFileInput[]>,
): IntelligenceSunburstNode[] {
  return (filesByArtifact.get(artifactId) ?? []).map((file) =>
    asLeaf({
      id: `file:${file.id}`,
      name: file.title.trim() || String(file.id),
      kind: 'file',
      slug: file.slug?.trim() || undefined,
      href: file.href?.trim() || undefined,
      artifactId,
    }),
  );
}

function artifactNode(
  artifact: SunburstArtifactInput,
  filesByArtifact: Map<string, SunburstFileInput[]>,
): IntelligenceSunburstNode {
  return asLeaf({
    id: `artifact:${artifact.id}`,
    name: artifact.title.trim() || artifact.id,
    kind: 'artifact',
    artifactId: artifact.id,
    children: filesForArtifact(artifact.id, filesByArtifact),
  });
}

function signalMatchesArtifact(
  signalSlug: string,
  artifact: SunburstArtifactInput,
): boolean {
  const wanted = extractLinkedSignalSlug(signalSlug);
  if (!wanted) return false;
  return (artifact.linked_signals ?? []).some(
    (raw) => extractLinkedSignalSlug(raw) === wanted,
  );
}

/**
 * Hierarchy for the zoomable sunburst, center → edge:
 * root → signal category → signal → artifact → file.
 * Empty proposal/action rings are omitted until those layers exist in data.
 */
export function buildIntelligenceSunburstTree(input: {
  signals: SunburstSignalInput[];
  artifacts: SunburstArtifactInput[];
  files?: SunburstFileInput[];
  rootName?: string;
}): IntelligenceSunburstNode {
  const filesByArtifact = new Map<string, SunburstFileInput[]>();
  for (const file of input.files ?? []) {
    const artifactId = file.linked_artifact_id.trim();
    if (!artifactId) continue;
    const list = filesByArtifact.get(artifactId) ?? [];
    list.push(file);
    filesByArtifact.set(artifactId, list);
  }

  const linkedArtifactIds = new Set<string>();
  const signalsByCategory = new Map<
    SignalSunburstCategoryId,
    SunburstSignalInput[]
  >();

  for (const signal of input.signals) {
    const slug = extractLinkedSignalSlug(signal.slug);
    if (!slug) continue;
    const categoryId = categorizeSignal(signal);
    const list = signalsByCategory.get(categoryId) ?? [];
    list.push({ ...signal, slug });
    signalsByCategory.set(categoryId, list);
  }

  const categoryNodes: IntelligenceSunburstNode[] = [];
  const categoryOrder: SignalSunburstCategoryId[] = [
    ...SIGNAL_SUNBURST_CATEGORIES.map((category) => category.id),
    SIGNAL_SUNBURST_UNCATEGORIZED_ID,
  ];

  for (const categoryId of categoryOrder) {
    const signals = signalsByCategory.get(categoryId) ?? [];
    const children: IntelligenceSunburstNode[] = signals.map((signal) => {
      const linked = input.artifacts.filter((artifact) => {
        const match = signalMatchesArtifact(signal.slug, artifact);
        if (match) linkedArtifactIds.add(artifact.id);
        return match;
      });
      return asLeaf({
        id: `signal:${signal.slug}`,
        name: signal.title.trim() || signal.slug,
        kind: 'signal',
        slug: signal.slug,
        categoryId,
        children: linked.map((artifact) =>
          artifactNode(artifact, filesByArtifact),
        ),
      });
    });

    if (categoryId === SIGNAL_SUNBURST_UNCATEGORIZED_ID) {
      for (const artifact of input.artifacts) {
        if (linkedArtifactIds.has(artifact.id)) continue;
        children.push(artifactNode(artifact, filesByArtifact));
      }
    }

    if (children.length === 0) continue;
    const meta = categoryMeta(categoryId);
    categoryNodes.push({
      id: `category:${categoryId}`,
      name: meta.label,
      kind: 'category',
      categoryId,
      color: meta.color,
      children,
    });
  }

  return {
    id: 'root',
    name: input.rootName?.trim() || 'Intelligence',
    kind: 'root',
    children: categoryNodes,
  };
}
