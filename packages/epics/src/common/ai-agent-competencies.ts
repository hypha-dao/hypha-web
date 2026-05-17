'use client';

export type AiCompetencyAgent = {
  id: string;
  tagGroup: string;
  role: string;
  focus: string;
};

export type MobilizedAiCompetencyAgent = AiCompetencyAgent & {
  mobilizedCount: number;
  lastMobilizedAt: string;
};

const AGENT_CATALOG: AiCompetencyAgent[] = [
  {
    id: 'purpose',
    tagGroup: 'purpose',
    role: 'Senior Strategist',
    focus:
      'clarify purpose, strategic alignment, north-star metrics, and long-term direction',
  },
  {
    id: 'governance',
    tagGroup: 'governance',
    role: 'Governance Architect',
    focus:
      'decision rights, accountability, proposal flow, and collective coordination mechanisms',
  },
  {
    id: 'operations',
    tagGroup: 'operations',
    role: 'Operations Lead',
    focus:
      'execution plans, delivery cadence, dependencies, and practical implementation details',
  },
  {
    id: 'community',
    tagGroup: 'community',
    role: 'Community Builder',
    focus:
      'member engagement, participation quality, onboarding, and contributor health',
  },
  {
    id: 'finance',
    tagGroup: 'finance',
    role: 'Treasury and Token Analyst',
    focus:
      'token/treasury implications, distribution effects, sustainability, and financial trade-offs',
  },
  {
    id: 'product',
    tagGroup: 'product',
    role: 'Product Strategist',
    focus:
      'user impact, product priorities, experimentation, and measurable adoption outcomes',
  },
  {
    id: 'risk',
    tagGroup: 'risk',
    role: 'Risk and Compliance Advisor',
    focus:
      'failure modes, downside scenarios, mitigations, and policy/compliance considerations',
  },
];

const KEYWORDS: Array<{ tagGroup: string; keywords: string[] }> = [
  {
    tagGroup: 'purpose',
    keywords: [
      'purpose',
      'mission',
      'vision',
      'north star',
      'strategy',
      'strategic',
      'long term',
      'direction',
    ],
  },
  {
    tagGroup: 'governance',
    keywords: [
      'governance',
      'proposal',
      'vote',
      'voting',
      'decision',
      'decision-making',
      'accountability',
      'policy',
    ],
  },
  {
    tagGroup: 'operations',
    keywords: [
      'operation',
      'execution',
      'roadmap',
      'deliver',
      'delivery',
      'timeline',
      'milestone',
      'process',
    ],
  },
  {
    tagGroup: 'community',
    keywords: [
      'community',
      'member',
      'members',
      'engagement',
      'onboarding',
      'contributors',
      'participation',
    ],
  },
  {
    tagGroup: 'finance',
    keywords: [
      'token',
      'treasury',
      'budget',
      'funding',
      'finance',
      'holdings',
      'distribution',
      'economics',
    ],
  },
  {
    tagGroup: 'product',
    keywords: [
      'product',
      'feature',
      'user',
      'adoption',
      'ux',
      'experience',
      'interface',
      'funnel',
    ],
  },
  {
    tagGroup: 'risk',
    keywords: [
      'risk',
      'secure',
      'security',
      'compliance',
      'legal',
      'incident',
      'failure',
      'threat',
    ],
  },
];

const AGENT_UPDATED_EVENT = 'hypha:ai-agents-updated';

function storageKey(spaceSlug: string): string {
  return `hypha:ai-mobilized-agents:v1:${spaceSlug}`;
}

export function detectAiAgentsForQuestion(
  question: string,
): AiCompetencyAgent[] {
  const q = question.trim().toLowerCase();
  if (!q) return [];

  const groups = new Set<string>();
  for (const entry of KEYWORDS) {
    if (entry.keywords.some((keyword) => q.includes(keyword))) {
      groups.add(entry.tagGroup);
    }
  }

  return AGENT_CATALOG.filter((agent) => groups.has(agent.tagGroup));
}

export function readMobilizedAiAgents(
  spaceSlug?: string | null,
): MobilizedAiCompetencyAgent[] {
  if (!spaceSlug || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(spaceSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MobilizedAiCompetencyAgent =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.role === 'string' &&
        typeof item.focus === 'string' &&
        typeof item.tagGroup === 'string' &&
        typeof item.mobilizedCount === 'number' &&
        typeof item.lastMobilizedAt === 'string',
    );
  } catch {
    return [];
  }
}

export function recordMobilizedAiAgentsForQuestion(
  spaceSlug: string | null | undefined,
  question: string,
): void {
  if (!spaceSlug || typeof window === 'undefined') return;
  const detected = detectAiAgentsForQuestion(question);
  if (detected.length === 0) return;

  const current = readMobilizedAiAgents(spaceSlug);
  const map = new Map(current.map((agent) => [agent.id, agent]));
  const now = new Date().toISOString();

  for (const agent of detected) {
    const existing = map.get(agent.id);
    map.set(agent.id, {
      ...agent,
      mobilizedCount: (existing?.mobilizedCount ?? 0) + 1,
      lastMobilizedAt: now,
    });
  }

  const updated = Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.lastMobilizedAt).getTime() -
      new Date(a.lastMobilizedAt).getTime(),
  );
  window.localStorage.setItem(storageKey(spaceSlug), JSON.stringify(updated));
  window.dispatchEvent(
    new CustomEvent(AGENT_UPDATED_EVENT, {
      detail: { spaceSlug },
    }),
  );
}

export function subscribeMobilizedAiAgents(
  spaceSlug: string | null | undefined,
  onChange: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (!spaceSlug) return;
    if (event.key === storageKey(spaceSlug)) onChange();
  };

  const onCustom = (event: Event) => {
    if (!spaceSlug) return;
    const detail =
      event instanceof CustomEvent
        ? (event.detail as { spaceSlug?: string })
        : {};
    if (!detail?.spaceSlug || detail.spaceSlug === spaceSlug) onChange();
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(AGENT_UPDATED_EVENT, onCustom as EventListener);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(AGENT_UPDATED_EVENT, onCustom as EventListener);
  };
}
