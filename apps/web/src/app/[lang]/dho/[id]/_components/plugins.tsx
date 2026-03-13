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
  MembershipExitPlugin,
  SpaceTransparencySettingsPlugin,
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
  'membership-exit': MembershipExitPlugin,
  'space-transparency-settings': SpaceTransparencySettingsPlugin,
  'update-issued-token': UpdateIssuedTokenPlugin,
};

type PluginProps = {
  name: keyof typeof PLUGINS;
  spaceSlug?: string;
  web3SpaceId?: number | null;
  spaceId?: number;
  spaces?: Space[];
  members?: Person[];
};

export const Plugin = ({
  name,
  spaceSlug,
  web3SpaceId,
  spaceId,
  spaces,
  members,
}: PluginProps) => {
  const { persons, spaces: memberSpaces } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });

  const PluginCmp = PLUGINS[name];

  return (
    <PluginCmp
      spaceSlug={spaceSlug || ''}
      web3SpaceId={web3SpaceId}
      spaceId={spaceId}
      members={members ?? persons?.data}
      spaces={spaces ?? memberSpaces?.data}
    />
  );
};
