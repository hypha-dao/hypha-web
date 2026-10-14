/**
 * Pure content-selection for `proposal.accepted` / `proposal.rejected` — no DB/web3 imports.
 * Email uses the OneSignal dashboard template when
 * `EMAIL_TEMPLATE_PROPOSAL_{ACCEPTED,REJECTED}_{CREATOR,MEMBERS}` is set, else the locally rendered
 * plain content (the fallback); push likewise uses
 * `PUSH_TEMPLATE_PROPOSAL_{ACCEPTED,REJECTED}_{CREATOR,MEMBERS}` when set, else plain.
 */
import { TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED } from '../../constants';
import type { ContentBuilder } from '../../core/content-builder';
import { resolveEmailTemplate } from '../../core/email-template';
import { resolvePushTemplate } from '../../core/push-template';
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
  const outcome = event.type === 'proposal.accepted' ? 'ACCEPTED' : 'REJECTED';
  const url = recipient.data?.url as string | undefined;
  const audience = isCreator ? 'CREATOR' : 'MEMBERS';
  const templatePush = resolvePushTemplate(
    `PUSH_TEMPLATE_PROPOSAL_${outcome}_${audience}`,
    {
      space_title: props.spaceTitle,
      proposal_title: props.proposalTitle,
      proposal_kind: props.proposalLabel,
      url,
    },
    url,
  );
  const templateEmail = resolveEmailTemplate(
    `EMAIL_TEMPLATE_PROPOSAL_${outcome}_${audience}`,
    {
      space_title: props.spaceTitle,
      proposal_title: props.proposalTitle,
      proposal_kind: props.proposalLabel,
      url,
      notification_settings_url: recipient.data?.notificationSettingsUrl as
        | string
        | undefined,
    },
  );
  const push = isCreator ? pushForCreator(props) : pushForMembers(props);

  return {
    channels: ['push', 'email'],
    requiredTags: [TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED],
    content: {
      push: templatePush ?? {
        kind: 'plain',
        contents: push.contents,
        headings: push.headings,
        url,
      },
      email: templateEmail ?? {
        kind: 'plain',
        subject: email.subject,
        body: email.body,
      },
    },
  };
};
