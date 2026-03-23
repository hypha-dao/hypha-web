'use client';

import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { getTokenSymbol } from './get-token-symbol';
import type { DbToken } from '@hypha-platform/core/client';

interface TokenBackingVaultCollateralItemProps {
  token: string;
  amount: string;
  dbTokens?: DbToken[];
  spaceTokens?: { address?: string; symbol?: string }[];
}

export function TokenBackingVaultCollateralItem({
  token,
  amount,
  dbTokens,
  spaceTokens,
}: TokenBackingVaultCollateralItemProps) {
  const symbol = getTokenSymbol(token, dbTokens, spaceTokens);
  const parsedAmount = Number.parseFloat(amount);
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  return (
    <div className="flex justify-between items-center text-1">
      <span>{symbol}</span>
      <span>
        {formatCurrencyValue(safeAmount)} {symbol}
      </span>
    </div>
  );
}
