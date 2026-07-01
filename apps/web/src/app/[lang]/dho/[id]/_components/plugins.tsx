'use client';

import {
  ProposeContributionPlugin,
  PayForExpensesPlugin,
  DeployFundsPlugin,
  AirdropPlugin,
  ChangeVotingMethodPlugin,
  ChangeEntryMethodPlugin,
  IssueNewTokenPlugin,
  BuyHyphaTokensPlugin,
  ActivateSpacesPlugin,
  SpaceToSpaceMembershipPlugin,
  ChangeSpaceDelegatePlugin,
  MintTokensToSpaceTreasuryPlugin,
  TokenBurningPlugin,
  TokenBackingVaultPlugin,
  MembershipExitPlugin,
  SpaceTransparencySettingsPlugin,
  RedeemTokensPlugin,
  UpdateIssuedTokenPlugin,
  AcceptInvestmentPlugin,
  ExchangeStakesAndTokensPlugin,
} from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';
import { Person, Space } from '@hypha-platform/core/client';

export const PLUGINS = {
  'propose-contribution': ProposeContributionPlugin,
  'pay-for-expenses': PayForExpensesPlugin,
  'deploy-funds': DeployFundsPlugin,
  airdrop: AirdropPlugin,
  'change-voting-method': ChangeVotingMethodPlugin,
  'change-entry-method': ChangeEntryMethodPlugin,
  'issue-new-token': IssueNewTokenPlugin,
  'buy-hypha-tokens': BuyHyphaTokensPlugin,
  'activate-spaces': ActivateSpacesPlugin,
  'space-to-space-membership': SpaceToSpaceMembershipPlugin,
  'change-space-delegate': ChangeSpaceDelegatePlugin,
  'mint-tokens-to-space-treasury': MintTokensToSpaceTreasuryPlugin,
  'token-burning': TokenBurningPlugin,
  'token-backing-vault': TokenBackingVaultPlugin,
  'membership-exit': MembershipExitPlugin,
  'space-transparency-settings': SpaceTransparencySettingsPlugin,
  'redeem-tokens': RedeemTokensPlugin,
  'update-issued-token': UpdateIssuedTokenPlugin,
  'accept-investment': AcceptInvestmentPlugin,
  'exchange-stakes-and-tokens': ExchangeStakesAndTokensPlugin,
};

type PluginProps = {
  name: keyof typeof PLUGINS;
  spaceSlug?: string;
  web3SpaceId?: number | null;
  spaceId?: number;
  spaces?: Space[];
  /** Full space list (incl. current DHO) for mapping on-chain space ids → addresses */
  spacesForChainMapping?: Space[];
  members?: Person[];
  resubmitKey?: number;
};

export const Plugin = ({
  name,
  spaceSlug,
  web3SpaceId,
  spaceId,
  spaces,
  spacesForChainMapping,
  members,
  resubmitKey,
}: PluginProps) => {
  const { persons, spaces: memberSpaces } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });

  const PluginCmp = PLUGINS[name];
  const commonProps = {
    spaceSlug: spaceSlug || '',
    web3SpaceId,
    spaceId,
    members: members ?? persons?.data,
    spaces: spaces ?? memberSpaces?.data,
  };

  /**
   * Ownership-token To whitelist (member + space tabs): same source as propose-contribution
   * `RecipientField` — `useMembers` → `/api/v1/spaces/[slug]/members` (persons + spaces arrays).
   */
  const ownershipToWhitelistMembers = persons?.data ?? [];
  const ownershipToWhitelistSpaces = memberSpaces?.data ?? [];

  const resubmitProps = resubmitKey !== undefined ? { resubmitKey } : {};

  if (name === 'update-issued-token') {
    return (
      <UpdateIssuedTokenPlugin
        {...commonProps}
        currentSpaceWeb3Id={web3SpaceId}
        spacesForChainMapping={spacesForChainMapping}
        ownershipToWhitelistMembers={ownershipToWhitelistMembers}
        ownershipToWhitelistSpaces={ownershipToWhitelistSpaces}
      />
    );
  }

  if (name === 'issue-new-token') {
    return (
      <IssueNewTokenPlugin
        {...commonProps}
        currentSpaceWeb3Id={web3SpaceId}
        ownershipToWhitelistMembers={ownershipToWhitelistMembers}
        ownershipToWhitelistSpaces={ownershipToWhitelistSpaces}
        {...resubmitProps}
      />
    );
  }

  return <PluginCmp {...commonProps} {...resubmitProps} />;
};
