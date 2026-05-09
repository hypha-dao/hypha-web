'use client';

import { FC } from 'react';
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
import { useTranslations } from 'next-intl';

const SingleVaultSection: FC<{
  vault: Vault;
  isLoading?: boolean;
  lang: Locale;
  canUpdateVault: boolean;
  updateVaultHref: string;
  updateDisabledTitle: string;
}> = ({
  vault,
  isLoading,
  lang,
  canUpdateVault,
  updateVaultHref,
  updateDisabledTitle,
}) => {
  const tTreasury = useTranslations('TreasuryTab');
  const translatedTitle = tTreasury('vaultsSection.vaultTitle', {
    symbol: vault.tokenSymbol,
  });
  const totalLabel = tTreasury('vaultsSection.totalLabel', {
    amount: formatCurrencyValue(vault.totalUsd),
    percent: formatCurrencyValue(vault.backingPercent),
  });
  const perVaultUpdateHref = `${updateVaultHref}&spaceToken=${encodeURIComponent(
    vault.spaceToken,
  )}`;

  return (
    <div className="flex flex-col w-full justify-center items-center gap-3">
      <div className="w-full flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-4 font-semibold tracking-tight text-foreground">
            {translatedTitle}
          </h3>
          <p className="mt-1 text-2 text-muted-foreground">{totalLabel}</p>
        </div>
        {canUpdateVault ? (
          <Link href={perVaultUpdateHref} scroll={false}>
            <Button>{tTreasury('vaultsSection.updateBackingVault')}</Button>
          </Link>
        ) : (
          <Button disabled title={updateDisabledTitle}>
            {tTreasury('vaultsSection.updateBackingVault')}
          </Button>
        )}
      </div>
      <div className="w-full">
        {vault.collaterals.length === 0 && !isLoading ? (
          <Empty>
            <p>{tTreasury('vaultsSection.noCollateralInVault')}</p>
          </Empty>
        ) : (
          <div className="mt-2 grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-2">
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
          <div className="mt-2 grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-2">
            <VaultCollateralCard isLoading />
          </div>
        )}
      </div>
    </div>
  );
};

export const VaultsSection: FC = () => {
  const tTreasury = useTranslations('TreasuryTab');
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const { vaults, isLoading } = useVaults();
  const { space } = useSpaceBySlug(id);
  const spaceId = space?.web3SpaceId as number | undefined;
  const { isAuthenticated } = useAuthentication();
  const { isDelegate } = useIsDelegate({ spaceId });
  const { isMember } = useSpaceMember({ spaceId });

  const canUpdateVault = isAuthenticated && (isMember || isDelegate);
  const updateVaultHref = `/${lang}/dho/${id}/treasury/create/token-backing-vault?hideBack=true`;
  const updateDisabledTitle = !isAuthenticated
    ? tTreasury('vaultsSection.signInToUpdateBackingVault')
    : tTreasury('vaultsSection.joinSpaceToUpdateBackingVault');

  if (vaults.length === 0 && !isLoading) {
    return (
      <div className="flex w-full flex-col items-center justify-center">
        <Empty>
          <p>{tTreasury('listIsEmpty')}</p>
        </Empty>
      </div>
    );
  }

  // Treasury page stacks Rewards / Vaults / Balance with only `gap-6` between
  // them. When the vault block is present the three regions visually merge —
  // the user reported "everything seems to mush on top of each other". Render
  // a divider above and below this section (only when it renders) so the
  // separations show up exclusively when there's a vault to break apart.
  return (
    <div className="flex flex-col w-full justify-center items-center gap-6">
      {vaults.map((vault, index) => (
        <SingleVaultSection
          key={`${vault.spaceToken}-${index}`}
          vault={vault}
          isLoading={isLoading}
          lang={lang}
          canUpdateVault={canUpdateVault}
          updateVaultHref={updateVaultHref}
          updateDisabledTitle={updateDisabledTitle}
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
          lang={lang}
          canUpdateVault={canUpdateVault}
          updateVaultHref={updateVaultHref}
          updateDisabledTitle={updateDisabledTitle}
        />
      )}
    </div>
  );
};
