'use client';

import { TokenBackingVaultCollateralItem } from './token-backing-vault-collateral-item';
import type { DbToken } from '@hypha-platform/core/client';

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
  return (
    <div className="flex flex-col gap-2">
      <div className="text-1 text-neutral-11">Withdraw Collaterals</div>
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
