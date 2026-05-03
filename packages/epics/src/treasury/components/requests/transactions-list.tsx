'use client';

import { FC } from 'react';
import { TransferCard } from './transfer-card';
import { TransferWithEntity, useEscrowIdFromTx } from '../../hooks';
import { ZeroAddress } from 'ethers';
import { tokenBackingVaultImplementationAddress } from '@hypha-platform/core/generated';
import { getEscrowImplementationAddress } from '@hypha-platform/core/client';
import { useVaults } from '../../hooks/use-vaults';
import { useChainId } from 'wagmi';
import { useTranslations } from 'next-intl';

/**
 * Resolve the escrow ID associated with a transfer's transaction by parsing
 * receipt logs lazily; renders the base label until the lookup resolves so
 * the row never blocks on RPC.
 */
const EscrowAccountTransferCard: FC<{
  transfer: TransferWithEntity;
  index: number;
  vaultDisplayName: string;
  isLoading?: boolean;
}> = ({ transfer, index, vaultDisplayName: _vaultDisplayName, isLoading }) => {
  const tTreasury = useTranslations('TreasuryTab');
  const baseLabel = tTreasury('transactionCard.counterparty.escrowAccount');
  const { escrowId } = useEscrowIdFromTx(transfer.transactionHash);
  const title =
    typeof escrowId === 'bigint' ? `${baseLabel} (#${escrowId})` : baseLabel;
  return (
    <TransferCard
      key={`${transfer.transactionHash}-${index}`}
      name={transfer.person?.name}
      surname={transfer.person?.surname}
      title={transfer.space?.title || title}
      avatar={transfer.person?.avatarUrl || transfer.space?.avatarUrl}
      tokenIcon={transfer.tokenIcon}
      value={transfer.value}
      symbol={transfer.symbol}
      date={transfer.timestamp}
      isLoading={isLoading}
      direction={transfer.direction}
      counterparty={transfer.counterparty}
      from={transfer.from}
      to={transfer.to}
      isMint={transfer.from === ZeroAddress}
      memo={transfer.memo}
    />
  );
};

type TransactionsListProps = {
  transfers: TransferWithEntity[];
  activeSort: string;
  isLoading?: boolean;
};

export const TransactionsList: FC<TransactionsListProps> = ({
  transfers,
  activeSort: _activeSort,
  isLoading,
}) => {
  const { vaults } = useVaults();
  const chainId = useChainId();
  const escrowImpl = getEscrowImplementationAddress();
  const escrowLower = escrowImpl?.toLowerCase();
  const vaultAddress =
    tokenBackingVaultImplementationAddress[
      Number(
        chainId || 8453,
      ) as keyof typeof tokenBackingVaultImplementationAddress
    ]?.toLowerCase();
  const firstVault = vaults[0];
  const singleVaultName =
    vaults.length === 1 && firstVault
      ? `${firstVault.tokenSymbol} Backing Vault`
      : undefined;

  return (
    <div className="w-full mt-1">
      {transfers.map((transfer, index) => {
        const counterpartyAddress =
          transfer.counterparty === 'from' ? transfer.from : transfer.to;
        const tokenAddress =
          transfer.contractAddress ??
          ('token' in transfer && typeof transfer.token === 'string'
            ? transfer.token
            : '');
        const transferTokenAddress = tokenAddress.toLowerCase();
        const matchedVault = vaults.find((vault) =>
          vault.collaterals.some(
            (collateral) =>
              collateral.address.toLowerCase() === transferTokenAddress,
          ),
        );
        const isVaultCounterparty =
          !!vaultAddress &&
          counterpartyAddress?.toLowerCase() === vaultAddress &&
          !transfer.space?.title;
        const isEscrowCounterparty =
          !!escrowLower && counterpartyAddress?.toLowerCase() === escrowLower;
        const vaultDisplayName = matchedVault
          ? `${matchedVault.tokenSymbol} Backing Vault`
          : singleVaultName ?? 'Token Backing Vault';

        if (isEscrowCounterparty && !transfer.space?.title) {
          return (
            <EscrowAccountTransferCard
              key={`${transfer.transactionHash}-${index}`}
              transfer={transfer}
              index={index}
              vaultDisplayName={vaultDisplayName}
              isLoading={isLoading}
            />
          );
        }

        return (
          <TransferCard
            key={`${transfer.transactionHash}-${index}`}
            name={transfer.person?.name}
            surname={transfer.person?.surname}
            title={
              transfer.space?.title ||
              (isVaultCounterparty ? vaultDisplayName : undefined)
            }
            avatar={transfer.person?.avatarUrl || transfer.space?.avatarUrl}
            tokenIcon={transfer.tokenIcon}
            value={transfer.value}
            symbol={transfer.symbol}
            date={transfer.timestamp}
            isLoading={isLoading}
            direction={transfer.direction}
            counterparty={transfer.counterparty}
            from={transfer.from}
            to={transfer.to}
            isMint={transfer.from === ZeroAddress}
            memo={transfer.memo}
          />
        );
      })}
      {isLoading && (
        <div className="w-full grid grid-cols-1 gap-2 mt-1">
          <TransferCard isLoading={isLoading} />
          <TransferCard isLoading={isLoading} />
          <TransferCard isLoading={isLoading} />
          <TransferCard isLoading={isLoading} />
        </div>
      )}
    </div>
  );
};
