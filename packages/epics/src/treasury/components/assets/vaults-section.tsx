'use client';

import { FC } from 'react';
import { SectionFilter } from '@hypha-platform/ui/server';
import { useVaults, type Vault } from '../../hooks/use-vaults';
import { VaultCollateralCard } from './vault-collateral-card';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { Empty } from '../../../common';

const SingleVaultSection: FC<{
  vault: Vault;
  isLoading?: boolean;
}> = ({ vault, isLoading }) => {
  const title = `${vault.tokenSymbol} Vault`;
  const totalLabel = `$ ${formatCurrencyValue(vault.totalUsd)}`;

  return (
    <div className="flex flex-col w-full justify-center items-center gap-3">
      <div className="w-full flex justify-between">
        <SectionFilter label={title} count={totalLabel} />
      </div>
      <div className="w-full">
        {vault.collaterals.length === 0 && !isLoading ? (
          <Empty>
            <p>No collateral in this vault</p>
          </Empty>
        ) : (
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            {vault.collaterals.map((collateral, index) => (
              <VaultCollateralCard
                key={`${collateral.address}-${index}`}
                icon={collateral.icon}
                name={collateral.name}
                symbol={collateral.symbol}
                value={collateral.value}
                usdEqual={collateral.usdEqual}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}
        {isLoading && vault.collaterals.length === 0 && (
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <VaultCollateralCard isLoading />
          </div>
        )}
      </div>
    </div>
  );
};

export const VaultsSection: FC = () => {
  const { vaults, isLoading } = useVaults();

  if (vaults.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="flex flex-col w-full justify-center items-center gap-6">
      {vaults.map((vault, index) => (
        <SingleVaultSection
          key={`${vault.spaceToken}-${index}`}
          vault={vault}
          isLoading={isLoading}
        />
      ))}
      {isLoading && vaults.length === 0 && (
        <SingleVaultSection
          vault={{
            spaceToken: '',
            tokenName: '',
            tokenSymbol: '',
            tokenIcon: '',
            totalUsd: 0,
            collaterals: [],
          }}
          isLoading
        />
      )}
    </div>
  );
};
