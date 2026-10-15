interface ProposalEmailLinks {
  /** CTA target (proposal page). */
  url?: string;
  /** Footer "manage notification settings" link. */
  settingsUrl?: string;
  /** App origin for the hosted logo. */
  appUrl?: string;
}

export interface ProposalSettlementProps extends ProposalEmailLinks {
  creatorName?: string;
  proposalLabel?: string;
  proposalState?: string;
  proposalTitle?: string;
  spaceTitle?: string;
}

export interface ProposalCreationProps extends ProposalEmailLinks {
  creatorName?: string;
  proposalLabel?: string;
  proposalState?: string;
  proposalTitle?: string;
  spaceTitle?: string;
  spaceSlug?: string;
}
