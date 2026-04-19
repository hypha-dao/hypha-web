import { daoProposalsImplementationAddress } from '@hypha-platform/core/generated';

const DEFAULT_GOVERNANCE_CHAIN_ID = 8453 as const;

export type GovernanceChainId = keyof typeof daoProposalsImplementationAddress;

const parseConfiguredChainId = (value?: string): number | null => {
  if (!value) {
    return null;
  }

  // Validate that the string contains only digits
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const getGovernanceChainId = (): GovernanceChainId => {
  const configuredChainId = parseConfiguredChainId(
    process.env.NEXT_PUBLIC_GOVERNANCE_CHAIN_ID ??
      process.env.NEXT_PUBLIC_CHAIN_ID,
  );

  if (
    configuredChainId &&
    configuredChainId in daoProposalsImplementationAddress
  ) {
    return configuredChainId as GovernanceChainId;
  }

  return DEFAULT_GOVERNANCE_CHAIN_ID;
};