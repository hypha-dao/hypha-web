export const SPACE_CONTEXT_SECTION_KEYS = [
  'mission',
  'vision',
  'strategy',
  'objectives',
  'key_repositories',
  'tools',
  'how_we_decide',
] as const;

export type BuiltinSpaceContextSectionKey =
  (typeof SPACE_CONTEXT_SECTION_KEYS)[number];

/** Key of a section members added to their space's Context. */
export type CustomSpaceContextSectionKey = `custom-${string}`;

export type SpaceContextSectionKey =
  | BuiltinSpaceContextSectionKey
  | CustomSpaceContextSectionKey;

export const SPACE_CONTEXT_CUSTOM_KEY_PREFIX = 'custom-';

const CUSTOM_SECTION_KEY_RE = /^custom-[a-z0-9]{6,32}$/;

export const SPACE_CONTEXT_SECTION_TITLE_MAX = 80;

/** Suggested change to the set of Context sections, applied on ratification. */
export const SPACE_CONTEXT_PENDING_CHANGES = ['add', 'remove'] as const;

export type SpaceContextPendingChange =
  (typeof SPACE_CONTEXT_PENDING_CHANGES)[number];

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
  BuiltinSpaceContextSectionKey,
  number
> = {
  mission: 0,
  vision: 1,
  strategy: 2,
  objectives: 3,
  key_repositories: 4,
  tools: 5,
  how_we_decide: 6,
};

export type SpaceContextSpecialist = {
  agentKey: string;
  /** Name members @mention in the section discussion. Not translated. */
  agentName: string;
  role: string;
  focus: string;
  avatarLabel: string;
  /** What a good section of this type contains and how to test a draft. */
  brief: string;
};

export const SPACE_CONTEXT_SPECIALISTS: Record<
  BuiltinSpaceContextSectionKey,
  SpaceContextSpecialist
> = {
  mission: {
    agentKey: 'mission',
    agentName: 'Aura Mission',
    role: 'Mission specialist',
    focus: 'Why this space exists',
    avatarLabel: 'AM',
    brief:
      'A mission says why the space exists today: who it serves, the change it makes, and how — in one or two sentences a newcomer can repeat. Test a draft: is it purpose rather than a list of activities? Is the beneficiary named? Would a member know what falls outside it? Cut slogans, jargon, and future-state language (that belongs in Vision).',
  },
  vision: {
    agentKey: 'vision',
    agentName: 'Lumen Vision',
    role: 'Vision specialist',
    focus: 'The future we are building toward',
    avatarLabel: 'LV',
    brief:
      'A vision pictures the world once the mission has succeeded, 5–10 years out: vivid, specific enough to recognise, and about what changes for whom. Test a draft: can members picture it? Is it distinct from the mission (why we exist now) and the strategy (how we get there)?',
  },
  strategy: {
    agentKey: 'strategy',
    agentName: 'Atlas Strategy',
    role: 'Strategy specialist',
    focus: 'How we get there over the next years',
    avatarLabel: 'AS',
    brief:
      'Strategy is the few choices for the next 2–3 years that move the space toward its vision: 3–5 pillars, each with a one-line rationale, plus what the space will not do. Test a draft: are there real trade-offs? Does each pillar trace to the vision? Leave measurable targets to Objectives.',
  },
  objectives: {
    agentKey: 'objectives',
    agentName: 'Pulse Objectives',
    role: 'Objectives specialist',
    focus: 'Measurable goals for this season',
    avatarLabel: 'PO',
    brief:
      'Objectives are 3–5 measurable goals for the current season. Each has an outcome, a metric, a target, a date, and an owner when known, and traces to a strategy pillar. Test a draft: reject vague verbs (improve, explore, support) without a number or a date.',
  },
  key_repositories: {
    agentKey: 'key_repositories',
    agentName: 'Archive Repositories',
    role: 'Repositories specialist',
    focus: 'Code, docs, and data the space relies on',
    avatarLabel: 'AR',
    brief:
      'Key repositories list the code, documents, and data the space relies on. Each entry: name, link, what it holds, maintainer, access (public or private), and status. Group by type. Only use links members shared; mark a missing link as TODO rather than guessing one.',
  },
  tools: {
    agentKey: 'tools',
    agentName: 'Forge Tools',
    role: 'Tools specialist',
    focus: 'Inventory of tools the space uses',
    avatarLabel: 'FT',
    brief:
      'Tools we use is an inventory of the tools the space runs on. Each entry: tool, what it is used for, who administers it, and a link when shared. Group by function (communication, documents, code, finance, design, …). Flag overlaps and gaps. Never add a tool members did not name.',
  },
  how_we_decide: {
    agentKey: 'how_we_decide',
    agentName: 'Quorum Decisions',
    role: 'Decision-process specialist',
    focus: 'How this space accepts work and chooses features',
    avatarLabel: 'QD',
    brief:
      'How we decide what we work on explains how work enters (signals, proposals, requests), how it is prioritised (criteria), who decides and how (owner, consent, or a vote through Hypha Agreements), expected timelines, and where decisions are recorded and revisited. Keep it operational: a new member should be able to follow it.',
  },
};

/** Specialist for sections members add; the section title narrows its focus. */
export const SPACE_CONTEXT_CUSTOM_SPECIALIST: SpaceContextSpecialist = {
  agentKey: 'custom',
  agentName: 'Scribe Context',
  role: 'Context specialist',
  focus: 'A section this space added to its Context',
  avatarLabel: 'SC',
  brief:
    'This section was added by the space itself. Infer its purpose from its title and the discussion: what a newcomer needs to know about that topic to work in this space. Keep it factual and operational, short paragraphs or lists. Test a draft: does every line belong under the title? Would a new member act differently after reading it? Point overlaps with Mission, Vision, Strategy, Objectives, repositories, tools, or decision-making to those sections.',
};

export function isBuiltinSpaceContextSectionKey(
  value: string,
): value is BuiltinSpaceContextSectionKey {
  return (SPACE_CONTEXT_SECTION_KEYS as readonly string[]).includes(value);
}

export function isCustomSpaceContextSectionKey(
  value: string,
): value is CustomSpaceContextSectionKey {
  return CUSTOM_SECTION_KEY_RE.test(value);
}

export function isSpaceContextSectionKey(
  value: string,
): value is SpaceContextSectionKey {
  return (
    isBuiltinSpaceContextSectionKey(value) ||
    isCustomSpaceContextSectionKey(value)
  );
}

export function isSpaceContextPendingChange(
  value: unknown,
): value is SpaceContextPendingChange {
  return (
    typeof value === 'string' &&
    (SPACE_CONTEXT_PENDING_CHANGES as readonly string[]).includes(value)
  );
}

export function specialistForSectionKey(
  key: SpaceContextSectionKey,
): SpaceContextSpecialist {
  return isBuiltinSpaceContextSectionKey(key)
    ? SPACE_CONTEXT_SPECIALISTS[key]
    : SPACE_CONTEXT_CUSTOM_SPECIALIST;
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
