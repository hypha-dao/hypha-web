'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  buildUpdateWhitelistTransaction,
  createAgreementFiles,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { WhitelistEnergySettlementPlugin } from '../../agreements/plugins/whitelist-energy-settlement/plugin';
import { useSpaceEnergy } from '../../treasury/hooks/use-space-energy';

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
  const tAgreementFlow = useTranslations('AgreementFlow');
  const t = useTranslations('Energy');
  const { data: spaceEnergy } = useSpaceEnergy();
  const communityProxyAddress = spaceEnergy?.activation?.communityProxyAddress;

  const schema = React.useMemo(
    () =>
      schemaCreateAgreementForm.extend(createAgreementFiles).extend({
        energySettlementWhitelist: z.object({
          account: z
            .string()
            .trim()
            .regex(
              /^0x[a-fA-F0-9]{40}$/,
              t('validation.invalidSettlementAddress'),
            ),
          whitelisted: z.boolean(),
        }),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schema}
      label={tAgreementFlow('labels.whitelistEnergySettlement')}
      stickyHeaderTitle={t('forms.stickyHeaders.whitelistEnergySettlement')}
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
        communityProxyAddress: communityProxyAddress ?? t('forms.unknown'),
        settlementAddress: values.energySettlementWhitelist.account,
        whitelisted: values.energySettlementWhitelist.whitelisted,
      })}
      buildExtraTransactions={(values) => {
        if (!communityProxyAddress) {
          throw new Error(t('forms.noEnergyCommunity'));
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
