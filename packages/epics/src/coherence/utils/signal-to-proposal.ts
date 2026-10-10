import { RESUBMIT_PROPOSAL_DATA_KEY } from '../../utils/resubmit-proposal-template';

export type SignalProposalPayout = {
  amount: string;
  token: string;
};

/**
 * Open the contribution proposal form with this signal's title, description,
 * and indicative amounts already filled. The proposal is what can move funds;
 * the signal amounts stay indicative until then.
 */
export function stageSignalAsContributionProposal(input: {
  title: string;
  description: string;
  payouts: SignalProposalPayout[];
  leadImage?: string | null;
  attachments?: Array<{ name: string; url: string }>;
}): void {
  if (typeof window === 'undefined') return;
  const payouts = input.payouts.filter(
    (row) => row.amount.trim().length > 0 && row.token.trim().length > 0,
  );
  sessionStorage.setItem(
    RESUBMIT_PROPOSAL_DATA_KEY,
    JSON.stringify({
      resubmitTemplateSegment: 'propose-contribution',
      title: input.title,
      description: input.description,
      ...(input.leadImage ? { leadImage: input.leadImage } : {}),
      ...(input.attachments && input.attachments.length > 0
        ? { attachments: input.attachments }
        : {}),
      proposeContributionForm: {
        payouts: payouts.length > 0 ? payouts : [{ amount: '', token: '' }],
      },
      applied: false,
    }),
  );
}
