'use client';

import { PROPOSAL_FORM_FOCUS_KEY } from '../utils/resubmit-proposal-template';

export const PROPOSAL_FORM_FOCUS_UPDATED_EVENT =
  'hypha:proposal-form-focus-updated';

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
  window.dispatchEvent(new CustomEvent(PROPOSAL_FORM_FOCUS_UPDATED_EVENT));
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

const PROPOSAL_OVERLAY_PANEL_ID = 'proposal-overlay-panel';

/** Scroll within the proposal overlay panel — avoids jumping the main column. */
export function scrollProposalFormSectionIntoView(target: HTMLElement): void {
  if (typeof window === 'undefined') return;
  const panel = document.getElementById(PROPOSAL_OVERLAY_PANEL_ID);
  if (!panel) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const panelRect = panel.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetTop =
    targetRect.top -
    panelRect.top +
    panel.scrollTop -
    panel.clientHeight / 2 +
    targetRect.height / 2;

  panel.scrollTo({
    top: Math.max(0, targetTop),
    behavior: 'smooth',
  });
}

export function writeProposalFormFocusIfChanged(args: {
  focusField?: string;
  focusSection?: string;
}): void {
  if (!args.focusField && !args.focusSection) return;
  const prev = readProposalFormFocus();
  if (
    prev?.focusField === args.focusField &&
    prev?.focusSection === args.focusSection
  ) {
    return;
  }
  writeProposalFormFocus(args);
}
