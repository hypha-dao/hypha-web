'use client';

import { z } from 'zod';
import {
  createAgreementFiles,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { EnableEnergyCommunityPlugin } from '../../agreements/plugins/enable-energy-community/plugin';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const optionalAddressField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || ADDRESS_RE.test(value), 'Invalid address');

const optionalBpsField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d+$/.test(value), 'Must be an integer')
  .refine((value) => !value || Number(value) <= 10000, 'Must be <= 10000');

const optionalUintField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d+$/.test(value), 'Must be an integer');

const requiredJsonArrayField = z
  .string()
  .trim()
  .min(1, 'Sources JSON is required')
  .refine((value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }, 'Must be a valid non-empty JSON array');

const optionalJsonArrayField = z
  .string()
  .trim()
  .optional()
  .refine((value) => {
    if (!value) return true;
    try {
      return Array.isArray(JSON.parse(value));
    } catch {
      return false;
    }
  }, 'Must be a valid JSON array');

const schemaCreateEnableEnergyCommunityForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend({
    energyCommunityActivation: z.object({
      admin: z.string().trim().regex(ADDRESS_RE, 'Invalid admin address'),
      stablecoin: z
        .string()
        .trim()
        .regex(ADDRESS_RE, 'Invalid stablecoin address'),
      gridOperator: z
        .string()
        .trim()
        .regex(ADDRESS_RE, 'Invalid grid operator address'),
      communityAddress: optionalAddressField,
      aggregatorAddress: optionalAddressField,
      communityFeeBps: optionalBpsField,
      aggregatorFeeBps: optionalBpsField,
      exportDeviceId: optionalUintField,
      energyTokenName: z
        .string()
        .trim()
        .min(1, 'Energy token name is required'),
      energyTokenSymbol: z
        .string()
        .trim()
        .min(1, 'Energy token symbol is required'),
      sourcesJson: requiredJsonArrayField,
      membersJson: optionalJsonArrayField,
    }),
  });

type FormValues = z.infer<typeof schemaCreateEnableEnergyCommunityForm>;

const parseJsonArray = (value: string | undefined): JsonValue[] => {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? (parsed as JsonValue[]) : [];
};

const parseOptionalNumber = (value: string | undefined): number => {
  if (!value) return 0;
  return Number(value);
};

export const CreateEnableEnergyCommunityForm = ({
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
      schema={schemaCreateEnableEnergyCommunityForm}
      label="Enable Energy Community"
      stickyHeaderTitle="Create Enable Energy Community Proposal"
      resubmitTemplateSegment="enable-energy-community"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={<EnableEnergyCommunityPlugin />}
      mapPayload={(values) => ({
        contractMethod: 'deployCommunity',
        communityParams: {
          admin: values.energyCommunityActivation.admin,
          stablecoin: values.energyCommunityActivation.stablecoin,
          communityAddress:
            values.energyCommunityActivation.communityAddress || '',
          aggregatorAddress:
            values.energyCommunityActivation.aggregatorAddress || '',
          gridOperator: values.energyCommunityActivation.gridOperator,
          communityFeeBps: parseOptionalNumber(
            values.energyCommunityActivation.communityFeeBps,
          ),
          aggregatorFeeBps: parseOptionalNumber(
            values.energyCommunityActivation.aggregatorFeeBps,
          ),
          exportDeviceId:
            values.energyCommunityActivation.exportDeviceId?.trim() || '0',
          energyTokenName: values.energyCommunityActivation.energyTokenName,
          energyTokenSymbol: values.energyCommunityActivation.energyTokenSymbol,
          sources: parseJsonArray(values.energyCommunityActivation.sourcesJson),
          members: parseJsonArray(values.energyCommunityActivation.membersJson),
        },
      })}
    />
  );
};
