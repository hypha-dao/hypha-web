'use client';

import React from 'react';
import {
  clearProposalFormFocus,
  PROPOSAL_FORM_FOCUS_UPDATED_EVENT,
  readProposalFormFocus,
  scrollProposalFormSectionIntoView,
} from '../common/proposal-form-focus';

const PROPOSAL_OVERLAY_PANEL_ID = 'proposal-overlay-panel';

/**
 * Scrolls to and briefly highlights a proposal form section after AI navigation.
 * Forms should mark sections with `data-proposal-section="<id>"`.
 */
export function useProposalFormSectionFocus(enabled = true): void {
  const [focusTick, setFocusTick] = React.useState(0);
  const lastAutoFocusedSectionRef = React.useRef<string | null>(null);
  const userAdjustedScrollRef = React.useRef(false);

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
    if (typeof window === 'undefined') return;
    const panel = document.getElementById(PROPOSAL_OVERLAY_PANEL_ID);
    if (!panel) return;

    const markUserScroll = () => {
      userAdjustedScrollRef.current = true;
    };

    panel.addEventListener('wheel', markUserScroll, { passive: true });
    panel.addEventListener('touchmove', markUserScroll, { passive: true });
    panel.addEventListener('keydown', (event) => {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'PageDown' ||
        event.key === 'PageUp' ||
        event.key === 'Home' ||
        event.key === 'End'
      ) {
        markUserScroll();
      }
    });

    return () => {
      panel.removeEventListener('wheel', markUserScroll);
      panel.removeEventListener('touchmove', markUserScroll);
    };
  }, [focusTick]);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const focus = readProposalFormFocus();
    if (!focus?.focusSection && !focus?.focusField) return;

    const sectionId = focus.focusSection ?? focus.focusField;
    if (!sectionId) return;

    if (userAdjustedScrollRef.current) {
      clearProposalFormFocus();
      return;
    }

    if (lastAutoFocusedSectionRef.current === sectionId) {
      clearProposalFormFocus();
      return;
    }

    const timer = window.setTimeout(() => {
      const target =
        document.querySelector(`[data-proposal-section="${sectionId}"]`) ??
        document.getElementById(`proposal-section-${sectionId}`);

      if (!(target instanceof HTMLElement)) {
        clearProposalFormFocus();
        return;
      }

      scrollProposalFormSectionIntoView(target);
      lastAutoFocusedSectionRef.current = sectionId;
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
