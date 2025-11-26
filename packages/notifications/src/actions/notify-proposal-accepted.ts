'use server';

import { NotifyProposalAcceptedInput } from '@hypha-platform/core/client';

export async function notifyProposalAcceptedAction(
  { proposalId }: NotifyProposalAcceptedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to send notification');
  //TODO
}
