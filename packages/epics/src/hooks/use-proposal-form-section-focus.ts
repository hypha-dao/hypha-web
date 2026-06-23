'use client';

import React from 'react';
import {
  clearProposalFormFocus,
  PROPOSAL_FORM_FOCUS_UPDATED_EVENT,
  readProposalFormFocus,
} from '../common/proposal-form-focus';

/**
 * Scrolls to and briefly highlights a proposal form section after AI navigation.
 * Forms should mark sections with `data-proposal-section="<id>"`.
 */
export function useProposalFormSectionFocus(enabled = true): void {
  const [focusTick, setFocusTick] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocusUpdated = () => setFocusTick((tick) => tick + 1);
    window.addEventListener(PROPOSAL_FORM_FOCUS_UPDATED_EVENT, onFocusUpdated);
    return () =>
      window.removeEventListener(
        PROPOSAL_FORM_FOCUS_UPDATED_EVENT,
        onFocusUpdated,
      );
  }, []);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const focus = readProposalFormFocus();
    if (!focus?.focusSection && !focus?.focusField) return;

    const sectionId = focus.focusSection ?? focus.focusField;
    if (!sectionId) return;

    const timer = window.setTimeout(() => {
      const target =
        document.querySelector(`[data-proposal-section="${sectionId}"]`) ??
        document.getElementById(`proposal-section-${sectionId}`);

      if (!(target instanceof HTMLElement)) {
        clearProposalFormFocus();
        return;
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.dataset.proposalSectionFocused = 'true';
      target.style.outline = '2px solid rgb(59 130 246 / 0.85)';
      target.style.outlineOffset = '6px';
      target.style.borderRadius = '8px';
      target.style.transition = 'outline 0.25s ease';
      window.setTimeout(() => {
        delete target.dataset.proposalSectionFocused;
        target.style.outline = '';
        target.style.outlineOffset = '';
        target.style.borderRadius = '';
        clearProposalFormFocus();
      }, 2400);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [enabled, focusTick]);
}
