'use client';

import React from 'react';

/**
 * AI section auto-scroll is disabled for now — manual proposal creation must
 * never be affected. Re-enable via a dedicated task when scroll UX is ready.
 */
export function useProposalFormSectionFocus(): void {
  React.useEffect(() => {
    // Intentionally no-op.
  }, []);
}
