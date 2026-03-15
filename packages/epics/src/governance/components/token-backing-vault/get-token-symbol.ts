import { TOKENS } from '@hypha-platform/core/client';
import type { DbToken } from '@hypha-platform/core/client';

export function getTokenSymbol(
  address: string,
  dbTokens?: DbToken[],
  spaceTokens?: { address?: string; symbol?: string }[],
): string {
  const lower = address?.toLowerCase();
  const known = TOKENS.find((t) => t.address?.toLowerCase() === lower);
  if (known) return known.symbol;
  const db = dbTokens?.find((t) => t.address?.toLowerCase() === lower);
  if (db?.symbol) return db.symbol;
  const space = spaceTokens?.find((t) => t.address?.toLowerCase() === lower);
  if (space?.symbol) return space.symbol;
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
}
