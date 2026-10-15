/**
 * The ten specialists already in the competency catalog.
 * Role names match CoherenceTab.aiAgentsCatalog.*.role (left panel and members view).
 * Keyword matching is the same list the left panel uses to mobilize them.
 */

export const AI_SPECIALIST_IDS = [
  'purpose',
  'governance',
  'operations',
  'community',
  'finance',
  'product',
  'risk',
  'ecosystem',
  'learning',
  'reputation',
] as const;

export type AiSpecialistId = (typeof AI_SPECIALIST_IDS)[number];

export type AiSpecialist = {
  id: AiSpecialistId;
  /** next-intl key under CoherenceTab. */
  roleKey: string;
  /** English role, the name the left panel shows in en. */
  role: string;
};

export const AI_SPECIALISTS: readonly AiSpecialist[] = [
  {
    id: 'purpose',
    roleKey: 'aiAgentsCatalog.purpose.role',
    role: 'Senior Strategist',
  },
  {
    id: 'governance',
    roleKey: 'aiAgentsCatalog.governance.role',
    role: 'Governance Architect',
  },
  {
    id: 'operations',
    roleKey: 'aiAgentsCatalog.operations.role',
    role: 'Operations Lead',
  },
  {
    id: 'community',
    roleKey: 'aiAgentsCatalog.community.role',
    role: 'Community Builder',
  },
  {
    id: 'finance',
    roleKey: 'aiAgentsCatalog.finance.role',
    role: 'Treasury and Token Analyst',
  },
  {
    id: 'product',
    roleKey: 'aiAgentsCatalog.product.role',
    role: 'Product Strategist',
  },
  {
    id: 'risk',
    roleKey: 'aiAgentsCatalog.risk.role',
    role: 'Stewardship & Resilience Advisor',
  },
  {
    id: 'ecosystem',
    roleKey: 'aiAgentsCatalog.ecosystem.role',
    role: 'Ecosystem and Partnerships Strategist',
  },
  {
    id: 'learning',
    roleKey: 'aiAgentsCatalog.learning.role',
    role: 'Learning and Knowledge Architect',
  },
  {
    id: 'reputation',
    roleKey: 'aiAgentsCatalog.reputation.role',
    role: 'Reputation and Trust Steward',
  },
];

const KEYWORDS: Array<{ id: AiSpecialistId; keywords: string[] }> = [
  {
    id: 'purpose',
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
    id: 'governance',
    keywords: [
      'governance',
      'proposal',
      'vote',
      'voting',
      'decision',
      'decision-making',
      'accountability',
      'policy',
      'signal',
      'signals',
      'coherence',
    ],
  },
  {
    id: 'operations',
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
    id: 'community',
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
    id: 'finance',
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
    id: 'product',
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
    id: 'risk',
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
    id: 'ecosystem',
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
    id: 'learning',
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
    id: 'reputation',
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

/**
 * The four coded @mention skill questions, in every locale, each routed to
 * the one existing specialist whose catalog already covers that ask.
 * tension → risk, opportunity → ecosystem, need → community, resources → finance.
 */
const SKILL_PHRASES: Array<{ id: AiSpecialistId; phrases: string[] }> = [
  {
    id: 'risk',
    phrases: [
      'What tension do you see?',
      'Que tensão você vê?',
      '¿Qué tensión ves?',
      'Quelle tension vois-tu ?',
      'Welche Spannung siehst du?',
      'Каква напнатост гледаш?',
      'Welke spanning zie je?',
      'Hvilken spenning ser du?',
    ],
  },
  {
    id: 'ecosystem',
    phrases: [
      'What opportunity do you see?',
      'Que oportunidade você vê?',
      '¿Qué oportunidad ves?',
      'Quelle opportunité vois-tu ?',
      'Welche Gelegenheit siehst du?',
      'Каква можност гледаш?',
      'Welke kans zie je?',
      'Hvilken mulighet ser du?',
    ],
  },
  {
    id: 'community',
    phrases: [
      'How would you phrase the need?',
      'Como você formularia a necessidade?',
      '¿Cómo formularías la necesidad?',
      'Comment formulerais-tu le besoin ?',
      'Wie würdest du das Bedürfnis formulieren?',
      'Како би ја формулирал потребата?',
      'Hoe zou je de behoefte formuleren?',
      'Hvordan ville du formulert behovet?',
    ],
  },
  {
    id: 'finance',
    phrases: [
      'What resources does this need?',
      'Que recursos é que isto precisa?',
      '¿Qué recursos hace falta?',
      'De quelles ressources cela a-t-il besoin ?',
      'Welche Ressourcen braucht das?',
      'Кои ресурси требаат за ова?',
      'Welke middelen heeft dit nodig?',
      'Hvilke ressurser trenger dette?',
    ],
  },
];

const SPECIALIST_ID_SET = new Set<string>(AI_SPECIALIST_IDS);

export function isAiSpecialistId(value: string): value is AiSpecialistId {
  return SPECIALIST_ID_SET.has(value);
}

export function specialistById(id: string): AiSpecialist | null {
  return AI_SPECIALISTS.find((specialist) => specialist.id === id) ?? null;
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[¿?¡!]/g, '')
    .replace(/\s+/g, ' ');
}

/** Specialist ids whose keywords appear in the question, catalog order. */
export function matchingSpecialistIds(question: string): AiSpecialistId[] {
  const q = question.trim().toLowerCase();
  if (!q) return [];

  const words = new Set(q.split(/[^a-z0-9]+/).filter(Boolean));
  const groups = new Set<AiSpecialistId>();
  for (const entry of KEYWORDS) {
    if (
      entry.keywords.some((keyword) =>
        /[^a-z0-9]/.test(keyword) ? q.includes(keyword) : words.has(keyword),
      )
    ) {
      groups.add(entry.id);
    }
  }

  return AI_SPECIALISTS.filter((specialist) => groups.has(specialist.id)).map(
    (specialist) => specialist.id,
  );
}

function specialistIdForSkillPhrase(question: string): AiSpecialistId | null {
  const folded = fold(question);
  if (!folded) return null;
  let best: { id: AiSpecialistId; length: number } | null = null;
  for (const entry of SKILL_PHRASES) {
    for (const phrase of entry.phrases) {
      const needle = fold(phrase);
      if (!needle || !folded.includes(needle)) continue;
      if (!best || needle.length > best.length) {
        best = { id: entry.id, length: needle.length };
      }
    }
  }
  return best?.id ?? null;
}

/**
 * One specialist for a question asked of AI Agents.
 * Keyword matches win. The four coded skill questions are the fallback.
 */
export function selectSpecialistForQuestion(
  question: string,
): AiSpecialist | null {
  const matched = matchingSpecialistIds(question);
  const id = matched[0] ?? specialistIdForSkillPhrase(question);
  return id ? specialistById(id) : null;
}

/** Specialists who have already spoken, first call first. Unknown ids are dropped. */
export function calledSpecialistIds(
  messages: readonly { agentSpecialistId?: string | null }[],
): AiSpecialistId[] {
  const seen = new Set<string>();
  const ids: AiSpecialistId[] = [];
  for (const message of messages) {
    const id = message.agentSpecialistId?.trim();
    if (!id || seen.has(id) || !isAiSpecialistId(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
