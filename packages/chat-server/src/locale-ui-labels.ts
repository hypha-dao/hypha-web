import {
  getLocaleMessagesSync,
  resolveLocale,
} from '@hypha-platform/i18n/messages';
import type { Locale } from '@hypha-platform/i18n/routing';
import { truncateProposalTitle } from './proposal-title-limits';

export type EntryMethodId = 'open_access' | 'invite_only' | 'token_based';
export type VotingMethodId = '1m1v' | '1v1v' | '1t1v';

export type LocalizedEntryMethodOption = {
  id: EntryMethodId;
  label: string;
  description: string;
};

export type LocalizedVotingMethodOption = {
  id: VotingMethodId;
  label: string;
  description: string;
};

const CHAT_LOCALES: readonly Locale[] = ['en', 'pt', 'es', 'fr', 'de', 'mk'];

const ENTRY_METHOD_IDS: readonly EntryMethodId[] = [
  'open_access',
  'invite_only',
  'token_based',
];

const VOTING_METHOD_IDS: readonly VotingMethodId[] = ['1m1v', '1v1v', '1t1v'];

const ENTRY_METHOD_MESSAGE_KEYS: Record<
  EntryMethodId,
  { title: string; description: string }
> = {
  open_access: {
    title: 'openAccessTitle',
    description: 'openAccessDescription',
  },
  invite_only: {
    title: 'inviteRequestTitle',
    description: 'inviteRequestDescription',
  },
  token_based: {
    title: 'tokenBasedTitle',
    description: 'tokenBasedDescription',
  },
};

const VOTING_METHOD_MESSAGE_KEYS: Record<
  VotingMethodId,
  { title: string; description: string }
> = {
  '1m1v': {
    title: 'oneMemberOneVoteTitle',
    description: 'oneMemberOneVoteDescription',
  },
  '1v1v': {
    title: 'oneVoiceOneVoteTitle',
    description: 'oneVoiceOneVoteDescription',
  },
  '1t1v': {
    title: 'oneTokenOneVoteTitle',
    description: 'oneTokenOneVoteDescription',
  },
};

const ENTRY_METHOD_EXTRA_PATTERNS: Record<EntryMethodId, readonly string[]> = {
  open_access: ['open access'],
  invite_only: ['invite request', 'invite-only', 'invite only', 'invitation'],
  token_based: ['token based', 'token-based'],
};

const VOTING_METHOD_EXTRA_PATTERNS: Record<VotingMethodId, readonly string[]> =
  {
    '1m1v': ['one member one vote', 'one member, one vote', '1 member 1 vote'],
    '1v1v': [
      'one voice one vote',
      'one voice token, one vote',
      '1 voice 1 vote',
    ],
    '1t1v': ['one token one vote', 'one token, one vote', '1 token 1 vote'],
  };

const ENTRY_METHOD_PROPOSAL_TITLE: Record<Locale, (label: string) => string> = {
  en: (label) => `Change Entry Method to ${label}`,
  fr: (label) => `Changer la méthode d'entrée pour ${label}`,
  de: (label) => `Beitrittsmethode auf ${label} ändern`,
  es: (label) => `Cambiar el método de entrada a ${label}`,
  pt: (label) => `Alterar o método de entrada para ${label}`,
  mk: (label) => `Промени го начинот на пристапување во ${label}`,
};

const VOTING_METHOD_PROPOSAL_TITLE: Record<Locale, (label: string) => string> =
  {
    en: (label) => `Change Voting Method to ${label}`,
    fr: (label) => `Changer la méthode de vote pour ${label}`,
    de: (label) => `Abstimmungsmethode auf ${label} ändern`,
    es: (label) => `Cambiar el método de votación a ${label}`,
    pt: (label) => `Alterar o método de votação para ${label}`,
    mk: (label) => `Промени го начинот на гласање во ${label}`,
  };

type AgreementFlowPlugins = {
  entryMethod?: Record<string, string>;
  votingMethodSelector?: Record<string, string>;
};

function formatLocalizedProposalTitle(
  templates: Record<Locale, (label: string) => string>,
  locale: string | null | undefined,
  label: string,
): string {
  const code = resolveLocale(locale);
  return truncateProposalTitle((templates[code] ?? templates.en)(label));
}

function readAgreementFlowPlugins(
  locale?: string | null,
): AgreementFlowPlugins {
  const { messages } = getLocaleMessagesSync(locale);
  const agreementFlow = messages.AgreementFlow as
    | Record<string, unknown>
    | undefined;
  const plugins = agreementFlow?.plugins as AgreementFlowPlugins | undefined;
  return plugins ?? {};
}

function readPluginString(
  section: Record<string, string> | undefined,
  fallbackSection: Record<string, string> | undefined,
  key: string,
): string {
  const value = section?.[key] ?? fallbackSection?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function resolveChatLocale(options?: {
  locale?: string | null;
  conversationContext?: unknown;
}): string {
  if (options?.locale?.trim()) return options.locale.trim();
  if (
    options?.conversationContext &&
    typeof options.conversationContext === 'object'
  ) {
    const ctxLocale = (options.conversationContext as { locale?: unknown })
      .locale;
    if (typeof ctxLocale === 'string' && ctxLocale.trim()) {
      return ctxLocale.trim();
    }
  }
  return 'en';
}

export function getAgreementFlowEntryMethodOptions(
  locale?: string | null,
): readonly LocalizedEntryMethodOption[] {
  const entryMethod = readAgreementFlowPlugins(locale).entryMethod;
  const fallback = readAgreementFlowPlugins('en').entryMethod;
  return ENTRY_METHOD_IDS.map((id) => {
    const keys = ENTRY_METHOD_MESSAGE_KEYS[id];
    return {
      id,
      label: readPluginString(entryMethod, fallback, keys.title) || id,
      description:
        readPluginString(entryMethod, fallback, keys.description) || '',
    };
  });
}

export function getAgreementFlowVotingMethodOptions(
  locale?: string | null,
): readonly LocalizedVotingMethodOption[] {
  const votingMethod = readAgreementFlowPlugins(locale).votingMethodSelector;
  const fallback = readAgreementFlowPlugins('en').votingMethodSelector;
  return VOTING_METHOD_IDS.map((id) => {
    const keys = VOTING_METHOD_MESSAGE_KEYS[id];
    return {
      id,
      label: readPluginString(votingMethod, fallback, keys.title) || id,
      description:
        readPluginString(votingMethod, fallback, keys.description) || '',
    };
  });
}

export function getEntryMethodLabel(
  locale: string | null | undefined,
  id: EntryMethodId,
): string {
  return (
    getAgreementFlowEntryMethodOptions(locale).find(
      (option) => option.id === id,
    )?.label ?? id
  );
}

export function getVotingMethodLabel(
  locale: string | null | undefined,
  id: VotingMethodId,
): string {
  return (
    getAgreementFlowVotingMethodOptions(locale).find(
      (option) => option.id === id,
    )?.label ?? id
  );
}

export function getEnumFieldOptionsForLocale(
  locale?: string | null,
): Record<string, Record<string, string>> {
  const entryOptions = getAgreementFlowEntryMethodOptions(locale);
  const votingOptions = getAgreementFlowVotingMethodOptions(locale);
  return {
    voting_method: Object.fromEntries(
      votingOptions.map((option) => [option.id, option.label]),
    ),
    entry_method: Object.fromEntries(
      entryOptions.map((option) => [option.id, option.label]),
    ),
    token_type: {
      utility: 'Utility Token',
      credits: 'Credits',
      ownership: 'Ownership',
      voice: 'Voice',
      impact: 'Impact',
      community_currency: 'Community Currency',
    },
  };
}

export function buildEntryMethodProposalDraft(
  locale: string | null | undefined,
  methodId: EntryMethodId,
): { title: string; description: string } {
  const option = getAgreementFlowEntryMethodOptions(locale).find(
    (entry) => entry.id === methodId,
  );
  const label = option?.label ?? methodId;
  return {
    title: formatLocalizedProposalTitle(
      ENTRY_METHOD_PROPOSAL_TITLE,
      locale,
      label,
    ),
    description:
      option?.description ||
      `This proposal changes how people join the space to ${label}.`,
  };
}

export function buildVotingMethodProposalDraft(
  locale: string | null | undefined,
  methodId: VotingMethodId,
): { title: string; description: string } {
  const option = getAgreementFlowVotingMethodOptions(locale).find(
    (entry) => entry.id === methodId,
  );
  const label = option?.label ?? methodId;
  return {
    title: formatLocalizedProposalTitle(
      VOTING_METHOD_PROPOSAL_TITLE,
      locale,
      label,
    ),
    description:
      option?.description ||
      `This proposal changes how decisions are made to ${label}.`,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLabelPattern(
  ids: readonly string[],
  getLabels: (locale: Locale) => readonly { id: string; label: string }[],
  extraPatterns: Record<string, readonly string[]>,
): Record<string, RegExp> {
  const patterns: Record<string, RegExp> = {};
  for (const id of ids) {
    const variants = new Set<string>();
    for (const locale of CHAT_LOCALES) {
      for (const option of getLabels(locale)) {
        if (option.id === id && option.label.trim()) {
          variants.add(option.label.trim());
        }
      }
    }
    for (const extra of extraPatterns[id] ?? []) {
      variants.add(extra);
    }
    patterns[id] = new RegExp(
      `(?:${[...variants].map(escapeRegex).join('|')})`,
      'i',
    );
  }
  return patterns;
}

export function getEntryMethodInferencePatterns(): Record<string, RegExp> {
  return buildLabelPattern(
    ENTRY_METHOD_IDS,
    (locale) => getAgreementFlowEntryMethodOptions(locale),
    ENTRY_METHOD_EXTRA_PATTERNS,
  );
}

export function getVotingMethodInferencePatterns(): Record<string, RegExp> {
  return buildLabelPattern(
    VOTING_METHOD_IDS,
    (locale) => getAgreementFlowVotingMethodOptions(locale),
    VOTING_METHOD_EXTRA_PATTERNS,
  );
}
