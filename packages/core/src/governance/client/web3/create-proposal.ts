import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';
import { schemaCreateProposalWeb3 } from '@hypha-platform/core/client';
import { base } from 'viem/chains';
import { z } from 'zod';

export type CreateProposalWeb3Input = {
  spaceId: bigint;
  duration: bigint;
  transactions: readonly {
    target: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
  }[];
};

export type CreateProposalWeb3Config = {
  chain?: keyof typeof daoProposalsImplementationAddress;
};

export const mapToCreateProposalWeb3Input = (
  d: z.infer<typeof schemaCreateProposalWeb3>,
): CreateProposalWeb3Input => ({
  spaceId: BigInt(d.spaceId),
  duration: BigInt(d.duration),
  transactions: d.transactions.map((tx) => ({
    target: tx.target as `0x${string}`,
    value: BigInt(tx.value),
    data: tx.data ? (tx.data as `0x${string}`) : '0x',
  })),
});

export const createProposal = (
  { spaceId, duration, transactions }: CreateProposalWeb3Input,
  { chain = base.id }: CreateProposalWeb3Config = {},
) => {
  const address = daoProposalsImplementationAddress[chain];

  const callConfig = {
    address,
    abi: daoProposalsImplementationAbi,
    functionName: 'createProposal' as const,
    args: [
      {
        spaceId,
        duration,
        transactions,
      },
    ] as const,
  };
  return callConfig;
};
