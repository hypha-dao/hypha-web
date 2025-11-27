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
  const { notifyProposalCreated } = useSendNotifications({ authToken });
  const onProposalCreated = React.useCallback(
    async ({
      creator,
      web3ProposalId: proposalId,
      web3SpaceId: spaceId,
    }: OnProposalCreatedInput) => {
      const url = getDhoUrlAgreements(lang, spaceSlug);
      //NOTE: notification should be sent detached so no await here
      notifyProposalCreated({ proposalId, spaceId, creator, url }).catch(
        (err) => {
          console.warn('Send notification on proposal created failed:', err);
        },
      );
    },
    [lang, spaceSlug, notifyProposalCreated],
  );
  useProposalEvents({
    authToken,
    onProposalCreated,
  });
  return {
    onProposalCreated,
  };
};
