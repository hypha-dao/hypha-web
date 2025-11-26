import {
  OnProposalCreatedInput,
  useHookRegistry,
  useProposalEvents,
} from '@hypha-platform/core/client';
import React from 'react';
import { getDhoUrlAgreements } from '../../common';
import { Locale } from '@hypha-platform/i18n';

export const useProposalNotifications = ({
  lang,
  spaceSlug,
  authToken,
}: {
  lang: Locale;
  spaceSlug: string;
  authToken?: string | null;
}) => {
  //TODO: uncomment on inject useSendNotifications
  /*const { useSendNotifications } = useHookRegistry();
  const { notifyProposalCreated } = useSendNotifications!({ authToken });*/
  const onProposalCreated = React.useCallback(
    async ({
      creator,
      web3ProposalId,
      web3SpaceId,
    }: OnProposalCreatedInput) => {
      //TODO: remove before merge
      console.log(
        `Proposal ${web3ProposalId} is created by ${creator} in space ${web3SpaceId}`,
      );
      const url = getDhoUrlAgreements(lang, spaceSlug);
      //TODO: uncomment on inject useSendNotifications
      /*await notifyProposalCreated({
        proposalId: web3ProposalId,
        spaceId: BigInt(web3SpaceId),
        creator,
        url,
      });*/
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
