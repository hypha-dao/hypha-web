import {
  OnProposalCreatedInput,
  PostNotifyProposalCreatedInput,
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

/**
 * Watches on-chain `ProposalCreated` events to drive post-publish routing (`postProposalCreated`
 * below). Notification sending itself is server-fired (#2470, via the
 * `apps/web/.../webhooks/proposal/created` route + `dispatch()`) — this hook no longer triggers
 * a client-fired notification action, only the routing callback.
 */
export const useProposalNotifications = ({
  lang,
  spaceSlug,
  authToken,
  postProposalCreated,
}: UseProposalNotificationsInput) => {
  const onProposalCreated = React.useCallback(
    async ({
      creator,
      web3ProposalId: proposalId,
      web3SpaceId: spaceId,
    }: OnProposalCreatedInput) => {
      const url = getDhoUrlAgreements(lang, spaceSlug);
      try {
        await postProposalCreated?.({ proposalId, spaceId, creator, url });
      } catch (error) {
        console.warn(
          'Some issues appeared on notifications post preprocessing after on proposal created:',
          error,
        );
      }
    },
    [lang, spaceSlug, postProposalCreated],
  );
  useProposalEvents({
    authToken,
    onProposalCreated,
  });
  return {
    onProposalCreated,
  };
};
