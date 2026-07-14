'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  createAgreementFiles,
  schemaCreateAgreementForm,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { AddEnergyMemberPlugin } from '../../agreements/plugins/add-energy-member/plugin';

const parseDeviceIds = (csv: string) => {
  const parsed = csv.split(',').map((value) => Number(value.trim()));
  if (parsed.some((value) => !Number.isFinite(value))) {
    throw new Error('Device IDs must be comma-separated numbers');
  }
  return parsed;
};

export const CreateAddEnergyMemberForm = ({
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

  const schema = React.useMemo(
    () =>
      schemaCreateAgreementForm.extend(createAgreementFiles).extend({
        energyMember: z.object({
          memberAddress: z
            .string()
            .trim()
            .regex(/^0x[a-fA-F0-9]{40}$/, t('validation.selectMemberOrSpace')),
          metadataHash: z
            .string()
            .trim()
            .min(1, t('validation.metadataHashRequired')),
          deviceIdsCsv: z
            .string()
            .trim()
            .min(1, t('validation.deviceIdsRequired'))
            .refine(
              (csv) =>
                csv
                  .split(',')
                  .every((value) => Number.isFinite(Number(value.trim()))),
              t('validation.deviceIdsCommaNumbers'),
            ),
        }),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schema}
      label={tAgreementFlow('labels.addEnergyMember')}
      stickyHeaderTitle={t('forms.stickyHeaders.addEnergyMember')}
      resubmitTemplateSegment="add-energy-member"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={<AddEnergyMemberPlugin members={members} spaces={spaces} />}
      mapPayload={(values) => ({
        memberAddress: values.energyMember.memberAddress,
        metadataHash: values.energyMember.metadataHash,
        deviceIds: parseDeviceIds(values.energyMember.deviceIdsCsv),
      })}
    />
  );
};
