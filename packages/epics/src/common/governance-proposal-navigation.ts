'use client';

import { RESUBMIT_PROPOSAL_DATA_KEY } from '../utils/resubmit-proposal-template';

export const RESUBMIT_PROPOSAL_UPDATED_EVENT =
  'hypha:resubmit-proposal-updated';

export function writeGovernanceProposalResubmitPayload(
  payload: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RESUBMIT_PROPOSAL_DATA_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(RESUBMIT_PROPOSAL_UPDATED_EVENT));
}
