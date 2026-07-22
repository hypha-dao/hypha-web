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

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

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
          recipient: z
            .string()
            .trim()
            .regex(ADDRESS_RE, t('validation.selectMemberOrSpace')),
          meterCount: z
            .string()
            .trim()
            .refine(
              (value) => /^\d+$/.test(value),
              t('validation.wholeMeters'),
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
      defaultValues={
        {
          energyMember: { recipient: '', meterCount: '0' },
        } as Partial<FormValues>
      }
      mapPayload={(values) => ({
        members: [
          t('optimization.metersPerMember', {
            address: values.energyMember.recipient,
            count: Number(values.energyMember.meterCount || '0'),
          }),
        ],
      })}
    />
  );
};
