'use client';

import { useReadContract } from 'wagmi';
import { z } from 'zod';
import {
  buildDeployCommunityTransaction,
  createAgreementFiles,
  ENERGY_PPA_CHAIN_ID,
  schemaCreateAgreementForm,
} from '@hypha-platform/core/client';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { EnableEnergyCommunityPlugin } from '../../agreements/plugins/enable-energy-community/plugin';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

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

const sourceTypeField = z
  .string()
  .trim()
  .min(1, 'Source type is required')
  .refine(
    (value) => ['SOLAR', 'BATTERY'].includes(value.toUpperCase()),
    'Source type must be SOLAR or BATTERY',
  );

const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/;

const sourceSchema = z
  .object({
    sourceId: z.string().trim().min(1, 'Source ID is required'),
    sourceType: sourceTypeField,
    tokenName: z.string().trim().min(1, 'Token name is required'),
    tokenSymbol: z.string().trim().min(1, 'Token symbol is required'),
    basePricePerKwh: z
      .string()
      .trim()
      .min(1, 'Base price is required')
      .refine((value) => /^\d+$/.test(value), 'Must be an integer'),
    holdersCsv: z
      .string()
      .trim()
      .min(1, 'At least one holder address is required'),
    holderAmountsCsv: z
      .string()
      .trim()
      .min(1, 'At least one holder amount is required'),
  })
  .superRefine((value, ctx) => {
    const holders = value.holdersCsv
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const amounts = value.holderAmountsCsv
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (holders.length !== amounts.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['holderAmountsCsv'],
        message: 'Holder amounts count must match holder addresses count',
      });
    }

    if (holders.some((holder) => !ADDRESS_RE.test(holder))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['holdersCsv'],
        message: 'Every holder address must be a valid 0x address',
      });
    }

    if (amounts.some((amount) => !/^\d+$/.test(amount))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['holderAmountsCsv'],
        message: 'Every holder amount must be an integer',
      });
    }
  });

const memberSchema = z
  .object({
    memberAddress: z
      .string()
      .trim()
      .regex(ADDRESS_RE, 'Invalid member address'),
    metadataHash: z
      .string()
      .trim()
      .regex(BYTES32_RE, 'Metadata hash must be a bytes32 hex value'),
    deviceIdsCsv: z
      .string()
      .trim()
      .min(1, 'At least one device ID is required'),
  })
  .superRefine((value, ctx) => {
    const deviceIds = value.deviceIdsCsv
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (deviceIds.some((id) => !/^\d+$/.test(id))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deviceIdsCsv'],
        message: 'Device IDs must be comma-separated integers',
      });
    }
  });

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
      sources: z.array(sourceSchema).min(1, 'At least one source is required'),
      members: z.array(memberSchema).optional(),
    }),
  });

type FormValues = z.infer<typeof schemaCreateEnableEnergyCommunityForm>;

const parseCsv = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const parseOptionalNumber = (value: string | undefined): number => {
  if (!value) return 0;
  return Number(value);
};

const formActivationFromValues = (values: FormValues) => ({
  ...values.energyCommunityActivation,
  sources: values.energyCommunityActivation.sources.map((source) => ({
    sourceId: source.sourceId,
    sourceType: source.sourceType.toUpperCase(),
    tokenName: source.tokenName,
    tokenSymbol: source.tokenSymbol,
    basePricePerKwh: source.basePricePerKwh,
    holders: parseCsv(source.holdersCsv),
    holderAmounts: parseCsv(source.holderAmountsCsv),
  })),
  members: (values.energyCommunityActivation.members ?? []).map((member) => ({
    memberAddress: member.memberAddress,
    deviceIds: parseCsv(member.deviceIdsCsv).map((id) => Number(id)),
    metadataHash: member.metadataHash,
  })),
});

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
  const daoSpaceFactory =
    daoSpaceFactoryImplementationAddress[ENERGY_PPA_CHAIN_ID];

  const { data: executorAddress } = useReadContract({
    chainId: ENERGY_PPA_CHAIN_ID,
    address: daoSpaceFactory,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'getSpaceExecutor',
    args: typeof web3SpaceId === 'number' ? [BigInt(web3SpaceId)] : undefined,
    query: { enabled: typeof web3SpaceId === 'number' },
  });

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
      defaultValues={
        executorAddress
          ? ({
              energyCommunityActivation: {
                admin: executorAddress,
              },
            } as Partial<FormValues>)
          : undefined
      }
      mapPayload={(values) => {
        const activation = formActivationFromValues(values);
        const adminOverride = (executorAddress ?? activation.admin) as string;
        return {
          contractMethod: 'deployCommunity',
          communityParams: {
            admin: adminOverride,
            stablecoin: activation.stablecoin,
            communityAddress: activation.communityAddress || '',
            aggregatorAddress: activation.aggregatorAddress || '',
            gridOperator: activation.gridOperator,
            communityFeeBps: parseOptionalNumber(activation.communityFeeBps),
            aggregatorFeeBps: parseOptionalNumber(activation.aggregatorFeeBps),
            exportDeviceId: activation.exportDeviceId?.trim() || '0',
            energyTokenName: activation.energyTokenName,
            energyTokenSymbol: activation.energyTokenSymbol,
            sources: activation.sources,
            members: activation.members,
          },
        };
      }}
      buildExtraTransactions={(values) => {
        // Hypha discovery looks up `EnergyPPAv2Factory.adminCommunities[admin]`
        // where `admin` must match the address that called the factory. Since
        // the DAO proposal executes via the space executor, force `admin` to
        // the executor regardless of what the user typed.
        if (!executorAddress) {
          throw new Error(
            'Space executor is not loaded yet. Please retry in a moment.',
          );
        }
        const activation = formActivationFromValues(values);
        const tx = buildDeployCommunityTransaction({
          admin: executorAddress as string,
          stablecoin: activation.stablecoin,
          communityAddress: activation.communityAddress,
          aggregatorAddress: activation.aggregatorAddress,
          gridOperator: activation.gridOperator,
          communityFeeBps: activation.communityFeeBps,
          aggregatorFeeBps: activation.aggregatorFeeBps,
          exportDeviceId: activation.exportDeviceId,
          energyTokenName: activation.energyTokenName,
          energyTokenSymbol: activation.energyTokenSymbol,
          sources: activation.sources,
          members: activation.members,
        });
        return [tx];
      }}
    />
  );
};
