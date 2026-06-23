'use client';

import { PROPOSAL_FORM_FOCUS_KEY } from '../utils/resubmit-proposal-template';

export function writeProposalFormFocus(args: {
  focusField?: string;
  focusSection?: string;
}): void {
  if (typeof window === 'undefined') return;
  if (!args.focusField && !args.focusSection) return;
  sessionStorage.setItem(
    PROPOSAL_FORM_FOCUS_KEY,
    JSON.stringify({
      focusField: args.focusField,
      focusSection: args.focusSection,
    }),
  );
}

export function clearProposalFormFocus(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PROPOSAL_FORM_FOCUS_KEY);
}

export function readProposalFormFocus(): {
  focusField?: string;
  focusSection?: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PROPOSAL_FORM_FOCUS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      focusField?: string;
      focusSection?: string;
    };
    return parsed;
  } catch {
    return null;
  }
}
