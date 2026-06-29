'use client';

import { z } from 'zod';
import {
  buildUpdateWhitelistTransaction,
  createAgreementFiles,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { WhitelistEnergySettlementPlugin } from '../../agreements/plugins/whitelist-energy-settlement/plugin';
import { useSpaceEnergy } from '../../treasury/hooks/use-space-energy';

const schemaCreateWhitelistEnergySettlementForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend({
    energySettlementWhitelist: z.object({
      account: z
        .string()
        .trim()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid settlement address'),
      whitelisted: z.boolean(),
    }),
  });

type FormValues = z.infer<typeof schemaCreateWhitelistEnergySettlementForm>;

export const CreateWhitelistEnergySettlementForm = ({
  spaceId,
  web3SpaceId,
  successfulUrl,
  backUrl,
}: {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
}) => {
  const { data: spaceEnergy } = useSpaceEnergy();
  const communityProxyAddress = spaceEnergy?.activation?.communityProxyAddress;

  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schemaCreateWhitelistEnergySettlementForm}
      label="Whitelist Energy Settlement"
      stickyHeaderTitle="Create Whitelist Energy Settlement Proposal"
      resubmitTemplateSegment="whitelist-energy-settlement"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={<WhitelistEnergySettlementPlugin />}
      defaultValues={
        {
          energySettlementWhitelist: {
            account: '',
            whitelisted: true,
          },
        } as Partial<FormValues>
      }
      mapPayload={(values) => ({
        contractMethod: 'updateWhitelist',
        communityProxyAddress: communityProxyAddress ?? 'Unknown',
        settlementAddress: values.energySettlementWhitelist.account,
        whitelisted: values.energySettlementWhitelist.whitelisted,
      })}
      buildExtraTransactions={(values) => {
        if (!communityProxyAddress) {
          throw new Error(
            'This space does not have an energy community yet, or it is still syncing. Please retry in a moment.',
          );
        }
        return [
          buildUpdateWhitelistTransaction({
            proxy: communityProxyAddress,
            account: values.energySettlementWhitelist.account,
            whitelisted: values.energySettlementWhitelist.whitelisted,
          }),
        ];
      }}
    />
  );
};
