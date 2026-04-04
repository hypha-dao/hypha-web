'use client';

import {
  ProposeContributionPlugin,
  PayForExpensesPlugin,
  DeployFundsPlugin,
  ChangeVotingMethodPlugin,
  ChangeEntryMethodPlugin,
  IssueNewTokenPlugin,
  BuyHyphaTokensPlugin,
  ActivateSpacesPlugin,
  SpaceToSpaceMembershipPlugin,
  MintTokensToSpaceTreasuryPlugin,
  TokenBurningPlugin,
  TokenBackingVaultPlugin,
  MembershipExitPlugin,
  SpaceTransparencySettingsPlugin,
  RedeemTokensPlugin,
  UpdateIssuedTokenPlugin,
} from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';
import { Person, Space } from '@hypha-platform/core/client';

export const PLUGINS = {
  'propose-contribution': ProposeContributionPlugin,
  'pay-for-expenses': PayForExpensesPlugin,
  'deploy-funds': DeployFundsPlugin,
  'change-voting-method': ChangeVotingMethodPlugin,
  'change-entry-method': ChangeEntryMethodPlugin,
  'issue-new-token': IssueNewTokenPlugin,
  'buy-hypha-tokens': BuyHyphaTokensPlugin,
  'activate-spaces': ActivateSpacesPlugin,
  'space-to-space-membership': SpaceToSpaceMembershipPlugin,
  'mint-tokens-to-space-treasury': MintTokensToSpaceTreasuryPlugin,
  'token-burning': TokenBurningPlugin,
  'token-backing-vault': TokenBackingVaultPlugin,
  'membership-exit': MembershipExitPlugin,
  'space-transparency-settings': SpaceTransparencySettingsPlugin,
  'redeem-tokens': RedeemTokensPlugin,
  'update-issued-token': UpdateIssuedTokenPlugin,
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
  /** From server: active space on-chain members → people (ownership To whitelist member tab) */
  ownershipToWhitelistMembers?: Person[];
  /** From server: active space on-chain members → spaces-as-members (ownership To whitelist space tab) */
  ownershipToWhitelistSpaces?: Space[];
};

export const Plugin = ({
  name,
  spaceSlug,
  web3SpaceId,
  spaceId,
  spaces,
  spacesForChainMapping,
  members,
  ownershipToWhitelistMembers: ownershipMembersFromServer,
  ownershipToWhitelistSpaces: ownershipSpacesFromServer,
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

  const ownershipToWhitelistMembers =
    ownershipMembersFromServer ?? persons?.data ?? [];
  const ownershipToWhitelistSpaces =
    ownershipSpacesFromServer ?? memberSpaces?.data ?? [];

  if (name === 'update-issued-token') {
    return (
      <UpdateIssuedTokenPlugin
        {...commonProps}
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
        ownershipToWhitelistMembers={ownershipToWhitelistMembers}
        ownershipToWhitelistSpaces={ownershipToWhitelistSpaces}
      />
    );
  }

  return <PluginCmp {...commonProps} />;
};
