'use client';

import React from 'react';
import { clearResubmitProposalSessionStorage } from './use-resubmit-proposal-data';

/** Clears resubmit session draft after a proposal flow completes successfully. */
export function useClearResubmitOnSuccess(
  progress: number,
  isError: boolean,
): void {
  React.useEffect(() => {
    if (progress === 100 && !isError) {
      clearResubmitProposalSessionStorage();
    }
  }, [progress, isError]);
}
