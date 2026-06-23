'use client';

import { RESUBMIT_PROPOSAL_DATA_KEY } from '../utils/resubmit-proposal-template';

export function writeGovernanceProposalResubmitPayload(
  payload: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RESUBMIT_PROPOSAL_DATA_KEY, JSON.stringify(payload));
}
