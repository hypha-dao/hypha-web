import type { AiCreatableProposalType } from './ai-proposal-types';

export type ProposalGuidanceField = {
  key: string;
  label: string;
  required: boolean;
  description: string;
};

export type ProposalGuidancePlaybook = {
  proposal_type: AiCreatableProposalType;
  document_label: string;
  create_path: string;
  summary: string;
  discovery_intro: string;
  required_fields: ProposalGuidanceField[];
  optional_fields: ProposalGuidanceField[];
  publish_flow: string;
  do_not_use: string[];
};

export const PROPOSAL_GUIDANCE_PLAYBOOKS: Record<
  AiCreatableProposalType,
  ProposalGuidancePlaybook
> = {
  change_voting_method: {
    proposal_type: 'change_voting_method',
    document_label: 'Voting Method',
    create_path: 'agreements/create/change-voting-method',
    summary: 'Change how this space counts votes on proposals.',
    discovery_intro:
      'Before opening the form, confirm which voting model the space should use and whether quorum/unity should change.',
    required_fields: [
      {
        key: 'voting_method',
        label: 'Voting method',
        required: true,
        description:
          'One of 1m1v (one member, one vote), 1v1v (one voice token, one vote), or 1t1v (one governance token, one vote).',
      },
      {
        key: 'title',
        label: 'Proposal title',
        required: true,
        description: 'Short title shown in Agreements.',
      },
      {
        key: 'description',
        label: 'Proposal description',
        required: true,
        description: 'Plain-language rationale for the change.',
      },
    ],
    optional_fields: [
      {
        key: 'quorum_percent',
        label: 'Quorum (%)',
        required: false,
        description:
          'Minimum participation required. Omit to keep current on-chain values.',
      },
      {
        key: 'unity_percent',
        label: 'Unity (%)',
        required: false,
        description:
          'Minimum approval required. Omit to keep current on-chain values.',
      },
      {
        key: 'auto_execution',
        label: 'Auto-execution',
        required: false,
        description:
          'Whether the proposal executes automatically when voting ends.',
      },
      {
        key: 'voting_duration_seconds',
        label: 'Voting duration (seconds)',
        required: false,
        description: 'Required when auto_execution is false.',
      },
    ],
    publish_flow:
      'Call prepare_governance_proposal with collected answers. The app opens Agreements with the form pre-filled — the member clicks Publish (no in-chat wallet signing).',
    do_not_use: [
      'create_space_setup_proposal with collective_agreement',
      'create_space_setup_proposal with change_voting_method (use prepare_governance_proposal instead)',
    ],
  },
  change_entry_method: {
    proposal_type: 'change_entry_method',
    document_label: 'Entry Method',
    create_path: 'agreements/create/change-entry-method',
    summary: 'Change how people join the space.',
    discovery_intro:
      'Confirm whether join should be open access, invite/request only, or token-based (membership token).',
    required_fields: [
      {
        key: 'entry_method',
        label: 'Entry method',
        required: true,
        description:
          'open_access, invite_only, or token_based. Token-based may require a membership token address.',
      },
      {
        key: 'title',
        label: 'Proposal title',
        required: true,
        description: 'Short title shown in Agreements.',
      },
      {
        key: 'description',
        label: 'Proposal description',
        required: true,
        description: 'Plain-language rationale for the change.',
      },
    ],
    optional_fields: [
      {
        key: 'token_address',
        label: 'Membership token address',
        required: false,
        description:
          'Required for token_based entry when a token is already issued.',
      },
    ],
    publish_flow:
      'Call prepare_governance_proposal after discovery. Member reviews the form and clicks Publish.',
    do_not_use: ['create_space_setup_proposal with collective_agreement'],
  },
  space_transparency: {
    proposal_type: 'space_transparency',
    document_label: 'Space Transparency',
    create_path: 'agreements/create/space-settings-transparency',
    summary: 'Change discoverability and activity access on-chain.',
    discovery_intro:
      'Ask discoverability and activity access separately (Public, Network, Organisation, Space).',
    required_fields: [
      {
        key: 'space_discoverability',
        label: 'Discoverability level',
        required: true,
        description: 'Integer 0 (public) through 3 (space-only).',
      },
      {
        key: 'space_activity_access',
        label: 'Activity access level',
        required: true,
        description: 'Integer 0 (public) through 3 (space-only).',
      },
      {
        key: 'title',
        label: 'Proposal title',
        required: true,
        description: 'Short title shown in Agreements.',
      },
      {
        key: 'description',
        label: 'Proposal description',
        required: true,
        description: 'Plain-language rationale for the change.',
      },
    ],
    optional_fields: [],
    publish_flow:
      'Call prepare_governance_proposal, then member clicks Publish in Agreements.',
    do_not_use: ['update_space_settings for transparency'],
  },
  collective_agreement: {
    proposal_type: 'collective_agreement',
    document_label: 'Collective Agreement',
    create_path: 'agreements/create',
    summary:
      'Record a general policy or decision (not voting/entry/transparency setup).',
    discovery_intro:
      'Confirm title and description only — no extra typed fields.',
    required_fields: [
      {
        key: 'title',
        label: 'Title',
        required: true,
        description: 'Proposal title.',
      },
      {
        key: 'description',
        label: 'Description',
        required: true,
        description: 'Full agreement text.',
      },
    ],
    optional_fields: [],
    publish_flow:
      'create_space_setup_proposal with collective_agreement after confirmation, then wallet signature in chat OR Agreements Publish depending on session.',
    do_not_use: [
      'collective_agreement for voting method or entry method changes',
    ],
  },
  contribution: {
    proposal_type: 'contribution',
    document_label: 'Contribution',
    create_path: 'agreements/create/propose-contribution',
    summary: 'Pay a member for a contribution.',
    discovery_intro:
      'Collect recipient, token payouts, and work description before opening the form.',
    required_fields: [
      {
        key: 'title',
        label: 'Title',
        required: true,
        description: 'Proposal title.',
      },
      {
        key: 'description',
        label: 'Description',
        required: true,
        description: 'What was contributed and why it should be paid.',
      },
    ],
    optional_fields: [],
    publish_flow:
      'prepare_governance_proposal when supported; otherwise mcp_navigation to the form.',
    do_not_use: [],
  },
  redeem_tokens: {
    proposal_type: 'redeem_tokens',
    document_label: 'Redeem Tokens',
    create_path: 'agreements/create/redeem-tokens',
    summary: 'Redeem tokens for backing collateral.',
    discovery_intro: 'Collect token, amount, and redemption details.',
    required_fields: [
      { key: 'title', label: 'Title', required: true, description: '' },
      {
        key: 'description',
        label: 'Description',
        required: true,
        description: '',
      },
    ],
    optional_fields: [],
    publish_flow:
      'mcp_navigation to agreements/create/redeem-tokens after discovery.',
    do_not_use: [],
  },
  pay_expenses: {
    proposal_type: 'pay_expenses',
    document_label: 'Expenses',
    create_path: 'agreements/create/pay-for-expenses',
    summary: 'Pay an expense from treasury.',
    discovery_intro: 'Collect recipient, amount, token, and expense purpose.',
    required_fields: [
      { key: 'title', label: 'Title', required: true, description: '' },
      {
        key: 'description',
        label: 'Description',
        required: true,
        description: '',
      },
    ],
    optional_fields: [],
    publish_flow:
      'mcp_navigation to agreements/create/pay-for-expenses after discovery.',
    do_not_use: [],
  },
  accept_investment: {
    proposal_type: 'accept_investment',
    document_label: 'Investment',
    create_path: 'agreements/create/accept-investment',
    summary: 'Accept an investment on defined terms.',
    discovery_intro: 'Collect investor, terms, and amounts.',
    required_fields: [
      { key: 'title', label: 'Title', required: true, description: '' },
      {
        key: 'description',
        label: 'Description',
        required: true,
        description: '',
      },
    ],
    optional_fields: [],
    publish_flow:
      'mcp_navigation to agreements/create/accept-investment after discovery.',
    do_not_use: [],
  },
  exchange: {
    proposal_type: 'exchange',
    document_label: 'Exchange',
    create_path: 'agreements/create/exchange-stakes-and-tokens',
    summary: 'Exchange stakes and tokens between parties.',
    discovery_intro: 'Collect both legs of the exchange.',
    required_fields: [
      { key: 'title', label: 'Title', required: true, description: '' },
      {
        key: 'description',
        label: 'Description',
        required: true,
        description: '',
      },
    ],
    optional_fields: [],
    publish_flow:
      'mcp_navigation to agreements/create/exchange-stakes-and-tokens.',
    do_not_use: [],
  },
  deploy_funds: {
    proposal_type: 'deploy_funds',
    document_label: 'Funding',
    create_path: 'agreements/create/deploy-funds',
    summary: 'Deploy or allocate treasury funds.',
    discovery_intro: 'Collect recipient, token, and allocation purpose.',
    required_fields: [
      { key: 'title', label: 'Title', required: true, description: '' },
      {
        key: 'description',
        label: 'Description',
        required: true,
        description: '',
      },
    ],
    optional_fields: [],
    publish_flow: 'mcp_navigation to agreements/create/deploy-funds.',
    do_not_use: [],
  },
  airdrop: {
    proposal_type: 'airdrop',
    document_label: 'Airdrop',
    create_path: 'agreements/create/airdrop',
    summary: 'Distribute tokens to multiple recipients.',
    discovery_intro: 'Collect token, recipients, and amounts.',
    required_fields: [
      { key: 'title', label: 'Title', required: true, description: '' },
      {
        key: 'description',
        label: 'Description',
        required: true,
        description: '',
      },
    ],
    optional_fields: [],
    publish_flow: 'mcp_navigation to agreements/create/airdrop.',
    do_not_use: [],
  },
};

export function getProposalGuidancePlaybook(
  proposalType: AiCreatableProposalType,
): ProposalGuidancePlaybook {
  return PROPOSAL_GUIDANCE_PLAYBOOKS[proposalType];
}

export function buildProposalGuidancePromptLines(): string {
  return Object.values(PROPOSAL_GUIDANCE_PLAYBOOKS)
    .filter(
      (p) =>
        p.proposal_type === 'change_voting_method' ||
        p.proposal_type === 'change_entry_method' ||
        p.proposal_type === 'space_transparency',
    )
    .map(
      (p) =>
        `- ${p.proposal_type}: ask ${p.required_fields
          .map((f) => f.key)
          .join(', ')} → prepare_governance_proposal → Publish in Agreements`,
    )
    .join('\n');
}
