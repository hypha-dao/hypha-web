/**
 * Whether the update-token proposal section should render (has address + any decoded field).
 * Mirrors the previous inline conditional in proposal-detail.
 */
export function hasUpdateTokenDataToDisplay(
  u:
    | {
        address?: `0x${string}` | string;
        name?: string;
        symbol?: string;
        maxSupply?: bigint;
        transferable?: boolean;
        autoMinting?: boolean;
        priceWithCurrency?: unknown;
        decayPercentage?: bigint;
        decayInterval?: bigint;
        useTransferWhitelist?: boolean;
        useReceiveWhitelist?: boolean;
        initialTransferWhitelist?: unknown;
        initialReceiveWhitelist?: unknown;
        initialTransferWhitelistSpaceIds?: unknown;
        initialReceiveWhitelistSpaceIds?: unknown;
        archiveToken?: boolean;
        defaultCreditLimit?: bigint;
        addCreditWhitelistSpaceIds?: unknown;
        removeCreditWhitelistSpaceIds?: unknown;
      }
    | undefined,
): boolean {
  if (u?.address === undefined) {
    return false;
  }
  return (
    u.name !== undefined ||
    u.symbol !== undefined ||
    u.maxSupply !== undefined ||
    u.transferable !== undefined ||
    u.autoMinting !== undefined ||
    u.priceWithCurrency !== undefined ||
    u.decayPercentage !== undefined ||
    u.decayInterval !== undefined ||
    u.useTransferWhitelist !== undefined ||
    u.useReceiveWhitelist !== undefined ||
    u.initialTransferWhitelist !== undefined ||
    u.initialReceiveWhitelist !== undefined ||
    u.initialTransferWhitelistSpaceIds !== undefined ||
    u.initialReceiveWhitelistSpaceIds !== undefined ||
    u.archiveToken !== undefined ||
    u.defaultCreditLimit !== undefined ||
    u.addCreditWhitelistSpaceIds !== undefined ||
    u.removeCreditWhitelistSpaceIds !== undefined
  );
}
