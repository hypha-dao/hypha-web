'use client';

import { z } from 'zod';
import {
  createAgreementFiles,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { EnergySharingPlugin } from '../../agreements/plugins/energy-sharing/plugin';

const schemaCreateEnergySharingForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend({
    energySharing: z.object({
      settlementWindow: z
        .string()
        .trim()
        .min(1, 'Settlement window is required'),
      creditPolicy: z.string().trim().min(1, 'Credit policy is required'),
      debtPolicy: z.string().trim().min(1, 'Debt policy is required'),
      effectiveFrom: z.string().trim().min(1, 'Effective date is required'),
    }),
  });

type FormValues = z.infer<typeof schemaCreateEnergySharingForm>;

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
  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schemaCreateEnergySharingForm}
      label="Energy Sharing"
      stickyHeaderTitle="Create Energy Sharing Proposal"
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
