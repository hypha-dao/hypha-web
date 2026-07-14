'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  createAgreementFiles,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { EnergySharingPlugin } from '../../agreements/plugins/energy-sharing/plugin';

export const CreateEnergySharingForm = ({
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
        energySharing: z.object({
          settlementWindow: z
            .string()
            .trim()
            .min(1, t('validation.settlementWindowRequired')),
          creditPolicy: z
            .string()
            .trim()
            .min(1, t('validation.creditPolicyRequired')),
          debtPolicy: z
            .string()
            .trim()
            .min(1, t('validation.debtPolicyRequired')),
          effectiveFrom: z
            .string()
            .trim()
            .min(1, t('validation.effectiveDateRequired')),
        }),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schema}
      label={tAgreementFlow('labels.energySharing')}
      stickyHeaderTitle={t('forms.stickyHeaders.energySharing')}
      resubmitTemplateSegment="energy-sharing"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={<EnergySharingPlugin />}
      mapPayload={(values) => ({
        settlementWindow: values.energySharing.settlementWindow,
        creditPolicy: values.energySharing.creditPolicy,
        debtPolicy: values.energySharing.debtPolicy,
        effectiveFrom: values.energySharing.effectiveFrom,
      })}
    />
  );
};
