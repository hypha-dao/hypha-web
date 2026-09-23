/**
 * Pure content-selection for `proposal.created` — no DB/web3 imports, so it's cheap to unit test
 * in isolation from `resolver.ts` (which does the actual DB/web3 lookups). Plain (locally
 * rendered) content, not an OneSignal dashboard template — matches the webhook route this
 * replaced.
 */
import { TAG_SUB_NEW_PROPOSAL_OPEN } from '../../constants';
import type { ContentBuilder } from '../../core/content-builder';
import type { ProposalCreatedEvent } from '../../core/types';
import {
  emailProposalCreationForCreator,
  emailProposalCreationForMembers,
  pushProposalCreationForCreator,
  pushProposalCreationForMembers,
} from '../../template';

export const buildProposalCreatedContent: ContentBuilder<
  ProposalCreatedEvent
> = (event, recipient) => {
  const { proposalLabel } = event.payload;
  const spaceTitle = recipient.data?.spaceTitle as string | undefined;
  const isCreator = recipient.role === 'creator';
  // Creator's own template addresses them by name (`recipient.displayName`); the members'
  // template names *who created it*, carried on `data.creatorName` by the resolver.
  const creatorName = isCreator
    ? recipient.displayName
    : (recipient.data?.creatorName as string | undefined);

  const props = { creatorName, proposalLabel, spaceTitle };
  const email = isCreator
    ? emailProposalCreationForCreator(props)
    : emailProposalCreationForMembers(props);
  const push = isCreator
    ? pushProposalCreationForCreator(props)
    : pushProposalCreationForMembers(props);

  return {
    channels: ['push', 'email'],
    requiredTags: { [TAG_SUB_NEW_PROPOSAL_OPEN]: 'true' },
    content: {
      push: { kind: 'plain', contents: push.contents, headings: push.headings },
      email: { kind: 'plain', subject: email.subject, body: email.body },
    },
  };
};
