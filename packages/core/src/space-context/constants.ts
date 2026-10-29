export const SPACE_CONTEXT_SECTION_KEYS = [
  'mission',
  'vision',
  'strategy',
  'objectives',
  'projects',
  'key_repositories',
  'tools',
  'how_we_decide',
] as const;

export type SpaceContextSectionKey =
  (typeof SPACE_CONTEXT_SECTION_KEYS)[number];

export const SPACE_CONTEXT_STATUSES = [
  'not_started',
  'draft',
  'proposed',
  'ratified',
] as const;

export type SpaceContextStatus = (typeof SPACE_CONTEXT_STATUSES)[number];

export const SPACE_CONTEXT_FILTERS = [
  'all',
  'ratified',
  'proposed',
  'drafts',
] as const;

export type SpaceContextFilter = (typeof SPACE_CONTEXT_FILTERS)[number];

/** Canonical `documents.label` for Context ratification proposals. */
export const SPACE_CONTEXT_DOCUMENT_LABEL = 'Space Context';

export const SPACE_CONTEXT_SECTION_ORDER: Record<
  SpaceContextSectionKey,
  number
> = {
  mission: 0,
  vision: 1,
  strategy: 2,
  objectives: 3,
  projects: 4,
  key_repositories: 5,
  tools: 6,
  how_we_decide: 7,
};

export const SPACE_CONTEXT_SPECIALISTS: Record<
  SpaceContextSectionKey,
  {
    agentKey: string;
    role: string;
    focus: string;
    avatarLabel: string;
  }
> = {
  mission: {
    agentKey: 'mission',
    role: 'Mission expert',
    focus: 'Why this space exists',
    avatarLabel: 'ME',
  },
  vision: {
    agentKey: 'vision',
    role: 'Vision expert',
    focus: 'The future we are building toward',
    avatarLabel: 'VE',
  },
  strategy: {
    agentKey: 'strategy',
    role: 'Strategy expert',
    focus: 'How we get there over the next years',
    avatarLabel: 'SE',
  },
  objectives: {
    agentKey: 'objectives',
    role: 'Objectives expert',
    focus: 'Measurable goals for this season',
    avatarLabel: 'OE',
  },
  projects: {
    agentKey: 'projects',
    role: 'Projects expert',
    focus: 'Active initiatives and who leads them',
    avatarLabel: 'PE',
  },
  key_repositories: {
    agentKey: 'key_repositories',
    role: 'Repositories expert',
    focus: 'Code, docs, and data the space relies on',
    avatarLabel: 'RE',
  },
  tools: {
    agentKey: 'tools',
    role: 'Tools expert',
    focus: 'Inventory of tools the space uses',
    avatarLabel: 'TE',
  },
  how_we_decide: {
    agentKey: 'how_we_decide',
    role: 'Decision-process expert',
    focus: 'How this space accepts work and chooses features',
    avatarLabel: 'DE',
  },
};

export function isSpaceContextSectionKey(
  value: string,
): value is SpaceContextSectionKey {
  return (SPACE_CONTEXT_SECTION_KEYS as readonly string[]).includes(value);
}

export function isSpaceContextStatus(
  value: string,
): value is SpaceContextStatus {
  return (SPACE_CONTEXT_STATUSES as readonly string[]).includes(value);
}

export function statusMatchesFilter(
  status: SpaceContextStatus,
  filter: SpaceContextFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'ratified') return status === 'ratified';
  if (filter === 'proposed') return status === 'proposed';
  return status === 'draft' || status === 'not_started';
}
