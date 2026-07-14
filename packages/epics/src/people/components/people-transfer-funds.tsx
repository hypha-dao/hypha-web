'use client';

import React from 'react';
import {
  ProposalOverlayShell,
  ModalStickyNavigation,
  useUserAssets,
} from '@hypha-platform/epics';
import { PeopleTransferForm } from '@hypha-platform/epics';
import { Person } from '../../../../core/src/people';
import { Space } from '../../../../core/src/space';
import { Separator } from '@hypha-platform/ui';
import { ERC20_TOKEN_TRANSFER_ADDRESSES } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  type?: string;
  space?: {
    title: string;
    slug: string;
  };
}

interface ProfileTransferFundsProps {
  lang: string;
  spaces: Space[];
  peoples: Person[];
  personSlug: string;
  closeUrl?: string;
  backUrl?: string;
}

export const ProfileTransferFunds = ({
  lang,
  spaces,
  peoples,
  personSlug,
  closeUrl,
  backUrl,
}: ProfileTransferFundsProps) => {
  const tActions = useTranslations('ProfileActions');
  const tModalAside = useTranslations('ModalAside');
  const { assets, manualUpdate } = useUserAssets({
    personSlug,
    refreshInterval: 10000,
  });
  /**
   * Show every utility-class token the user holds + every credit-enabled token they
   * are eligible to draw on (member of any whitelisted space) — so credit-eligible
   * tokens appear in the dropdown even when the on-chain balance is zero.
   */
  const tokens: Token[] = assets
    .filter((asset) => {
      const isTransferableType =
        (asset.type != null && !['ownership', 'voice'].includes(asset.type)) ||
        (asset.type == null &&
          asset.address !== undefined &&
          ERC20_TOKEN_TRANSFER_ADDRESSES.includes(asset.address));
      if (!isTransferableType) return false;
      const hasBalance = (asset.value ?? 0) > 0;
      /**
       * `creditEligible` only means the user belongs to a whitelisted space; it
       * doesn't guarantee they can currently draw. If `creditLimitLeft` is 0 the
       * submit-time validation immediately rejects the transfer, so we hide the
       * token here too to avoid a confusing dropdown entry.
       */
      const canDrawCredit = Boolean(
        asset.mutualCredit?.creditEligible &&
          asset.mutualCredit.creditLimitLeft > 0,
      );
      return hasBalance || canDrawCredit;
    })
    .map((asset) => ({
      icon: asset.icon,
      symbol: asset.symbol,
      address: asset.address as `0x${string}`,
      type: asset.type,
      space: asset.space,
    }));

  const resolvedCloseUrl = closeUrl ?? `/${lang}/profile/${personSlug}`;
  const resolvedBackUrl = backUrl ?? `/${lang}/profile/${personSlug}/actions`;

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('transferFunds')}
          closeUrl={resolvedCloseUrl}
          backUrl={resolvedBackUrl}
          backLabel={tActions('backToActions')}
        />
        <span className="text-2 text-neutral-11">
          {tActions('transferFunds.content')}
        </span>
        <Separator />
        <PeopleTransferForm
          peoples={peoples}
          spaces={spaces}
          tokens={tokens}
          updateAssets={manualUpdate}
        />
      </div>
    </ProposalOverlayShell>
  );
};
