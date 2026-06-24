'use client';

import { RESUBMIT_PROPOSAL_DATA_KEY } from '../utils/resubmit-proposal-template';
import { stableJsonFingerprint } from './proposal-form-navigation';

export const RESUBMIT_PROPOSAL_UPDATED_EVENT =
  'hypha:resubmit-proposal-updated';

export function writeGovernanceProposalResubmitPayload(
  payload: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  const next = stableJsonFingerprint(payload);
  const prev = sessionStorage.getItem(RESUBMIT_PROPOSAL_DATA_KEY);
  if (prev === next) return;
  sessionStorage.setItem(RESUBMIT_PROPOSAL_DATA_KEY, next);
  window.dispatchEvent(new CustomEvent(RESUBMIT_PROPOSAL_UPDATED_EVENT));
}
