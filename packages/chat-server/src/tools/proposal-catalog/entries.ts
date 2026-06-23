import type { CatalogDiscoveryField, ProposalCatalogEntry } from './types';

const titleField: CatalogDiscoveryField = {
  key: 'title',
  label: 'Proposal title',
  required: true,
  description:
    'What short title should appear on this proposal? Propose a draft from context; ask the user to confirm or edit.',
  fieldType: 'string',
  formSection: 'basics',
};

const descriptionField: CatalogDiscoveryField = {
  key: 'description',
  label: 'Proposal description',
  required: true,
  description:
    'Propose a plain-language rationale and key details from space context; ask the user to confirm or edit.',
  fieldType: 'string',
  formSection: 'basics',
};

const governancePluginFields: CatalogDiscoveryField[] = [
  {
    key: 'auto_execution',
    label: 'Auto-execution',
    required: false,
    description: 'Execute automatically when voting ends.',
    fieldType: 'boolean',
    formSection: 'voting',
  },
  {
    key: 'voting_duration_seconds',
    label: 'Voting duration (seconds)',
    required: false,
    description: 'Required when auto_execution is false.',
    fieldType: 'number',
    formSection: 'voting',
  },
];

function entry(
  partial: Omit<
    ProposalCatalogEntry,
    'requiredFields' | 'optionalFields' | 'doNotUse'
  > & {
    requiredFields?: CatalogDiscoveryField[];
    optionalFields?: CatalogDiscoveryField[];
    doNotUse?: string[];
  },
): ProposalCatalogEntry {
  return {
    requiredFields: [titleField, descriptionField],
    optionalFields: [],
    doNotUse: [],
    ...partial,
  };
}

/** All on-chain governance proposals (Create proposal + Space settings). Excludes space configuration. */
export const PROPOSAL_CATALOG: Record<string, ProposalCatalogEntry> = {
  collective_agreement: entry({
    key: 'collective_agreement',
    documentLabel: 'Collective Agreement',
    templateSegment: '',
    createPath: 'agreements/create',
    summary: 'Record a general policy or collective decision.',
    source: 'create_proposal',
    prepareStrategy: 'create_space_setup_proposal',
    onChain: true,
    discoveryIntro:
      'Confirm title and description. No extra typed fields — not for voting/entry/transparency changes.',
    doNotUse: [
      'Using for voting method, entry method, or transparency changes',
    ],
  }),

  change_voting_method: entry({
    key: 'change_voting_method',
    documentLabel: 'Voting Method',
    templateSegment: 'change-voting-method',
    createPath: 'agreements/create/change-voting-method',
    summary: 'Change how decisions are voted on.',
    source: 'both',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro:
      'Ask which voting model the space should use, then optional quorum/unity changes.',
    requiredFields: [
      {
        key: 'voting_method',
        label: 'Voting method',
        required: true,
        description:
          'Propose how decisions should be made (one person one vote, voice-weighted, or token-weighted) with a brief why — ask if that fits. Never say "voting method" or read codes aloud.',
        fieldType: 'enum',
        enumValues: ['1m1v', '1v1v', '1t1v'],
        formSection: 'voting_method',
      },
      titleField,
      descriptionField,
    ],
    optionalFields: [
      {
        key: 'quorum_percent',
        label: 'Quorum (%)',
        required: false,
        description: 'Omit to keep current on-chain quorum.',
        fieldType: 'percent',
        formSection: 'quorum_unity',
      },
      {
        key: 'unity_percent',
        label: 'Unity (%)',
        required: false,
        description: 'Omit to keep current on-chain unity.',
        fieldType: 'percent',
        formSection: 'quorum_unity',
      },
      ...governancePluginFields,
    ],
    doNotUse: ['create_space_setup_proposal with collective_agreement'],
  }),

  change_entry_method: entry({
    key: 'change_entry_method',
    documentLabel: 'Entry Method',
    templateSegment: 'change-entry-method',
    createPath: 'agreements/create/change-entry-method',
    summary: 'Change how people join the space.',
    source: 'both',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro:
      'Ask open access, invite/request only, or token-based membership.',
    requiredFields: [
      {
        key: 'entry_method',
        label: 'Entry method',
        required: true,
        description:
          'Propose how people should join (open to all, invite-only, or token-gated) with a brief why — ask if that works. Never say "entry method".',
        fieldType: 'enum',
        enumValues: ['open_access', 'invite_only', 'token_based'],
        formSection: 'entry_method',
      },
      titleField,
      descriptionField,
    ],
    optionalFields: [
      {
        key: 'token_address',
        label: 'Membership token address',
        required: false,
        description: 'Required for token_based when a token exists.',
        fieldType: 'address',
        formSection: 'entry_method',
      },
      ...governancePluginFields,
    ],
    doNotUse: ['create_space_setup_proposal with collective_agreement'],
  }),

  space_transparency: entry({
    key: 'space_transparency',
    documentLabel: 'Space Transparency',
    templateSegment: 'space-settings-transparency',
    createPath: 'agreements/create/space-settings-transparency',
    summary: 'Change discoverability and activity access on-chain.',
    source: 'both',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro:
      'Ask discoverability and activity access separately (0 public … 3 space-only).',
    requiredFields: [
      titleField,
      descriptionField,
      {
        key: 'space_discoverability',
        label: 'Discoverability level',
        required: true,
        description: 'Integer 0–3.',
        fieldType: 'number',
        formSection: 'transparency',
      },
      {
        key: 'space_activity_access',
        label: 'Activity access level',
        required: true,
        description: 'Integer 0–3.',
        fieldType: 'number',
        formSection: 'transparency',
      },
    ],
    doNotUse: ['update_space_settings'],
  }),

  contribution: entry({
    key: 'contribution',
    documentLabel: 'Contribution',
    templateSegment: 'propose-contribution',
    createPath: 'agreements/create/propose-contribution',
    summary: 'Pay a member for a contribution.',
    source: 'create_proposal',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro:
      'Collect recipient, token payout(s), and work description before opening the form.',
    optionalFields: [
      {
        key: 'recipient',
        label: 'Recipient address',
        required: false,
        description: 'Member wallet to pay.',
        fieldType: 'address',
        formSection: 'payouts',
      },
      {
        key: 'propose_contribution_form',
        label: 'Payout details',
        required: false,
        description: 'Nested recipient/payouts object for the form.',
        fieldType: 'string',
        formSection: 'payouts',
      },
      ...governancePluginFields,
    ],
  }),

  pay_expenses: entry({
    key: 'pay_expenses',
    documentLabel: 'Expenses',
    templateSegment: 'pay-for-expenses',
    createPath: 'agreements/create/pay-for-expenses',
    summary: 'Pay an expense from treasury.',
    source: 'create_proposal',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect recipient, amount, token, and expense purpose.',
    optionalFields: [
      {
        key: 'pay_for_expenses_form',
        label: 'Expense payout details',
        required: false,
        description: 'Nested recipient/payouts for the form.',
        fieldType: 'string',
        formSection: 'payouts',
      },
      ...governancePluginFields,
    ],
  }),

  deploy_funds: entry({
    key: 'deploy_funds',
    documentLabel: 'Funding',
    templateSegment: 'deploy-funds',
    createPath: 'agreements/create/deploy-funds',
    summary: 'Deploy or allocate treasury funds.',
    source: 'create_proposal',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect recipient, allocation amounts, and purpose.',
    optionalFields: [
      {
        key: 'deploy_funds_form',
        label: 'Funding allocation details',
        required: false,
        description: 'Nested recipient/payouts for the form.',
        fieldType: 'string',
        formSection: 'payouts',
      },
      ...governancePluginFields,
    ],
  }),

  accept_investment: entry({
    key: 'accept_investment',
    documentLabel: 'Investment',
    templateSegment: 'accept-investment',
    createPath: 'agreements/create/accept-investment',
    summary: 'Accept an investment on defined terms.',
    source: 'create_proposal',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect investor, terms, and payment legs.',
    optionalFields: [
      {
        key: 'recipient',
        label: 'Investor recipient',
        required: false,
        fieldType: 'address',
        formSection: 'investment',
      },
      {
        key: 'investor_send_legs',
        label: 'Investor send legs',
        required: false,
        fieldType: 'string',
        formSection: 'investment',
      },
      {
        key: 'space_receive_legs',
        label: 'Space receive legs',
        required: false,
        fieldType: 'string',
        formSection: 'investment',
      },
      ...governancePluginFields,
    ],
  }),

  exchange: entry({
    key: 'exchange',
    documentLabel: 'Exchange',
    templateSegment: 'exchange-stakes-and-tokens',
    createPath: 'agreements/create/exchange-stakes-and-tokens',
    summary: 'Exchange stakes and tokens between parties.',
    source: 'create_proposal',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect both sides of the exchange.',
    optionalFields: [
      {
        key: 'recipient',
        label: 'Counterparty',
        required: false,
        fieldType: 'address',
        formSection: 'exchange',
      },
      {
        key: 'investor_send_legs',
        label: 'Send legs',
        required: false,
        fieldType: 'string',
        formSection: 'exchange',
      },
      {
        key: 'space_receive_legs',
        label: 'Receive legs',
        required: false,
        fieldType: 'string',
        formSection: 'exchange',
      },
      ...governancePluginFields,
    ],
  }),

  airdrop: entry({
    key: 'airdrop',
    documentLabel: 'Airdrop',
    templateSegment: 'airdrop',
    createPath: 'agreements/create/airdrop',
    summary: 'Distribute tokens to multiple recipients.',
    source: 'create_proposal',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect token, recipients, and amounts.',
    optionalFields: [
      {
        key: 'members',
        label: 'Recipients',
        required: false,
        description: 'Array of { member, number } allocations.',
        fieldType: 'string',
        formSection: 'airdrop',
      },
      ...governancePluginFields,
    ],
  }),

  redeem_tokens: entry({
    key: 'redeem_tokens',
    documentLabel: 'Redeem Tokens',
    templateSegment: 'redeem-tokens',
    createPath: 'agreements/create/redeem-tokens',
    summary: 'Redeem tokens for backing collateral.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect token, amount, and redemption path.',
    optionalFields: [
      {
        key: 'redeem_resubmit',
        label: 'Redemption details',
        required: false,
        fieldType: 'string',
        formSection: 'redeem',
      },
      ...governancePluginFields,
    ],
  }),

  issue_new_token: entry({
    key: 'issue_new_token',
    documentLabel: 'Issue New Token',
    templateSegment: 'issue-new-token',
    createPath: 'agreements/create/issue-new-token',
    summary: 'Issue a new token for the space.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro:
      'Walk through token type, name, symbol, supply, and utility — use optional field prompts.',
    optionalFields: [
      {
        key: 'issue_new_token_form',
        label: 'Token configuration',
        required: false,
        fieldType: 'string',
        formSection: 'token_config',
      },
      ...governancePluginFields,
    ],
  }),

  update_issued_token: entry({
    key: 'update_issued_token',
    documentLabel: 'Update Token',
    templateSegment: 'update-issued-token',
    createPath: 'agreements/create/update-issued-token',
    summary: 'Update an existing issued token.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Identify token and fields to update.',
    optionalFields: [
      {
        key: 'update_issued_token_resubmit_payload',
        label: 'Token update payload',
        required: false,
        fieldType: 'string',
        formSection: 'token_config',
      },
      ...governancePluginFields,
    ],
  }),

  mint_tokens_to_space_treasury: entry({
    key: 'mint_tokens_to_space_treasury',
    documentLabel: 'Treasury Minting',
    templateSegment: 'mint-tokens-to-space-treasury',
    createPath: 'agreements/create/mint-tokens-to-space-treasury',
    summary: 'Mint tokens to the space treasury.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect token and amount to mint.',
    optionalFields: [
      {
        key: 'mint',
        label: 'Mint details',
        required: false,
        description: '{ amount, token }',
        fieldType: 'string',
        formSection: 'mint',
      },
      ...governancePluginFields,
    ],
  }),

  token_burning: entry({
    key: 'token_burning',
    documentLabel: 'Token Burning',
    templateSegment: 'token-burning',
    createPath: 'agreements/create/token-burning',
    summary: 'Burn space tokens.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect token and burn amounts.',
    optionalFields: [
      {
        key: 'token_burning',
        label: 'Burn details',
        required: false,
        fieldType: 'string',
        formSection: 'burn',
      },
      ...governancePluginFields,
    ],
  }),

  membership_exit: entry({
    key: 'membership_exit',
    documentLabel: 'Membership Exit',
    templateSegment: 'membership-exit',
    createPath: 'agreements/create/membership-exit',
    summary: 'Configure membership exit rules.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect exit method and affected members.',
    optionalFields: [...governancePluginFields],
  }),

  space_to_space_membership: entry({
    key: 'space_to_space_membership',
    documentLabel: 'Space To Space',
    templateSegment: 'space-to-space-membership',
    createPath: 'agreements/create/space-to-space-membership',
    summary: 'Link membership between spaces.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect target space and member addresses.',
    optionalFields: [
      {
        key: 'space_to_space_target_address',
        label: 'Target space address',
        required: false,
        fieldType: 'address',
        formSection: 'space_link',
      },
      {
        key: 'space_to_space_member_address',
        label: 'Member address',
        required: false,
        fieldType: 'address',
        formSection: 'space_link',
      },
      ...governancePluginFields,
    ],
  }),

  change_space_delegate: entry({
    key: 'change_space_delegate',
    documentLabel: 'Change Delegate',
    templateSegment: 'change-space-delegate',
    createPath: 'agreements/create/change-space-delegate',
    summary: 'Change who may delegate for the space.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect delegate target and member.',
    optionalFields: [
      {
        key: 'change_delegate_target_address',
        label: 'Delegate target',
        required: false,
        fieldType: 'address',
        formSection: 'delegate',
      },
      {
        key: 'change_delegate_member_address',
        label: 'Member address',
        required: false,
        fieldType: 'address',
        formSection: 'delegate',
      },
      ...governancePluginFields,
    ],
  }),

  token_backing_vault: entry({
    key: 'token_backing_vault',
    documentLabel: 'Backing Vault',
    templateSegment: 'token-backing-vault',
    createPath: 'agreements/create/token-backing-vault',
    summary: 'Configure token backing vault.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect vault token and backing parameters.',
    optionalFields: [
      {
        key: 'token_backing_vault',
        label: 'Vault configuration',
        required: false,
        fieldType: 'string',
        formSection: 'vault',
      },
      ...governancePluginFields,
    ],
  }),

  space_token_purchase: entry({
    key: 'space_token_purchase',
    documentLabel: 'Token Purchase',
    templateSegment: 'space-token-purchase',
    createPath: 'agreements/create/space-token-purchase',
    summary: 'Enable token purchase for the space.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect token, price, currency, and availability.',
    optionalFields: [
      {
        key: 'space_token_purchase_form',
        label: 'Purchase configuration',
        required: false,
        fieldType: 'string',
        formSection: 'purchase',
      },
      ...governancePluginFields,
    ],
  }),

  buy_hypha_tokens: entry({
    key: 'buy_hypha_tokens',
    documentLabel: 'Buy Hypha Tokens',
    templateSegment: 'buy-hypha-tokens',
    createPath: 'agreements/create/buy-hypha-tokens',
    summary: 'Buy Hypha tokens with treasury funds.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect amount and payment token.',
    optionalFields: [
      {
        key: 'buy_hypha_tokens_form',
        label: 'Purchase details',
        required: false,
        fieldType: 'string',
        formSection: 'purchase',
      },
      ...governancePluginFields,
    ],
  }),

  activate_spaces: entry({
    key: 'activate_spaces',
    documentLabel: 'Activate Spaces',
    templateSegment: 'activate-spaces',
    createPath: 'agreements/create/activate-spaces',
    summary: 'Activate child spaces in the ecosystem.',
    source: 'space_settings',
    prepareStrategy: 'prepare_governance_proposal',
    onChain: true,
    discoveryIntro: 'Collect which spaces to activate.',
    optionalFields: [...governancePluginFields],
  }),
};

export const PROPOSAL_CATALOG_KEYS = Object.keys(
  PROPOSAL_CATALOG,
) as (keyof typeof PROPOSAL_CATALOG)[];

export const PREPARE_GOVERNANCE_PROPOSAL_TYPES = PROPOSAL_CATALOG_KEYS.filter(
  (key) =>
    PROPOSAL_CATALOG[key]!.prepareStrategy === 'prepare_governance_proposal',
);
