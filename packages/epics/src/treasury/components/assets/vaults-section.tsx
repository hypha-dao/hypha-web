'use client';

import { FC } from 'react';
import { SectionFilter } from '@hypha-platform/ui/server';
import { useVaults, type Vault } from '../../hooks/use-vaults';
import { VaultCollateralCard } from './vault-collateral-card';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { Empty } from '../../../common';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { useAuthentication } from '@hypha-platform/authentication';
import { useIsDelegate, useSpaceBySlug } from '@hypha-platform/core/client';
import { useSpaceMember } from '../../../spaces';

const SingleVaultSection: FC<{
  vault: Vault;
  isLoading?: boolean;
}> = ({ vault, isLoading }) => {
  const { lang } = useParams<{ lang: Locale }>();
  const title = `${vault.tokenSymbol} Backing Vault`;
  const totalLabel = `$${formatCurrencyValue(
    vault.totalUsd,
  )} Collateral | ${formatCurrencyValue(vault.backingPercent)}% Backed`;

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
                tokenPrice={collateral.tokenPrice}
                supply={collateral.supply}
                space={collateral.space}
                createdAt={
                  collateral.createdAt
                    ? new Date(collateral.createdAt)
                    : undefined
                }
                lang={lang}
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
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const { vaults, isLoading } = useVaults();
  const { space } = useSpaceBySlug(id);
  const spaceId = space?.web3SpaceId as number | undefined;
  const { isAuthenticated } = useAuthentication();
  const { isDelegate } = useIsDelegate({ spaceId });
  const { isMember } = useSpaceMember({ spaceId });

  const canUpdateVault = isAuthenticated && (isMember || isDelegate);
  const updateVaultHref = `/${lang}/dho/${id}/treasury/create/token-backing-vault?hideBack=true`;

  if (vaults.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="flex flex-col w-full justify-center items-center gap-6">
      <div className="w-full flex items-center justify-between">
        <h3 className="text-4">Backing Vaults</h3>
        {canUpdateVault ? (
          <Link href={updateVaultHref} scroll={false}>
            <Button>Update Backing Vault</Button>
          </Link>
        ) : (
          <Button
            disabled
            title={
              !isAuthenticated
                ? 'Please sign in to update backing vault'
                : 'Join the space to update backing vault'
            }
          >
            Update Backing Vault
          </Button>
        )}
      </div>
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
            backingPercent: 0,
            collaterals: [],
          }}
          isLoading
        />
      )}
    </div>
  );
};
