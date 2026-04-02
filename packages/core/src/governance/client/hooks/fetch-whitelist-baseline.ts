import type { Person } from '../../../people/types';
import type { Space } from '../../../space/types';
import { publicClient } from '../../../client';
import { decayingSpaceTokenAbi } from '../../../generated';
import { normalizeWhitelistAddresses } from './whitelist-address-diff';

export type WhitelistBaselineFromChain = {
  /** Member wallet addresses only (for `batchSet*Whitelist`) */
  transferMemberAddresses: `0x${string}`[];
  receiveMemberAddresses: `0x${string}`[];
  /** On-chain space ids (for `batchAdd/Remove*WhitelistSpaces`) */
  transferSpaceIds: number[];
  receiveSpaceIds: number[];
  /** Space contract + member addresses flattened (for UI hydration) */
  from: `0x${string}`[];
  to: `0x${string}`[];
};

/**
 * Builds current on-chain whitelist address lists for diffing updates.
 * - Space side: `getTransferWhitelistedSpaces` / `getReceiveWhitelistedSpaces` → map web3 id → `spaces[].address`
 * - Member side: when enforcement is on, probe `canTransfer` / `canReceive` for known member wallets
 */
export async function fetchWhitelistBaselineFromChain({
  tokenAddress,
  spaces,
  members,
}: {
  tokenAddress: `0x${string}`;
  spaces: Space[];
  members: Person[];
}): Promise<WhitelistBaselineFromChain> {
  const contract = {
    address: tokenAddress,
    abi: decayingSpaceTokenAbi,
  } as const;

  const readResults = await publicClient.multicall({
    allowFailure: true,
    blockTag: 'safe',
    contracts: [
      { ...contract, functionName: 'useTransferWhitelist', args: [] },
      { ...contract, functionName: 'useReceiveWhitelist', args: [] },
      { ...contract, functionName: 'getTransferWhitelistedSpaces', args: [] },
      { ...contract, functionName: 'getReceiveWhitelistedSpaces', args: [] },
    ],
  });

  const useTransfer =
    readResults[0].status === 'success'
      ? (readResults[0].result as boolean)
      : false;
  const useReceive =
    readResults[1].status === 'success'
      ? (readResults[1].result as boolean)
      : false;
  const transferSpaceIds =
    readResults[2].status === 'success'
      ? (readResults[2].result as readonly bigint[]).map((x) => Number(x))
      : [];
  const receiveSpaceIds =
    readResults[3].status === 'success'
      ? (readResults[3].result as readonly bigint[]).map((x) => Number(x))
      : [];

  const byWeb3 = new Map<number, `0x${string}`>();
  for (const s of spaces) {
    if (s.web3SpaceId != null && s.address) {
      try {
        byWeb3.set(Number(s.web3SpaceId), s.address as `0x${string}`);
      } catch {
        // ignore
      }
    }
  }

  const fromSpaceAddrs = transferSpaceIds
    .map((id) => byWeb3.get(id))
    .filter((a): a is `0x${string}` => !!a);

  const toSpaceAddrs = receiveSpaceIds
    .map((id) => byWeb3.get(id))
    .filter((a): a is `0x${string}` => !!a);

  const memberWallets = members
    .map((m) => m.address)
    .filter((a): a is string => !!a && a.startsWith('0x')) as `0x${string}`[];

  let fromMemberAddrs: `0x${string}`[] = [];
  let toMemberAddrs: `0x${string}`[] = [];

  if (memberWallets.length > 0) {
    const transferCalls = useTransfer
      ? memberWallets.map((addr) => ({
          ...contract,
          functionName: 'canTransfer' as const,
          args: [addr],
        }))
      : [];
    const receiveCalls = useReceive
      ? memberWallets.map((addr) => ({
          ...contract,
          functionName: 'canReceive' as const,
          args: [addr],
        }))
      : [];

    if (transferCalls.length > 0) {
      const tr = await publicClient.multicall({
        allowFailure: true,
        blockTag: 'safe',
        contracts: transferCalls,
      });
      fromMemberAddrs = memberWallets.filter(
        (_, i) => tr[i]?.status === 'success' && tr[i]?.result === true,
      );
    }
    if (receiveCalls.length > 0) {
      const rc = await publicClient.multicall({
        allowFailure: true,
        blockTag: 'safe',
        contracts: receiveCalls,
      });
      toMemberAddrs = memberWallets.filter(
        (_, i) => rc[i]?.status === 'success' && rc[i]?.result === true,
      );
    }
  }

  return {
    transferMemberAddresses: normalizeWhitelistAddresses(fromMemberAddrs),
    receiveMemberAddresses: normalizeWhitelistAddresses(toMemberAddrs),
    transferSpaceIds: [...new Set(transferSpaceIds)].filter((n) =>
      Number.isFinite(n),
    ),
    receiveSpaceIds: [...new Set(receiveSpaceIds)].filter((n) =>
      Number.isFinite(n),
    ),
    from: normalizeWhitelistAddresses([...fromSpaceAddrs, ...fromMemberAddrs]),
    to: normalizeWhitelistAddresses([...toSpaceAddrs, ...toMemberAddrs]),
  };
}
