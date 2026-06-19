'use client';

import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useReadContract } from 'wagmi';
import { z } from 'zod';
import {
  buildDeployCommunityTransaction,
  createAgreementFiles,
  ENERGY_PPA_CHAIN_ID,
  percentageStringToBigInt,
  schemaCreateAgreementForm,
  type EnergyDeployCommunityInput,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { EnableEnergyCommunityPlugin } from '../../agreements/plugins/enable-energy-community/plugin';
import {
  basePurposeLabel,
  ENERGY_OPTIMIZATION_DEFAULTS,
  energyOptimizationSchema,
  optimizationFormToContract,
  percentageString,
} from '../../agreements/plugins/enable-energy-community/energy-form-fields';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const optionalAddressField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || ADDRESS_RE.test(value), 'Invalid address');

const optionalPercentField = z
  .string()
  .trim()
  .optional()
  .refine((value) => {
    if (!value) return true;
    try {
      percentageStringToBigInt(value);
      return true;
    } catch {
      return false;
    }
  }, 'Enter a percentage between 0 and 100');

const optionalUintField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d+$/.test(value), 'Must be an integer');

/**
 * Human price → on-chain integer "internal units" (1 unit = 0.01 of the
 * settlement currency). Accepts both `.` and `,` as the decimal separator and
 * up to two decimals, so a value like `0,11` or `0.11` becomes `11`.
 */
const PRICE_RE = /^\d+(?:[.,]\d{1,2})?$/;

const priceToInternalUnits = (input: string): string => {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid price: ${input}`);
  }
  const wholePart = match[1];
  if (!wholePart) {
    throw new Error(`Invalid price: ${input}`);
  }
  const whole = BigInt(wholePart);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return (whole * 100n + BigInt(fraction)).toString();
};

const internalUnitsToPriceDisplay = (units: string): string => {
  const value = Number(units);
  if (!Number.isFinite(value)) return units;
  return (value / 100).toFixed(2);
};

const memberRowSchema = z.object({
  recipient: z.string().trim().regex(ADDRESS_RE, 'Select a member'),
  meterCount: z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value), 'Enter a whole number of meters'),
});

const ownerRowSchema = z.object({
  recipient: z.string().trim().regex(ADDRESS_RE, 'Select a member'),
  percentage: percentageString,
});

const sourceSchema = z
  .object({
    name: z.string().trim().min(1, 'Source name is required'),
    sourceType: z.enum(['SOLAR', 'BATTERY']),
    basePricePerKwh: z
      .string()
      .trim()
      .min(1, 'Base price is required')
      .refine(
        (value) => PRICE_RE.test(value) && Number(value.replace(',', '.')) > 0,
        'Enter a price greater than 0 (max 2 decimals, e.g. 0.11)',
      ),
    owners: z.array(ownerRowSchema).min(1, 'Add at least one owner'),
    tokenName: z.string().trim().optional(),
    tokenSymbol: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    let totalBps = 0n;
    let valid = true;
    for (const owner of value.owners) {
      try {
        totalBps += percentageStringToBigInt(owner.percentage);
      } catch {
        valid = false;
      }
    }
    if (valid && value.owners.length > 0 && totalBps !== 10000n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['owners'],
        message: 'Ownership shares must total 100%',
      });
    }
  });

const schemaCreateEnableEnergyCommunityForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend({
    energyOptimization: energyOptimizationSchema,
    energyCommunityActivation: z
      .object({
        admin: z.string().trim().regex(ADDRESS_RE, 'Invalid admin address'),
        stablecoin: optionalAddressField,
        gridOperator: optionalAddressField,
        communityAddress: optionalAddressField,
        aggregatorAddress: optionalAddressField,
        communityFeePercent: optionalPercentField,
        aggregatorFeePercent: optionalPercentField,
        exportDeviceId: optionalUintField,
        energyTokenName: z.string().trim().optional(),
        energyTokenSymbol: z.string().trim().optional(),
        members: z.array(memberRowSchema).optional(),
        sources: z
          .array(sourceSchema)
          .min(1, 'At least one source is required'),
      })
      .superRefine((value, ctx) => {
        // Revenue is only distributed to registered members (the contract loops
        // over `memberAddresses`). A source owner who is not also a member would
        // silently lose their share, so require every owner to be a member.
        const memberAddresses = new Set(
          (value.members ?? []).map((member) =>
            member.recipient.trim().toLowerCase(),
          ),
        );

        value.sources.forEach((source, sourceIndex) => {
          source.owners.forEach((owner, ownerIndex) => {
            const address = owner.recipient.trim().toLowerCase();
            if (!address || memberAddresses.has(address)) return;
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['sources', sourceIndex, 'owners', ownerIndex, 'recipient'],
              message:
                'This owner must also be added as a member (meter count 0 is fine) or they will not receive revenue.',
            });
          });
        });
      }),
  });

type FormValues = z.infer<typeof schemaCreateEnableEnergyCommunityForm>;

const deriveSymbol = (name: string): string =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'SRC';

/**
 * Map the human-friendly form values into the on-chain `deployCommunity`
 * input: members → sequential device IDs from meter counts, sources →
 * keccak'd source ID + token name/symbol + ownership shares (bps), and the
 * optimization strategy (purpose ranking + social allocation).
 */
const formToDeployInput = (
  values: FormValues,
  executorAddress: string | undefined,
): EnergyDeployCommunityInput => {
  const activation = values.energyCommunityActivation;
  const optimization = optimizationFormToContract(values.energyOptimization);
  const admin = (executorAddress ?? activation.admin) as string;

  let nextDeviceId = 1;
  const members = (activation.members ?? []).map((member) => {
    const count = Number(member.meterCount || '0');
    const deviceIds: number[] = [];
    for (let i = 0; i < count; i += 1) {
      deviceIds.push(nextDeviceId);
      nextDeviceId += 1;
    }
    return {
      memberAddress: member.recipient,
      deviceIds,
      metadataHash: ZERO_BYTES32,
    };
  });

  const sources = activation.sources.map((source) => ({
    sourceId: source.name,
    sourceType: source.sourceType,
    tokenName: source.tokenName?.trim() || source.name.trim(),
    tokenSymbol: source.tokenSymbol?.trim() || deriveSymbol(source.name),
    basePricePerKwh: priceToInternalUnits(source.basePricePerKwh),
    holders: source.owners.map((owner) => owner.recipient),
    holderAmounts: source.owners.map((owner) =>
      percentageStringToBigInt(owner.percentage).toString(),
    ),
  }));

  return {
    admin,
    stablecoin: activation.stablecoin?.trim() || BASE_USDC,
    communityAddress: activation.communityAddress?.trim() || '',
    aggregatorAddress: activation.aggregatorAddress?.trim() || '',
    gridOperator: activation.gridOperator?.trim() || admin,
    communityFeeBps: activation.communityFeePercent?.trim()
      ? Number(percentageStringToBigInt(activation.communityFeePercent))
      : 0,
    aggregatorFeeBps: activation.aggregatorFeePercent?.trim()
      ? Number(percentageStringToBigInt(activation.aggregatorFeePercent))
      : 0,
    exportDeviceId: activation.exportDeviceId?.trim() || '0',
    energyTokenName:
      activation.energyTokenName?.trim() || 'Community Energy Credit',
    energyTokenSymbol: activation.energyTokenSymbol?.trim() || 'NRG',
    sources,
    members,
    ...optimization,
  };
};

export const CreateEnableEnergyCommunityForm = ({
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

  const isValidExecutor =
    typeof executorAddress === 'string' &&
    executorAddress.length === 42 &&
    executorAddress.toLowerCase() !== ZERO_ADDRESS;

  const formRef = React.useRef<UseFormReturn<
    FormValues,
    unknown,
    FormValues
  > | null>(null);

  // `react-hook-form` only reads `defaultValues` on first mount, so push the
  // executor address into the admin field via `setValue` once it resolves.
  React.useEffect(() => {
    if (!isValidExecutor || !formRef.current) return;
    const current = formRef.current.getValues(
      'energyCommunityActivation.admin' as const,
    );
    if (!current || current.trim() === '') {
      formRef.current.setValue(
        'energyCommunityActivation.admin' as const,
        executorAddress as string,
        { shouldValidate: true, shouldDirty: false, shouldTouch: false },
      );
    }
  }, [executorAddress, isValidExecutor]);

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
      plugin={<EnableEnergyCommunityPlugin members={members} spaces={spaces} />}
      formRef={formRef}
      defaultValues={
        {
          energyOptimization: ENERGY_OPTIMIZATION_DEFAULTS,
          energyCommunityActivation: {
            admin: isValidExecutor ? (executorAddress as string) : '',
            stablecoin: BASE_USDC,
            gridOperator: '',
            communityAddress: '',
            aggregatorAddress: '',
            communityFeePercent: '',
            aggregatorFeePercent: '',
            exportDeviceId: '',
            energyTokenName: 'Community Energy Credit',
            energyTokenSymbol: 'NRG',
            members: [],
            sources: [
              {
                name: '',
                sourceType: 'SOLAR',
                basePricePerKwh: '',
                owners: [],
                tokenName: '',
                tokenSymbol: '',
              },
            ],
          },
        } as Partial<FormValues>
      }
      mapPayload={(values) => {
        const optimization = optimizationFormToContract(
          values.energyOptimization,
        );
        const deployInput = formToDeployInput(values, executorAddress);
        const social =
          optimization.socialMode === 'NONE'
            ? 'Disabled'
            : optimization.socialMode === 'FIXED'
            ? `Fixed: ${optimization.socialFixedKwh} kWh per interval`
            : `Variable: ${(optimization.socialVariableBps / 100).toFixed(
                2,
              )}% of solar`;

        return {
          contractMethod: 'deployCommunity',
          optimization: {
            priorities: optimization.purposeRanking.map((purpose) =>
              basePurposeLabel(purpose),
            ),
            socialAllocation: social,
            goalWallets: optimization.socialWallets.map(
              (wallet, index) =>
                `${wallet}: ${(
                  (optimization.socialWalletShares[index] ?? 0) / 100
                ).toFixed(2)}%`,
            ),
          },
          energyToken: `${deployInput.energyTokenName} (${deployInput.energyTokenSymbol})`,
          members: (deployInput.members ?? []).map(
            (member) =>
              `${member.memberAddress} — ${member.deviceIds.length} meter(s)`,
          ),
          sources: deployInput.sources.map(
            (source) =>
              `${source.tokenName} [${
                source.sourceType
              }] @ ${internalUnitsToPriceDisplay(
                String(source.basePricePerKwh),
              )}/kWh`,
          ),
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
        const deployInput = formToDeployInput(values, executorAddress);
        const tx = buildDeployCommunityTransaction({
          ...deployInput,
          admin: executorAddress as string,
        });
        return [tx];
      }}
    />
  );
};
