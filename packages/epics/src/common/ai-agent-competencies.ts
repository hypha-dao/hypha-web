'use client';

export type AiCompetencyAgent = {
  id: string;
  tagGroup: string;
  role: string;
  focus: string;
  avatarLabel: string;
  roleDefinition: string[];
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
      'clarify mission, strategic alignment, north-star outcomes, and long-term direction',
    avatarLabel: 'ST',
    roleDefinition: [
      'Defines strategic intent and links daily decisions to long-term mission outcomes.',
      'Identifies strategic blindspots, trade-offs, and second-order effects before commitments.',
      'Translates vision into measurable priorities, decision criteria, and success indicators.',
    ],
  },
  {
    id: 'governance',
    tagGroup: 'governance',
    role: 'Governance Architect',
    focus:
      'decision rights, accountability models, proposal quality, and collective coordination mechanisms',
    avatarLabel: 'GV',
    roleDefinition: [
      'Designs governance flows that keep proposals clear, accountable, and executable.',
      'Improves voting quality by surfacing assumptions, stakeholder impact, and decision readiness.',
      'Recommends lightweight policy guardrails that protect autonomy while reducing coordination drag.',
    ],
  },
  {
    id: 'operations',
    tagGroup: 'operations',
    role: 'Operations Lead',
    focus:
      'execution plans, delivery cadence, dependency management, and practical implementation details',
    avatarLabel: 'OP',
    roleDefinition: [
      'Turns strategy into executable plans with owners, milestones, and realistic timelines.',
      'Flags dependency bottlenecks early and proposes concrete sequencing options.',
      'Improves delivery reliability with clear operating rhythms and feedback loops.',
    ],
  },
  {
    id: 'community',
    tagGroup: 'community',
    role: 'Community Builder',
    focus:
      'member engagement, participation quality, onboarding, and contributor health',
    avatarLabel: 'CM',
    roleDefinition: [
      'Strengthens participation quality by improving onboarding and contributor clarity.',
      'Detects engagement drop-offs and proposes retention and activation interventions.',
      'Balances openness with healthy norms, trust, and sustainable contributor experience.',
    ],
  },
  {
    id: 'finance',
    tagGroup: 'finance',
    role: 'Treasury and Token Analyst',
    focus:
      'token/treasury implications, distribution effects, sustainability, and capital allocation trade-offs',
    avatarLabel: 'FN',
    roleDefinition: [
      'Evaluates treasury and token decisions for sustainability, concentration risk, and runway impact.',
      'Connects budget choices to strategic priorities and expected organizational outcomes.',
      'Recommends risk-aware allocation options with explicit upside/downside framing.',
    ],
  },
  {
    id: 'product',
    tagGroup: 'product',
    role: 'Product Strategist',
    focus:
      'user impact, product prioritization, experimentation design, and measurable adoption outcomes',
    avatarLabel: 'PD',
    roleDefinition: [
      'Prioritizes features by user value, strategic fit, and implementation leverage.',
      'Designs experiments that validate assumptions with measurable learning outcomes.',
      'Aligns roadmap choices with adoption, retention, and behavior-change metrics.',
    ],
  },
  {
    id: 'risk',
    tagGroup: 'risk',
    role: 'Risk and Compliance Advisor',
    focus:
      'failure modes, downside scenarios, mitigation plans, and policy/compliance considerations',
    avatarLabel: 'RK',
    roleDefinition: [
      'Surfaces operational, governance, and security failure modes before execution.',
      'Recommends practical mitigations with clear ownership and trigger conditions.',
      'Keeps proposals compliant and resilient without over-bureaucratizing execution.',
    ],
  },
  {
    id: 'ecosystem',
    tagGroup: 'ecosystem',
    role: 'Ecosystem and Partnerships Strategist',
    focus:
      'cross-space collaboration, partnerships, ecosystem dependencies, and external coordination leverage',
    avatarLabel: 'EC',
    roleDefinition: [
      'Maps ecosystem dependencies and identifies high-leverage partnership opportunities.',
      'Designs cross-space coordination plans with clear ownership and mutual outcomes.',
      'Improves external signal routing so actionable insights reach the right spaces quickly.',
    ],
  },
  {
    id: 'learning',
    tagGroup: 'learning',
    role: 'Learning and Knowledge Architect',
    focus:
      'knowledge capture, learning loops, evidence quality, and continuous improvement systems',
    avatarLabel: 'LN',
    roleDefinition: [
      'Turns discussions and experiments into reusable organizational knowledge.',
      'Designs feedback loops that improve decision quality over time.',
      'Raises evidence standards by clarifying assumptions, metrics, and lessons learned.',
    ],
  },
  {
    id: 'reputation',
    tagGroup: 'reputation',
    role: 'Reputation and Trust Steward',
    focus:
      'credibility signals, stakeholder trust, narrative coherence, and communication risk management',
    avatarLabel: 'RT',
    roleDefinition: [
      'Protects trust by aligning public narrative with actual operational behavior.',
      'Surfaces reputation risks early and proposes proactive mitigation steps.',
      'Improves stakeholder communication quality during change, conflict, and uncertainty.',
    ],
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
  {
    tagGroup: 'ecosystem',
    keywords: [
      'ecosystem',
      'partnership',
      'partner',
      'interconnected',
      'cross-space',
      'network',
      'external',
      'market',
    ],
  },
  {
    tagGroup: 'learning',
    keywords: [
      'learning',
      'knowledge',
      'feedback loop',
      'retrospective',
      'lesson',
      'evidence',
      'insight',
      'memory',
    ],
  },
  {
    tagGroup: 'reputation',
    keywords: [
      'reputation',
      'trust',
      'credibility',
      'narrative',
      'communications',
      'brand',
      'perception',
      'stakeholder confidence',
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
    const catalogById = new Map(
      AGENT_CATALOG.map((agent) => [agent.id, agent]),
    );
    return parsed
      .filter(
        (item): item is MobilizedAiCompetencyAgent =>
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.role === 'string' &&
          typeof item.focus === 'string' &&
          typeof item.tagGroup === 'string' &&
          typeof item.mobilizedCount === 'number' &&
          typeof item.lastMobilizedAt === 'string',
      )
      .map((item) => {
        const catalog = catalogById.get(item.id);
        if (!catalog) return item;
        return {
          ...catalog,
          ...item,
          role: catalog.role,
          focus: catalog.focus,
          tagGroup: catalog.tagGroup,
        };
      });
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
