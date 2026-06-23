/**
 * AI-facing proposal type metadata — derived from the canonical proposal catalog.
 * When adding/updating proposal routes, update `proposal-catalog/entries.ts` first.
 */
import { PROPOSAL_CATALOG, PROPOSAL_CATALOG_KEYS } from './proposal-catalog';

export type AiCreatableProposalType = (typeof PROPOSAL_CATALOG_KEYS)[number];

export type AiProposalTypeConfig = {
  documentLabel: string;
  summary: string;
  aiWalletExecutable: boolean;
  createPath: string;
  prepareStrategy: string;
  onChain: boolean;
};

export const AI_CREATABLE_PROPOSAL_TYPES = Object.fromEntries(
  PROPOSAL_CATALOG_KEYS.map((key) => {
    const entry = PROPOSAL_CATALOG[key]!;
    return [
      key,
      {
        documentLabel: entry.documentLabel,
        summary: entry.summary,
        aiWalletExecutable:
          entry.prepareStrategy === 'create_space_setup_proposal',
        createPath: entry.createPath,
        prepareStrategy: entry.prepareStrategy,
        onChain: entry.onChain,
      },
    ];
  }),
) as Record<AiCreatableProposalType, AiProposalTypeConfig>;

export const aiCreatableProposalTypeSchema = [...PROPOSAL_CATALOG_KEYS] as [
  AiCreatableProposalType,
  ...AiCreatableProposalType[],
];

export const collectiveAgreementOnlySchema = ['collective_agreement'] as const;

export function buildAiProposalTypePromptLines(): string {
  return PROPOSAL_CATALOG_KEYS.map((key) => {
    const entry = PROPOSAL_CATALOG[key]!;
    const flow =
      entry.prepareStrategy === 'prepare_governance_proposal'
        ? ' (proposal_guidance → prepare_governance_proposal → Publish in Agreements)'
        : entry.prepareStrategy === 'create_space_setup_proposal'
        ? ' (collective agreement — create_space_setup_proposal after confirmation)'
        : ' (open Agreements form)';
    return `- ${key}: ${entry.documentLabel} — ${entry.summary}${flow}`;
  }).join('\n');
}

export function resolveAiProposalTypeConfig(
  type: AiCreatableProposalType,
): AiProposalTypeConfig {
  const config = AI_CREATABLE_PROPOSAL_TYPES[type];
  if (!config) {
    throw new Error(`Unknown proposal type: ${type}`);
  }
  return config;
}
