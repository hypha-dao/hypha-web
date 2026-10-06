/**
 * Pure content-selection for `proposal.accepted` / `proposal.rejected` — no DB/web3 imports.
 * Plain (locally rendered) content, matching the webhook routes this replaced.
 */
import { TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED } from '../../constants';
import type { ContentBuilder } from '../../core/content-builder';
import type { Recipient } from '../../core/types';
import {
  emailProposalExecutionForCreator,
  emailProposalExecutionForMembers,
  emailProposalRejectionForCreator,
  emailProposalRejectionForMembers,
  pushProposalExecutionForCreator,
  pushProposalExecutionForMembers,
  pushProposalRejectionForCreator,
  pushProposalRejectionForMembers,
} from '../../template';
import type { ProposalSettlementEvent } from './resolver';

function settlementProps(recipient: Recipient) {
  return {
    proposalTitle: recipient.data?.proposalTitle as string | undefined,
    proposalLabel: recipient.data?.proposalLabel as string | undefined,
    proposalState: recipient.data?.proposalState as string | undefined,
    spaceTitle: recipient.data?.spaceTitle as string | undefined,
  };
}

export const buildProposalSettlementContent: ContentBuilder<
  ProposalSettlementEvent
> = (event, recipient) => {
  const isCreator = recipient.role === 'creator';
  const props = settlementProps(recipient);

  const [emailForCreator, emailForMembers, pushForCreator, pushForMembers] =
    event.type === 'proposal.accepted'
      ? [
          emailProposalExecutionForCreator,
          emailProposalExecutionForMembers,
          pushProposalExecutionForCreator,
          pushProposalExecutionForMembers,
        ]
      : [
          emailProposalRejectionForCreator,
          emailProposalRejectionForMembers,
          pushProposalRejectionForCreator,
          pushProposalRejectionForMembers,
        ];

  const email = isCreator ? emailForCreator(props) : emailForMembers(props);
  const push = isCreator ? pushForCreator(props) : pushForMembers(props);

  return {
    channels: ['push', 'email'],
    requiredTags: { [TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED]: 'true' },
    content: {
      push: { kind: 'plain', contents: push.contents, headings: push.headings },
      email: { kind: 'plain', subject: email.subject, body: email.body },
    },
  };
};
