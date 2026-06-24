/** Same three entry options as AgreementFlow / onboarding entry method card. */

import {
  getAgreementFlowEntryMethodOptions,
  type EntryMethodId,
  type LocalizedEntryMethodOption,
} from '../locale-ui-labels';

export type OnboardingEntryMethodId = EntryMethodId;

export type OnboardingEntryMethodOption = LocalizedEntryMethodOption;

export const ONBOARDING_ENTRY_METHOD_OPTIONS: readonly OnboardingEntryMethodOption[] =
  getAgreementFlowEntryMethodOptions('en');

export const ONBOARDING_ENTRY_METHOD_LABELS =
  ONBOARDING_ENTRY_METHOD_OPTIONS.map((option) => option.label);

export function buildOnboardingEntryMethodGuidelines(
  locale?: string | null,
): string {
  const options = getAgreementFlowEntryMethodOptions(locale);
  const titles = options.map((option) => option.label).join(', ');
  const middleOption = options.find((option) => option.id === 'invite_only');
  const tokenBasedOption = options.find(
    (option) => option.id === 'token_based',
  );
  return `Entry method (onboarding — same options as the entry method card and governance forms):
- ONLY three allowed choices — use these exact titles with users: ${titles}.
- Never say invite-only, request access, token-based entry, token-gated, or generic "open access" without the ${
    options[0]?.label ?? 'Open Access'
  } title. The middle option is ${
    middleOption?.label ?? 'Invite Request'
  } (not "invite-only" or "request access").
- User picks with the entry method card in the panel—ask one short question; do not invent alternate labels or comma-separated option lists.
- ${
    tokenBasedOption?.label ?? 'Token Based'
  } requires creating a membership token after the space is created.`;
}

export const ONBOARDING_ENTRY_METHOD_GUIDELINES =
  buildOnboardingEntryMethodGuidelines('en');

export function formatEntryMethodOptionsForAssistant(
  locale?: string | null,
): string {
  return getAgreementFlowEntryMethodOptions(locale)
    .map((option) => `- ${option.label}: ${option.description}`)
    .join('\n');
}

export function buildEntryMethodAssistantInstruction(
  locale?: string | null,
  warnOpenAccessWithPrivateDiscoverability = false,
): string {
  const options = getAgreementFlowEntryMethodOptions(locale);
  const lines = [
    'Ask only the next_question in one short sentence.',
    `The user chooses with the entry method card below. Use ONLY these exact option titles—never invite-only, request access, or token-based entry:`,
    formatEntryMethodOptionsForAssistant(locale),
    'Do not enumerate options as a comma-separated list in prose. In voice mode, give a one-sentence overview and invite them to use the card on screen.',
    `${
      options.find((option) => option.id === 'token_based')?.label ??
      'Token Based'
    } requires creating a membership token after the space is created.`,
  ];
  if (warnOpenAccessWithPrivateDiscoverability) {
    lines.push(
      `If they pick ${
        options.find((option) => option.id === 'open_access')?.label ??
        'Open Access'
      }, flag warmly that Organisation or Space discoverability makes it hard for newcomers to find the space—offer Public or Network discoverability or ${
        options.find((option) => option.id === 'invite_only')?.label ??
        'Invite Request'
      } / ${
        options.find((option) => option.id === 'token_based')?.label ??
        'Token Based'
      } instead.`,
    );
  }
  return lines.join(' ');
}
