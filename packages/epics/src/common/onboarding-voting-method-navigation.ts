'use client';

import type { Locale } from '@hypha-platform/i18n';
import {
  RESUBMIT_PROPOSAL_DATA_KEY,
  type ResubmitProposalTemplateSegment,
} from '../utils/resubmit-proposal-template';
import { RESUBMIT_PROPOSAL_UPDATED_EVENT } from '../common/governance-proposal-navigation';
import {
  formatOnboardingVotingMethodSubmitMessage,
  type OnboardingVotingMethod,
  type OnboardingVotingMethodMessageLabels,
} from './onboarding-voting-method-ui';

export const CHANGE_VOTING_METHOD_RESUBMIT_SEGMENT: ResubmitProposalTemplateSegment =
  'change-voting-method';

export function getChangeVotingMethodProposalPath(
  lang: Locale,
  spaceSlug: string,
): string {
  return `/${lang}/dho/${spaceSlug}/agreements/create/change-voting-method`;
}

export function buildOnboardingVotingMethodProposalCopy(
  method: OnboardingVotingMethod,
  labels: OnboardingVotingMethodMessageLabels,
): { title: string; description: string } {
  const title = formatOnboardingVotingMethodSubmitMessage(method, labels);
  const description =
    method === '1m1v'
      ? 'Set how this space makes decisions: one member, one vote. Review the form and click Publish when ready.'
      : method === '1v1v'
      ? 'Set how this space makes decisions: one voice token, one vote. Review the form and click Publish when ready.'
      : 'Set how this space makes decisions: one token, one vote. Review the form and click Publish when ready.';

  return { title, description };
}

export function writeOnboardingVotingMethodResubmitData(args: {
  method: OnboardingVotingMethod;
  title?: string;
  description?: string;
}): void {
  if (typeof window === 'undefined') return;

  sessionStorage.setItem(
    RESUBMIT_PROPOSAL_DATA_KEY,
    JSON.stringify({
      resubmitTemplateSegment: CHANGE_VOTING_METHOD_RESUBMIT_SEGMENT,
      ...(args.title ? { title: args.title } : {}),
      ...(args.description ? { description: args.description } : {}),
      votingMethod: args.method,
      label: 'Voting Method',
    }),
  );
  window.dispatchEvent(new CustomEvent(RESUBMIT_PROPOSAL_UPDATED_EVENT));
}
