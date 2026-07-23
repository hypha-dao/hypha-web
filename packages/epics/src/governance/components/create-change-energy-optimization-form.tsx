'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  buildSetOptimizationTransactions,
  createAgreementFiles,
  schemaCreateAgreementForm,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import {
  basePurposeLabel,
  ENERGY_OPTIMIZATION_DEFAULTS,
  EnergyOptimizationFields,
  EnergySocialAllocationFields,
  createEnergyOptimizationSchema,
  optimizationFormToContract,
} from '../../agreements/plugins/enable-energy-community/energy-form-fields';
import { useSpaceEnergy } from '../../treasury/hooks/use-space-energy';

const ChangeEnergyOptimizationPlugin = ({
  members,
  spaces,
}: {
  members: Person[];
  spaces?: Space[];
}) => {
  const t = useTranslations('Energy.plugins.enableCommunity');
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <EnergyOptimizationFields />
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <Button
          type="button"
          variant="ghost"
          className="self-start px-0"
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          {showAdvanced ? <ChevronDownIcon /> : <ChevronRightIcon />}
          {t('advancedSettings')}
        </Button>
        {showAdvanced ? (
          <EnergySocialAllocationFields members={members} spaces={spaces} />
        ) : null}
      </div>
    </div>
  );
};

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
  const tAgreementFlow = useTranslations('AgreementFlow');
  const t = useTranslations('Energy');
  const { data: spaceEnergy } = useSpaceEnergy();
  const communityProxyAddress = spaceEnergy?.activation?.communityProxyAddress;

  const schema = React.useMemo(
    () =>
      schemaCreateAgreementForm.extend(createAgreementFiles).extend({
        energyOptimization: createEnergyOptimizationSchema((key, values) =>
          t(key, values),
        ),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schema}
      label={tAgreementFlow('labels.changeEnergyOptimization')}
      stickyHeaderTitle={t('forms.stickyHeaders.changeEnergyOptimization')}
      resubmitTemplateSegment="change-energy-optimization"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={
        <ChangeEnergyOptimizationPlugin members={members} spaces={spaces} />
      }
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
            ? t('optimization.socialDisabled')
            : optimization.socialMode === 'FIXED'
            ? t('optimization.socialFixed', {
                kwh: optimization.socialFixedKwh,
              })
            : t('optimization.socialVariable', {
                percent: (optimization.socialVariableBps / 100).toFixed(2),
              });

        return {
          contractMethod: 'setOptimizationConfig',
          communityProxyAddress: communityProxyAddress ?? t('forms.unknown'),
          optimization: {
            priorities: optimization.purposeRanking.map((purpose) =>
              basePurposeLabel(purpose, (key, values) => t(key, values)),
            ),
            socialAllocation: social,
            targetWallets: optimization.socialWallets.map(
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
          throw new Error(t('forms.noEnergyCommunity'));
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
