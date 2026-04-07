import {
  NotifyProposalCreatedInput,
  OnProposalCreatedInput,
  PostNotifyProposalCreatedInput,
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
  postProposalCreated?: (arg: PostNotifyProposalCreatedInput) => Promise<void>;
}

export const useProposalNotifications = ({
  lang,
  spaceSlug,
  authToken,
  postProposalCreated,
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
      try {
        await postProposalCreated?.({
          proposalId,
          spaceId,
          creator,
          url,
          sendNotifications: notifyProposalCreated,
        });
      } catch (error) {
        console.warn(
          'Some issues appeared on notifications post preprocessing after on proposal created:',
          error,
        );
      }
    },
    [lang, spaceSlug, notifyProposalCreated, postProposalCreated],
  );
  useProposalEvents({
    authToken,
    onProposalCreated,
  });
  return {
    onProposalCreated,
  };
};
