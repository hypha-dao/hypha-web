'use client';

import { Space } from '@core/space';
import {
  ProposeContributionPlugin,
  PayForExpensesPlugin,
  DeployFundsPlugin,
  ChangeVotingMethodPlugin,
  ChangeEntryMethodPlugin,
  IssueNewTokenPlugin,
} from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';

export const PLUGINS = {
  'propose-contribution': ProposeContributionPlugin,
  'pay-for-expenses': PayForExpensesPlugin,
  'deploy-funds': DeployFundsPlugin,
  'change-voting-method': ChangeVotingMethodPlugin,
  'change-entry-method': ChangeEntryMethodPlugin,
  'issue-new-token': IssueNewTokenPlugin,
};

type PluginProps = {
  name: keyof typeof PLUGINS;
  spaceSlug?: string;
  web3SpaceId?: number | null;
  subspaces?: Space[];
};

export const Plugin = ({
  name,
  spaceSlug,
  web3SpaceId,
  subspaces,
}: PluginProps) => {
  const { members } = useMembers({ spaceSlug });

  const PluginCmp = PLUGINS[name];

  return (
    <PluginCmp
      spaceSlug={spaceSlug || ''}
      web3SpaceId={web3SpaceId}
      members={members}
      subspaces={subspaces}
    />
  );
};
