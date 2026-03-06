'use client';

import { TokenBackingVaultCollateralItem } from './token-backing-vault-collateral-item';
import type { DbToken } from '@hypha-platform/core/client';

interface TokenBackingVaultAddCollateralsProps {
  collaterals: Array<{ token: string; amount: string; decimals: number }>;
  dbTokens?: DbToken[];
  spaceTokens?: { address?: string; symbol?: string }[];
}

export function TokenBackingVaultAddCollaterals({
  collaterals,
  dbTokens,
  spaceTokens,
}: TokenBackingVaultAddCollateralsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-1 text-neutral-11">Add Collaterals</div>
      {collaterals.map((c, i) => (
        <TokenBackingVaultCollateralItem
          key={i}
          token={c.token}
          amount={c.amount}
          dbTokens={dbTokens}
          spaceTokens={spaceTokens}
        />
      ))}
    </div>
  );
}
