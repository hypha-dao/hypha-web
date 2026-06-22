/**
 * Proposal types exposed in Agreements → New proposal (select-create-action).
 * `documentLabel` must match the `label` stored on governance documents.
 */
export const AI_CREATABLE_PROPOSAL_TYPES = {
  collective_agreement: {
    documentLabel: 'Collective Agreement',
    summary:
      'Record a collective decision, policy, or general governance agreement.',
    aiWalletExecutable: true,
    createPath: 'agreements/create',
  },
  contribution: {
    documentLabel: 'Contribution',
    summary:
      'Pay a member for a contribution (requires recipient wallet and token payouts).',
    aiWalletExecutable: false,
    createPath: 'agreements/create/propose-contribution',
  },
  redeem_tokens: {
    documentLabel: 'Redeem Tokens',
    summary: 'Redeem space tokens for backing collateral.',
    aiWalletExecutable: false,
    createPath: 'agreements/create/redeem-tokens',
  },
  pay_expenses: {
    documentLabel: 'Expenses',
    summary: 'Pay an expense from the space treasury.',
    aiWalletExecutable: false,
    createPath: 'agreements/create/pay-for-expenses',
  },
  accept_investment: {
    documentLabel: 'Investment',
    summary: 'Accept an investment into the space on defined terms.',
    aiWalletExecutable: false,
    createPath: 'agreements/create/accept-investment',
  },
  exchange: {
    documentLabel: 'Exchange',
    summary: 'Exchange stakes and tokens between parties.',
    aiWalletExecutable: false,
    createPath: 'agreements/create/exchange-stakes-and-tokens',
  },
  deploy_funds: {
    documentLabel: 'Funding',
    summary: 'Deploy or allocate treasury funds.',
    aiWalletExecutable: false,
    createPath: 'agreements/create/deploy-funds',
  },
  airdrop: {
    documentLabel: 'Airdrop',
    summary: 'Distribute tokens to multiple recipients.',
    aiWalletExecutable: false,
    createPath: 'agreements/create/airdrop',
  },
  space_transparency: {
    documentLabel: 'Space Transparency',
    summary:
      'Change on-chain discoverability (who can find the space) and activity access (who can view space activity). Requires member vote after proposal creation.',
    aiWalletExecutable: false,
    createPath: 'agreements/create/space-settings-transparency',
  },
} as const;

export type AiCreatableProposalType = keyof typeof AI_CREATABLE_PROPOSAL_TYPES;

export const aiCreatableProposalTypeSchema = [
  'collective_agreement',
  'contribution',
  'redeem_tokens',
  'pay_expenses',
  'accept_investment',
  'exchange',
  'deploy_funds',
  'airdrop',
  'space_transparency',
] as const;

export function buildAiProposalTypePromptLines(): string {
  return Object.entries(AI_CREATABLE_PROPOSAL_TYPES)
    .map(
      ([key, config]) =>
        `- ${key}: ${config.documentLabel} — ${config.summary}${
          config.aiWalletExecutable
            ? ' (executable in chat after wallet signature)'
            : ' (open Agreements form for required fields)'
        }`,
    )
    .join('\n');
}

export function resolveAiProposalTypeConfig(type: AiCreatableProposalType) {
  return AI_CREATABLE_PROPOSAL_TYPES[type];
}
