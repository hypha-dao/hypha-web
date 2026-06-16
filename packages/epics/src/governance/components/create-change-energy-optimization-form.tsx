'use client';

import { z } from 'zod';
import {
  buildSetOptimizationTransactions,
  createAgreementFiles,
  schemaCreateAgreementForm,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import {
  basePurposeLabel,
  ENERGY_OPTIMIZATION_DEFAULTS,
  EnergyOptimizationFields,
  energyOptimizationSchema,
  optimizationFormToContract,
} from '../../agreements/plugins/enable-energy-community/energy-form-fields';
import { useSpaceEnergy } from '../../treasury/hooks/use-space-energy';

const schemaCreateChangeEnergyOptimizationForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend({
    energyOptimization: energyOptimizationSchema,
  });

type FormValues = z.infer<typeof schemaCreateChangeEnergyOptimizationForm>;

export const CreateChangeEnergyOptimizationForm = ({
  spaceId,
  web3SpaceId,
  successfulUrl,
  backUrl,
  members = [],
  spaces = [],
}: {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  members?: Person[];
  spaces?: Space[];
}) => {
  const { data: spaceEnergy } = useSpaceEnergy();
  const communityProxyAddress = spaceEnergy?.activation?.communityProxyAddress;

  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schemaCreateChangeEnergyOptimizationForm}
      label="Change Energy Optimization"
      stickyHeaderTitle="Create Change Energy Optimization Proposal"
      resubmitTemplateSegment="change-energy-optimization"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={<EnergyOptimizationFields members={members} spaces={spaces} />}
      defaultValues={
        {
          energyOptimization: ENERGY_OPTIMIZATION_DEFAULTS,
        } as Partial<FormValues>
      }
      mapPayload={(values) => {
        const optimization = optimizationFormToContract(
          values.energyOptimization,
        );
        const social =
          optimization.socialMode === 'NONE'
            ? 'Disabled'
            : optimization.socialMode === 'FIXED'
            ? `Fixed: ${optimization.socialFixedKwh} kWh per interval`
            : `Variable: ${(optimization.socialVariableBps / 100).toFixed(
                2,
              )}% of solar`;

        return {
          contractMethod: 'setOptimizationConfig',
          communityProxyAddress: communityProxyAddress ?? 'Unknown',
          optimization: {
            priorities: optimization.purposeRanking.map((purpose) =>
              basePurposeLabel(purpose),
            ),
            socialAllocation: social,
            goalWallets: optimization.socialWallets.map(
              (wallet, index) =>
                `${wallet}: ${(
                  (optimization.socialWalletShares[index] ?? 0) / 100
                ).toFixed(2)}%`,
            ),
          },
        };
      }}
      buildExtraTransactions={(values) => {
        if (!communityProxyAddress) {
          throw new Error(
            'This space does not have an energy community yet, or it is still syncing. Please retry in a moment.',
          );
        }
        const optimization = optimizationFormToContract(
          values.energyOptimization,
        );
        return buildSetOptimizationTransactions({
          proxy: communityProxyAddress,
          ...optimization,
        });
      }}
    />
  );
};
