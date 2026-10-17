/**
 * Pure content-selection for `proposal.created` — no DB/web3 imports, so it's cheap to unit test
 * in isolation from `resolver.ts` (which does the actual DB/web3 lookups). Email and push are
 * rendered in code (`template/`) - no OneSignal dashboard templates (#2549).
 */
import {
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_OWN_ACTIONS,
} from '../../constants';
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

  const url = recipient.data?.url as string | undefined;
  const props = {
    creatorName,
    proposalLabel,
    proposalTitle: recipient.data?.proposalTitle as string | undefined,
    spaceTitle,
    url,
    settingsUrl: recipient.data?.notificationSettingsUrl as string | undefined,
  };
  const email = isCreator
    ? emailProposalCreationForCreator(props)
    : emailProposalCreationForMembers(props);
  const push = isCreator
    ? pushProposalCreationForCreator(props)
    : pushProposalCreationForMembers(props);

  return {
    channels: ['push', 'email'],
    // the creator's own-action confirmation is its own group (#2549 D3/D9)
    requiredTags: [isCreator ? TAG_SUB_OWN_ACTIONS : TAG_SUB_NEW_PROPOSAL_OPEN],
    content: {
      push: {
        kind: 'plain',
        contents: push.contents,
        headings: push.headings,
        url,
      },
      email: {
        kind: 'plain',
        subject: email.subject,
        preheader: email.preheader,
        body: email.body,
      },
    },
  };
};
