'use client';

import { TokenBackingVaultCollateralItem } from './token-backing-vault-collateral-item';
import type { DbToken } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

interface TokenBackingVaultRemoveCollateralsProps {
  collaterals: Array<{ token: string; amount: string }>;
  dbTokens?: DbToken[];
  spaceTokens?: { address?: string; symbol?: string }[];
}

export function TokenBackingVaultRemoveCollaterals({
  collaterals,
  dbTokens,
  spaceTokens,
}: TokenBackingVaultRemoveCollateralsProps) {
  const tProposalDetails = useTranslations('ProposalDetails');
  return (
    <div className="flex flex-col gap-2">
      <div className="text-1 text-neutral-11">
        {tProposalDetails('labels.withdrawCollaterals')}
      </div>
      {collaterals.map((c, i) => (
        <TokenBackingVaultCollateralItem
          key={`${c.token}-${i}`}
          token={c.token}
          amount={c.amount}
          dbTokens={dbTokens}
          spaceTokens={spaceTokens}
        />
      ))}
    </div>
  );
}
