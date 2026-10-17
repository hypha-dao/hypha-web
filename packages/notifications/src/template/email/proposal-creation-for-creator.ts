import type { Email } from './types';
import type { ProposalCreationProps } from '../common';
import { proposalEmail, quotedTitleHtml, strong } from './proposal-email';

/** Dashboard: "Proposals - Created - for creator" — the only proposal email that greets by name. */
export function emailProposalCreationForCreator({
  creatorName,
  proposalLabel,
  proposalTitle,
  spaceTitle,
  url,
  settingsUrl,
  appUrl,
}: ProposalCreationProps): Email {
  const space = spaceTitle?.trim() || 'your space';
  const greeting = `Hey ${creatorName?.trim() || 'there'},`;
  const preheader = proposalTitle?.trim() || 'Thank you for contributing.';
  const links = { url, settingsUrl, appUrl, greeting, preheader };

  if (proposalLabel === 'Invite') {
    return proposalEmail({
      subject: `Your invite to join ${space} has been created`,
      statementHtml: `Your invite to join ${strong(
        space,
      )} has been created. 🌱`,
      ...links,
    });
  }

  return proposalEmail({
    subject: `Your proposal has been created in ${space}`,
    statementHtml: `Your proposal${quotedTitleHtml(
      proposalTitle,
    )} was successfully created in ${strong(space)}! 🌱`,
    followUps: [
      'Thank you for sharing it. Your contribution helps your space grow and thrive.',
    ],
    ...links,
  });
}
