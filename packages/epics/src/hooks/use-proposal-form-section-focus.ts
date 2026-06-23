'use client';

import React from 'react';
import {
  clearProposalFormFocus,
  readProposalFormFocus,
} from '../common/proposal-form-focus';

/**
 * Scrolls to and briefly highlights a proposal form section after AI navigation.
 * Forms should mark sections with `data-proposal-section="<id>"`.
 */
export function useProposalFormSectionFocus(enabled = true): void {
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
      window.setTimeout(() => {
        delete target.dataset.proposalSectionFocused;
        clearProposalFormFocus();
      }, 2400);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [enabled]);
}
