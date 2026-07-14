'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  createAgreementFiles,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { RegisterEnergySourcePlugin } from '../../agreements/plugins/register-energy-source/plugin';

const parseDeviceIds = (csv?: string) =>
  (csv ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

export const CreateRegisterEnergySourceForm = ({
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

  const schema = React.useMemo(
    () =>
      schemaCreateAgreementForm.extend(createAgreementFiles).extend({
        energySource: z.object({
          sourceId: z.string().trim().min(1, t('validation.sourceIdRequired')),
          sourceType: z
            .string()
            .trim()
            .min(1, t('validation.sourceTypeRequired')),
          basePricePerKwh: z
            .string()
            .trim()
            .min(1, t('validation.basePriceRequired')),
          ownershipToken: z
            .string()
            .trim()
            .min(1, t('validation.ownershipTokenRequired')),
          deviceIdsCsv: z.string().trim().optional(),
        }),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schema}
      label={tAgreementFlow('labels.registerEnergySource')}
      stickyHeaderTitle={t('forms.stickyHeaders.registerEnergySource')}
      resubmitTemplateSegment="register-energy-source"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={<RegisterEnergySourcePlugin />}
      mapPayload={(values) => ({
        sourceId: values.energySource.sourceId,
        sourceType: values.energySource.sourceType,
        basePricePerKwh: values.energySource.basePricePerKwh,
        ownershipToken: values.energySource.ownershipToken,
        deviceIds: parseDeviceIds(values.energySource.deviceIdsCsv),
      })}
    />
  );
};
