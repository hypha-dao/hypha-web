'use client';

import React from 'react';
import { disableProposalAiWalkthrough } from '../common/proposal-form-focus';
import { notifyGovernanceProposalPublished } from '../common/governance-proposal-navigation';
import { clearResubmitProposalSessionStorage } from './use-resubmit-proposal-data';

/**
 * Clears resubmit session draft after a proposal flow completes successfully.
 * Pass an explicit terminal success flag from the orchestrator consumer (e.g.
 * `progress === 100 && !isError` once all tasks finished without error).
 */
export function useClearResubmitOnSuccess(isSuccess: boolean): void {
  React.useEffect(() => {
    if (isSuccess) {
      clearResubmitProposalSessionStorage();
      disableProposalAiWalkthrough();
      notifyGovernanceProposalPublished();
    }
  }, [isSuccess]);
}
