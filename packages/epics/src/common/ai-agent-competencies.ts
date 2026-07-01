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
    avatarLabel: 'SS',
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
    avatarLabel: 'GA',
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
    avatarLabel: 'OL',
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
    avatarLabel: 'CB',
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
    avatarLabel: 'TT',
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
    avatarLabel: 'PS',
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
    avatarLabel: 'SR',
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
    avatarLabel: 'EP',
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
    avatarLabel: 'LK',
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
      'how is our',
      'doing overall',
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
      'signals',
      'coherence',
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
      'discussion',
      'summarize',
      'team discussion',
    ],
  },
  {
    tagGroup: 'finance',
    keywords: [
      'token',
      'tokens',
      'treasury',
      'budget',
      'funding',
      'finance',
      'holdings',
      'distribution',
      'economics',
      'value flow',
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
      'blind spot',
      'blindspot',
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
      'relay',
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
      'remember',
      'recall',
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

const AVATAR_INITIAL_STOP_WORDS = new Set([
  'and',
  'or',
  'the',
  'a',
  'an',
  'of',
  'for',
  'für',
  'to',
]);

/** Two-letter initials from the first two meaningful words in a role title. */
export function getAgentAvatarInitials(roleLabel: string): string {
  const words = roleLabel
    .replace(/&/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(
      (word) =>
        word.length > 0 && !AVATAR_INITIAL_STOP_WORDS.has(word.toLowerCase()),
    );

  if (words.length === 0) return '?';
  const first = words[0];
  if (!first) return '?';
  if (words.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const second = words[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  const a = first[0];
  const b = second[0];
  if (!a || !b) return first.slice(0, 2).toUpperCase();
  return (a + b).toUpperCase();
}

export function tagGroupAccentClass(tagGroup: string): string {
  switch (tagGroup) {
    case 'purpose':
      return 'border-2 border-accent-8 bg-accent-3/30 text-accent-11';
    case 'governance':
      return 'border-2 border-info-8 bg-info-3/30 text-info-11';
    case 'operations':
      return 'border-2 border-success-8 bg-success-3/30 text-success-11';
    case 'community':
      return 'border-2 border-neutral-7 bg-neutral-3/30 text-neutral-11';
    case 'finance':
      return 'border-2 border-warning-8 bg-warning-3/30 text-warning-11';
    case 'product':
      return 'border-2 border-accent-8 bg-accent-3/30 text-accent-11';
    case 'risk':
      return 'border-2 border-error-8 bg-error-3/30 text-error-11';
    case 'ecosystem':
      return 'border-2 border-info-8 bg-info-3/30 text-info-11';
    case 'learning':
      return 'border-2 border-success-8 bg-success-3/30 text-success-11';
    case 'reputation':
      return 'border-2 border-warning-8 bg-warning-3/30 text-warning-11';
    default:
      return 'border-2 border-neutral-7 bg-neutral-3/30 text-neutral-11';
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
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join(' ');
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

function storageKey(spaceSlug: string): string {
  return `hypha:ai-mobilized-agents:v1:${spaceSlug}`;
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
        /[^a-z0-9]/.test(keyword) ? q.includes(keyword) : words.has(keyword),
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

function persistMobilizedAgents(
  spaceSlug: string,
  agents: MobilizedAiCompetencyAgent[],
): void {
  window.localStorage.setItem(storageKey(spaceSlug), JSON.stringify(agents));
  window.dispatchEvent(
    new CustomEvent(AGENT_UPDATED_EVENT, {
      detail: { spaceSlug },
    }),
  );
}

function mergeMobilizedAgentLists(
  base: MobilizedAiCompetencyAgent[],
  incoming: MobilizedAiCompetencyAgent[],
): MobilizedAiCompetencyAgent[] {
  const map = new Map(base.map((agent) => [agent.id, agent]));
  for (const agent of incoming) {
    const existing = map.get(agent.id);
    map.set(agent.id, {
      ...agent,
      mobilizedCount: (existing?.mobilizedCount ?? 0) + agent.mobilizedCount,
      lastMobilizedAt:
        existing &&
        new Date(existing.lastMobilizedAt).getTime() >
          new Date(agent.lastMobilizedAt).getTime()
          ? existing.lastMobilizedAt
          : agent.lastMobilizedAt,
    });
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.lastMobilizedAt).getTime() -
      new Date(a.lastMobilizedAt).getTime(),
  );
}

export function detectMobilizedAgentsFromChatMessages(
  messages: Array<{ role: string; parts?: ChatMessagePart[] }>,
): AiCompetencyAgent[] {
  const detected = new Map<string, AiCompetencyAgent>();
  for (const message of messages) {
    if (message.role !== 'user') continue;
    const question = extractTextFromChatMessageParts(message.parts);
    if (!question) continue;
    for (const agent of detectAiAgentsForQuestion(question)) {
      detected.set(agent.id, agent);
    }
  }
  return Array.from(detected.values());
}

/** Move onboarding-scoped mobilized agents onto a newly created space. */
export function transferMobilizedAiAgentsToSpace(
  spaceSlug: string,
  options?: {
    messages?: Array<{ role: string; parts?: ChatMessagePart[] }>;
    clearOnboardingScope?: boolean;
  },
): void {
  const slug = spaceSlug.trim();
  if (!slug || typeof window === 'undefined') return;

  const now = new Date().toISOString();
  const fromOnboarding = readMobilizedAiAgents(ONBOARDING_MOBILIZED_SCOPE);
  const fromMessages = (options?.messages ?? [])
    .flatMap((message) => {
      if (message.role !== 'user') return [];
      const question = extractTextFromChatMessageParts(message.parts);
      return question ? detectAiAgentsForQuestion(question) : [];
    })
    .map(
      (agent): MobilizedAiCompetencyAgent => ({
        ...agent,
        mobilizedCount: 1,
        lastMobilizedAt: now,
      }),
    );

  const uniqueFromMessages = mergeMobilizedAgentLists([], fromMessages);
  const incoming = mergeMobilizedAgentLists(fromOnboarding, uniqueFromMessages);
  if (incoming.length === 0) return;

  const merged = mergeMobilizedAgentLists(
    readMobilizedAiAgents(slug),
    incoming,
  );
  persistMobilizedAgents(slug, merged);

  if (options?.clearOnboardingScope !== false) {
    window.localStorage.removeItem(storageKey(ONBOARDING_MOBILIZED_SCOPE));
  }
}

export const ONBOARDING_MOBILIZED_SCOPE = '__onboarding__';

export function recordMobilizedAiAgentsForOnboarding(question: string): void {
  recordMobilizedAiAgentsForQuestion(ONBOARDING_MOBILIZED_SCOPE, question);
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
