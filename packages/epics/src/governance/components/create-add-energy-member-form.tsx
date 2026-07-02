'use client';

import { z } from 'zod';
import {
  createAgreementFiles,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { AddEnergyMemberPlugin } from '../../agreements/plugins/add-energy-member/plugin';

const schemaCreateAddEnergyMemberForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend({
    energyMember: z.object({
      memberAddress: z
        .string()
        .trim()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid member address'),
      metadataHash: z.string().trim().min(1, 'Metadata hash is required'),
      deviceIdsCsv: z
        .string()
        .trim()
        .min(1, 'Device IDs are required')
        .refine(
          (csv) =>
            csv
              .split(',')
              .every((value) => Number.isFinite(Number(value.trim()))),
          'Device IDs must be comma-separated numbers',
        ),
    }),
  });

type FormValues = z.infer<typeof schemaCreateAddEnergyMemberForm>;

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
}: {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
}) => {
  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schemaCreateAddEnergyMemberForm}
      label="Add Energy Member"
      stickyHeaderTitle="Create Add Energy Member Proposal"
      resubmitTemplateSegment="add-energy-member"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={<AddEnergyMemberPlugin />}
      mapPayload={(values) => ({
        memberAddress: values.energyMember.memberAddress,
        metadataHash: values.energyMember.metadataHash,
        deviceIds: parseDeviceIds(values.energyMember.deviceIdsCsv),
      })}
    />
  );
};
