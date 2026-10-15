/**
 * Pure content-selection for `proposal.created` — no DB/web3 imports, so it's cheap to unit test
 * in isolation from `resolver.ts` (which does the actual DB/web3 lookups). Email uses the OneSignal
 * dashboard template when `EMAIL_TEMPLATE_PROPOSAL_CREATED_{CREATOR,MEMBERS}` is set, else the
 * locally rendered plain content (the fallback); push likewise uses
 * `PUSH_TEMPLATE_PROPOSAL_CREATED_{CREATOR,MEMBERS}` when set, else plain.
 */
import {
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_OWN_ACTIONS,
} from '../../constants';
import type { ContentBuilder } from '../../core/content-builder';
import { resolveEmailTemplate } from '../../core/email-template';
import { resolvePushTemplate } from '../../core/push-template';
import type { ProposalCreatedEvent } from '../../core/types';
import { layout } from '../../template/common/layout';
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
  const url = recipient.data?.url as string | undefined;
  const templatePush = resolvePushTemplate(
    isCreator
      ? 'PUSH_TEMPLATE_PROPOSAL_CREATED_CREATOR'
      : 'PUSH_TEMPLATE_PROPOSAL_CREATED_MEMBERS',
    {
      ...(isCreator ? {} : { creator_name: creatorName }),
      space_title: spaceTitle,
      proposal_title: recipient.data?.proposalTitle as string | undefined,
      proposal_kind: proposalLabel,
      url,
    },
    url,
  );
  const templateEmail = resolveEmailTemplate(
    isCreator
      ? 'EMAIL_TEMPLATE_PROPOSAL_CREATED_CREATOR'
      : 'EMAIL_TEMPLATE_PROPOSAL_CREATED_MEMBERS',
    {
      // creator variant greets the recipient; the members variant names who created it
      ...(isCreator
        ? { user_name: creatorName }
        : { creator_name: creatorName }),
      space_title: spaceTitle,
      proposal_title: recipient.data?.proposalTitle as string | undefined,
      proposal_kind: proposalLabel,
      url,
      notification_settings_url: recipient.data?.notificationSettingsUrl as
        | string
        | undefined,
    },
  );
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
      push: templatePush ?? {
        kind: 'plain',
        contents: push.contents,
        headings: push.headings,
        url,
      },
      email: templateEmail ?? {
        kind: 'plain',
        subject: email.subject,
        body: layout({
          title: email.subject,
          paragraphs: [email.body],
          cta: url ? { label: 'View proposal', url } : undefined,
          footer: {
            unsubscribe: true,
            settingsUrl: recipient.data?.notificationSettingsUrl as
              | string
              | undefined,
          },
        }),
      },
    },
  };
};
