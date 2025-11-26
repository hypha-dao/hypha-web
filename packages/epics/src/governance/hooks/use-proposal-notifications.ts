import {
  OnProposalCreatedInput,
  useHookRegistry,
  useProposalEvents,
} from '@hypha-platform/core/client';
import React from 'react';
import { getDhoUrlAgreements } from '../../common';
import { Locale } from '@hypha-platform/i18n';

export interface UseProposalNotificationsInput {
  lang: Locale;
  spaceSlug: string;
  authToken?: string | null;
}

export const useProposalNotifications = ({
  lang,
  spaceSlug,
  authToken,
}: UseProposalNotificationsInput) => {
  const { useSendNotifications } = useHookRegistry();
  const { notifyProposalCreated } = useSendNotifications!({ authToken });
  const onProposalCreated = React.useCallback(
    async ({
      creator,
      web3ProposalId,
      web3SpaceId,
    }: OnProposalCreatedInput) => {
      const url = getDhoUrlAgreements(lang, spaceSlug);
      await notifyProposalCreated({
        proposalId: web3ProposalId,
        spaceId: BigInt(web3SpaceId),
        creator,
        url,
      });
    },
    [lang, spaceSlug],
  );
  useProposalEvents({
    authToken,
    onProposalCreated,
  });
  return {
    onProposalCreated,
  };
};
