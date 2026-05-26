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
    role: 'aiAgentsCatalog.purpose.role',
    focus: 'aiAgentsCatalog.purpose.focus',
    avatarLabel: 'ST',
    roleDefinition: [
      'aiAgentsCatalog.purpose.roleDefinition.0',
      'aiAgentsCatalog.purpose.roleDefinition.1',
      'aiAgentsCatalog.purpose.roleDefinition.2',
    ],
  },
  {
    id: 'governance',
    tagGroup: 'governance',
    role: 'aiAgentsCatalog.governance.role',
    focus: 'aiAgentsCatalog.governance.focus',
    avatarLabel: 'GV',
    roleDefinition: [
      'aiAgentsCatalog.governance.roleDefinition.0',
      'aiAgentsCatalog.governance.roleDefinition.1',
      'aiAgentsCatalog.governance.roleDefinition.2',
    ],
  },
  {
    id: 'operations',
    tagGroup: 'operations',
    role: 'aiAgentsCatalog.operations.role',
    focus: 'aiAgentsCatalog.operations.focus',
    avatarLabel: 'OP',
    roleDefinition: [
      'aiAgentsCatalog.operations.roleDefinition.0',
      'aiAgentsCatalog.operations.roleDefinition.1',
      'aiAgentsCatalog.operations.roleDefinition.2',
    ],
  },
  {
    id: 'community',
    tagGroup: 'community',
    role: 'aiAgentsCatalog.community.role',
    focus: 'aiAgentsCatalog.community.focus',
    avatarLabel: 'CM',
    roleDefinition: [
      'aiAgentsCatalog.community.roleDefinition.0',
      'aiAgentsCatalog.community.roleDefinition.1',
      'aiAgentsCatalog.community.roleDefinition.2',
    ],
  },
  {
    id: 'finance',
    tagGroup: 'finance',
    role: 'aiAgentsCatalog.finance.role',
    focus: 'aiAgentsCatalog.finance.focus',
    avatarLabel: 'FN',
    roleDefinition: [
      'aiAgentsCatalog.finance.roleDefinition.0',
      'aiAgentsCatalog.finance.roleDefinition.1',
      'aiAgentsCatalog.finance.roleDefinition.2',
    ],
  },
  {
    id: 'product',
    tagGroup: 'product',
    role: 'aiAgentsCatalog.product.role',
    focus: 'aiAgentsCatalog.product.focus',
    avatarLabel: 'PD',
    roleDefinition: [
      'aiAgentsCatalog.product.roleDefinition.0',
      'aiAgentsCatalog.product.roleDefinition.1',
      'aiAgentsCatalog.product.roleDefinition.2',
    ],
  },
  {
    id: 'risk',
    tagGroup: 'risk',
    role: 'aiAgentsCatalog.risk.role',
    focus: 'aiAgentsCatalog.risk.focus',
    avatarLabel: 'RK',
    roleDefinition: [
      'aiAgentsCatalog.risk.roleDefinition.0',
      'aiAgentsCatalog.risk.roleDefinition.1',
      'aiAgentsCatalog.risk.roleDefinition.2',
    ],
  },
  {
    id: 'ecosystem',
    tagGroup: 'ecosystem',
    role: 'aiAgentsCatalog.ecosystem.role',
    focus: 'aiAgentsCatalog.ecosystem.focus',
    avatarLabel: 'EC',
    roleDefinition: [
      'aiAgentsCatalog.ecosystem.roleDefinition.0',
      'aiAgentsCatalog.ecosystem.roleDefinition.1',
      'aiAgentsCatalog.ecosystem.roleDefinition.2',
    ],
  },
  {
    id: 'learning',
    tagGroup: 'learning',
    role: 'aiAgentsCatalog.learning.role',
    focus: 'aiAgentsCatalog.learning.focus',
    avatarLabel: 'LN',
    roleDefinition: [
      'aiAgentsCatalog.learning.roleDefinition.0',
      'aiAgentsCatalog.learning.roleDefinition.1',
      'aiAgentsCatalog.learning.roleDefinition.2',
    ],
  },
  {
    id: 'reputation',
    tagGroup: 'reputation',
    role: 'aiAgentsCatalog.reputation.role',
    focus: 'aiAgentsCatalog.reputation.focus',
    avatarLabel: 'RT',
    roleDefinition: [
      'aiAgentsCatalog.reputation.roleDefinition.0',
      'aiAgentsCatalog.reputation.roleDefinition.1',
      'aiAgentsCatalog.reputation.roleDefinition.2',
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

export function tagGroupAccentClass(tagGroup: string): string {
  switch (tagGroup) {
    case 'purpose':
      return 'bg-accent-3 text-accent-12 border-accent-6';
    case 'governance':
      return 'bg-info-3 text-info-12 border-info-6';
    case 'operations':
      return 'bg-success-3 text-success-12 border-success-6';
    case 'community':
      return 'bg-neutral-3 text-neutral-12 border-neutral-6';
    case 'finance':
      return 'bg-warning-3 text-warning-12 border-warning-6';
    case 'product':
      return 'bg-accent-2 text-accent-11 border-accent-6';
    case 'risk':
      return 'bg-error-3 text-error-12 border-error-6';
    case 'ecosystem':
      return 'bg-info-2 text-info-11 border-info-6';
    case 'learning':
      return 'bg-success-2 text-success-11 border-success-6';
    case 'reputation':
      return 'bg-warning-2 text-warning-11 border-warning-6';
    default:
      return 'bg-muted text-foreground border-border';
  }
}

type ChatMessagePart = {
  type?: string;
  text?: string;
};

export function extractTextFromChatMessageParts(
  parts?: ChatMessagePart[],
): string {
  if (!parts?.length) return '';
  return parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('');
}

export function resolveMobilizedAgentsForAssistantMessage<
  T extends { role: string; parts?: ChatMessagePart[] },
>(messages: readonly T[], assistantIndex: number): AiCompetencyAgent[] {
  const assistant = messages[assistantIndex];
  if (!assistant || assistant.role !== 'assistant') return [];

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'user') continue;
    const question = extractTextFromChatMessageParts(message.parts);
    return question ? detectAiAgentsForQuestion(question) : [];
  }

  return [];
}

export function detectAiAgentsForQuestion(
  question: string,
): AiCompetencyAgent[] {
  const q = question.trim().toLowerCase();
  if (!q) return [];

  const words = new Set(q.split(/[^a-z0-9]+/).filter(Boolean));
  const groups = new Set<string>();
  for (const entry of KEYWORDS) {
    if (
      entry.keywords.some((keyword) =>
        keyword.includes(' ') ? q.includes(keyword) : words.has(keyword),
      )
    ) {
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
        if (!catalog) {
          return {
            id: item.id,
            role: item.role,
            focus: item.focus,
            tagGroup: item.tagGroup,
            avatarLabel:
              typeof item.avatarLabel === 'string' ? item.avatarLabel : '',
            roleDefinition: Array.isArray(item.roleDefinition)
              ? item.roleDefinition.filter(
                  (entry): entry is string => typeof entry === 'string',
                )
              : [],
            mobilizedCount: item.mobilizedCount,
            lastMobilizedAt: item.lastMobilizedAt,
          };
        }
        return {
          ...catalog,
          ...item,
          role: catalog.role,
          focus: catalog.focus,
          tagGroup: catalog.tagGroup,
          avatarLabel: catalog.avatarLabel,
          roleDefinition: catalog.roleDefinition,
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
