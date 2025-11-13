'use server';

import { NotifyProposalRejectedInput } from '@hypha-platform/core/client';

export async function notifyProposalRejectedAction(
  { proposalId }: NotifyProposalRejectedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to send notification');
  //TODO
  return {};
}
