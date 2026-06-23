/** Same three entry options as AgreementFlow / onboarding entry method card. */

export type OnboardingEntryMethodId =
  | 'open_access'
  | 'invite_only'
  | 'token_based';

export type OnboardingEntryMethodOption = {
  id: OnboardingEntryMethodId;
  label: string;
  description: string;
};

export const ONBOARDING_ENTRY_METHOD_OPTIONS: readonly OnboardingEntryMethodOption[] =
  [
    {
      id: 'open_access',
      label: 'Open Access',
      description:
        'New members can join instantly. Participation is open to everyone and fully transparent.',
    },
    {
      id: 'invite_only',
      label: 'Invite Request',
      description:
        'New members can participate by requesting an invitation to join. Existing members vote on invite requests. Participation is only open to invited members but remains fully transparent to everyone.',
    },
    {
      id: 'token_based',
      label: 'Token Based',
      description:
        'New members can join if they meet token requirements. Participation is only open to eligible members but remains fully transparent to everyone.',
    },
  ] as const;

export const ONBOARDING_ENTRY_METHOD_LABELS =
  ONBOARDING_ENTRY_METHOD_OPTIONS.map((option) => option.label);

export const ONBOARDING_ENTRY_METHOD_GUIDELINES = `Entry method (onboarding — same options as the entry method card and governance forms):
- ONLY three allowed choices — use these exact titles with users: Open Access, Invite Request, Token Based.
- Never say invite-only, request access, token-based entry, token-gated, or generic "open access" without the Open Access title. The middle option is Invite Request (not "invite-only" or "request access").
- User picks with the entry method card in the panel—ask one short question; do not invent alternate labels or comma-separated option lists.
- Token Based requires creating a membership token after the space is created.`;

export function formatEntryMethodOptionsForAssistant(): string {
  return ONBOARDING_ENTRY_METHOD_OPTIONS.map(
    (option) => `- ${option.label}: ${option.description}`,
  ).join('\n');
}

export function buildEntryMethodAssistantInstruction(
  warnOpenAccessWithPrivateDiscoverability = false,
): string {
  const lines = [
    'Ask only the next_question in one short sentence.',
    'The user chooses with the entry method card below. Use ONLY these exact option titles—never invite-only, request access, or token-based entry:',
    formatEntryMethodOptionsForAssistant(),
    'Do not enumerate options as a comma-separated list in prose. In voice mode, give a one-sentence overview and invite them to use the card on screen.',
    'Token Based requires creating a membership token after the space is created.',
  ];
  if (warnOpenAccessWithPrivateDiscoverability) {
    lines.push(
      'If they pick Open Access, flag warmly that Organisation or Space discoverability makes it hard for newcomers to find the space—offer Public or Network discoverability or Invite Request / Token Based instead.',
    );
  }
  return lines.join(' ');
}
