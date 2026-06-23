/** Space Transparency proposal levels — shared by onboarding_guidance and system prompts. */

export type TransparencyLevelId = 0 | 1 | 2 | 3;

export type TransparencyLevelDefinition = {
  id: TransparencyLevelId;
  name: string;
  discoverabilityDescription: string;
  activityDescription: string;
};

export const ONBOARDING_TRANSPARENCY_LEVELS: TransparencyLevelDefinition[] = [
  {
    id: 0,
    name: 'Public',
    discoverabilityDescription: 'Your space is publicly discoverable.',
    activityDescription:
      'Access to your space activity is not restricted and visible publicly.',
  },
  {
    id: 1,
    name: 'Network',
    discoverabilityDescription:
      'Your space is only discoverable by Hypha Network Members.',
    activityDescription:
      "Access to your space's activity is restricted to Hypha Network members.",
  },
  {
    id: 2,
    name: 'Organisation',
    discoverabilityDescription:
      'Your space is only discoverable by members of your organisation.',
    activityDescription:
      'Access to your space activity is restricted to members of your organisation.',
  },
  {
    id: 3,
    name: 'Space',
    discoverabilityDescription:
      'Your space is only discoverable by space members.',
    activityDescription:
      'Access to your space activity is restricted to space members.',
  },
];

export const ONBOARDING_TRANSPARENCY_BENEFITS_GUIDELINES = `Transparency benefits (explain clearly — never pressure):
- Hypha's Planetary AI idea: when spaces are more discoverable and their activity is more legible across the network, knowledge, value, and impact can cross-pollinate between aligned communities—not in a surveillance sense, but so the right people and spaces can find each other, learn from patterns, and coordinate when it genuinely fits.
- More open transparency helps a space participate in network-wide intelligence: relevant partners, ecosystem patterns, and useful signals can surface earlier. That is the upside of transparency on Hypha.
- Tighter transparency is equally valid: sandbox testing, sensitive work, early drafts, invite-only communities, or internal coordination often call for Organisation or Space levels. Never imply the user should feel guilty for choosing privacy.
- Do not force Public or Network. Present benefits once, briefly, then let the user choose. If they already lean private ("keep it internal", "testing only", "not ready to be public"), affirm that choice and help them pick matching levels—do not re-pitch openness.
- Keep the benefits framing to one or two short sentences before the transparency question (or skip it entirely if the user asked for maximum privacy). No brochure tone, no repeated nudging across both transparency steps.
- Tie benefits to their context when helpful (mission, industry, activation mode) but stay factual—never exaggerate or promise outcomes transparency alone cannot deliver.`;

export const ONBOARDING_TRANSPARENCY_GUIDELINES = `Space Transparency (new-space onboarding only — use the Space Transparency proposal levels):
${ONBOARDING_TRANSPARENCY_BENEFITS_GUIDELINES}
- Ask discoverability and space activity access as TWO separate questions, never one combined question.
- Each dimension has exactly four levels: Public, Network, Organisation, Space (same names for both dimensions; meanings differ).
- Discoverability = who can find this space in Hypha.
- Space activity access = who can view this space's activity (proposals, treasury, members, and shared work).
- Never say transparency options are unavailable. The transparency card below always offers all four levels with descriptions.
- In chat mode: ask one question, then present the matching section of the transparency card below (discoverability first, then activity access).
- In voice mode: briefly explain the four levels for the current question in plain language, then invite the user to pick on screen or say Public, Network, Organisation, or Space.
- Never invent a third combined option (for example "open vs private only"). Never skip the official four levels.
- After both answers are set, briefly confirm both choices in one sentence before moving to entry method.`;

function formatLevelOptions(dimension: 'discoverability' | 'activity'): string {
  return ONBOARDING_TRANSPARENCY_LEVELS.map((level) => {
    const description =
      dimension === 'discoverability'
        ? level.discoverabilityDescription
        : level.activityDescription;
    return `- ${level.name}: ${description}`;
  }).join('\n');
}

export function buildTransparencyDiscoverabilityAssistantInstruction(): string {
  return [
    'Ask only the next_question in one short lead-in sentence.',
    'Before the question, you may add one brief sentence on why transparency matters on Hypha (Planetary AI / planetary cross-pollination: legible spaces help aligned communities find each other and share useful patterns across the network)—only if it fits naturally and the user has not asked to stay private. Never pressure toward Public or Network.',
    'This step is discoverability only — who can find this space. Do NOT ask about activity access yet.',
    'Present the four official Space Transparency levels with their descriptions (the discoverability section of the card below also shows them):',
    formatLevelOptions('discoverability'),
    'Direct the user to pick Public, Network, Organisation, or Space using the discoverability options in the transparency card below, or say their choice in chat.',
    'Never say options are unavailable.',
  ].join(' ');
}

export function buildTransparencyActivityAssistantInstruction(): string {
  return [
    'Ask only the next_question in one short lead-in sentence.',
    'Do not repeat the transparency benefits pitch unless the user asks—discoverability is already set. If they chose tighter privacy, affirm it briefly and move on.',
    "This step is space activity access only — who can view this space's activity. Discoverability is already set.",
    'Present the four official Space Transparency levels with their descriptions (the activity access section of the card below also shows them):',
    formatLevelOptions('activity'),
    'Direct the user to pick Public, Network, Organisation, or Space using the activity access options in the transparency card below, or say their choice in chat.',
    'Never say options are unavailable.',
  ].join(' ');
}

export function isAnsweredTransparencyLevel(
  value: unknown,
): value is TransparencyLevelId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 3
  );
}

export function isAnsweredTransparencyMatrix(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    discoverability?: unknown;
    access?: unknown;
  };
  return (
    isAnsweredTransparencyLevel(candidate.discoverability) &&
    isAnsweredTransparencyLevel(candidate.access)
  );
}

export function mergeTransparencyAnswers(
  answers: Record<string, unknown>,
): void {
  if (isAnsweredTransparencyMatrix(answers.transparency_matrix)) {
    return;
  }
  const discoverability = answers.transparency_discoverability;
  const access = answers.transparency_activity_access;
  if (
    isAnsweredTransparencyLevel(discoverability) &&
    isAnsweredTransparencyLevel(access)
  ) {
    answers.transparency_matrix = { discoverability, access };
  }
}
