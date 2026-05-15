'use client';

import { z } from 'zod';
import {
  createAgreementFiles,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { RegisterEnergySourcePlugin } from '../../agreements/plugins/register-energy-source/plugin';

const schemaCreateRegisterEnergySourceForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend({
    energySource: z.object({
      sourceId: z.string().trim().min(1, 'Source ID is required'),
      sourceType: z.string().trim().min(1, 'Source type is required'),
      basePricePerKwh: z.string().trim().min(1, 'Base price is required'),
      ownershipToken: z.string().trim().min(1, 'Ownership token is required'),
      deviceIdsCsv: z.string().trim().optional(),
    }),
  });

type FormValues = z.infer<typeof schemaCreateRegisterEnergySourceForm>;

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
  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schemaCreateRegisterEnergySourceForm}
      label="Register Energy Source"
      stickyHeaderTitle="Create Register Energy Source Proposal"
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
