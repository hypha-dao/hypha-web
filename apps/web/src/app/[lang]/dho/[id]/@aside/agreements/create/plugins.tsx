'use client';

import {
  ProposeContributionPlugin,
  PayForExpensesPlugin,
  DeployFundsPlugin,
  ChangeVotingMethodPlugin,
  ChangeEntryMethodPlugin,
  IssueNewTokenPlugin,
  BuyHyphaTokensPlugin,
} from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';
import { Space } from '@hypha-platform/core/client';

export const PLUGINS = {
  'propose-contribution': ProposeContributionPlugin,
  'pay-for-expenses': PayForExpensesPlugin,
  'deploy-funds': DeployFundsPlugin,
  'change-voting-method': ChangeVotingMethodPlugin,
  'change-entry-method': ChangeEntryMethodPlugin,
  'issue-new-token': IssueNewTokenPlugin,
  'buy-hypha-tokens': BuyHyphaTokensPlugin,
};

type PluginProps = {
  name: keyof typeof PLUGINS;
  spaceSlug?: string;
  web3SpaceId?: number | null;
  spaces?: Space[];
};

export const Plugin = ({
  name,
  spaceSlug,
  web3SpaceId,
  spaces,
}: PluginProps) => {
  const { members } = useMembers({ spaceSlug, paginationDisabled: true });

  const PluginCmp = PLUGINS[name];

  return (
    <PluginCmp
      spaceSlug={spaceSlug || ''}
      web3SpaceId={web3SpaceId}
      members={members}
      spaces={spaces}
    />
  );
};
