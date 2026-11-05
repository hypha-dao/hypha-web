'use client';

import {
  QUEST_DEFAULT_REWARD_TOKENS,
  TOKENS,
  type QuestReward,
} from '@hypha-platform/core/client';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Image,
  Input,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useMemo } from 'react';
import { useTokens, type ExtendedToken } from '../../treasury/hooks/use-tokens';

export type QuestRewardTokenMeta = {
  symbol: string;
  name: string;
  icon: string;
  spaceTitle?: string;
};

const BUILTIN_TOKEN_META: Record<string, QuestRewardTokenMeta> = {
  USDC: {
    symbol: 'USDC',
    name: 'USDC',
    icon: '/placeholder/usdc-icon.svg',
  },
  HYPHA: {
    symbol: 'HYPHA',
    name: 'Hypha',
    icon: '/placeholder/hypha-token-icon.svg',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '/placeholder/eth.svg',
  },
  WETH: {
    symbol: 'WETH',
    name: 'Ethereum',
    icon: '/placeholder/eth.svg',
  },
  EURC: {
    symbol: 'EURC',
    name: 'EURC',
    icon: '/placeholder/eurc-icon.svg',
  },
  AUDD: {
    symbol: 'AUDD',
    name: 'AUDD',
    icon: '/placeholder/audd-icon.svg',
  },
  CBBTC: {
    symbol: 'cbBTC',
    name: 'Bitcoin',
    icon: '/placeholder/btc.svg',
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: '/placeholder/btc.svg',
  },
};

export function resolveQuestRewardTokenMeta(
  rawSymbol: string,
  spaceTokens: readonly ExtendedToken[] = [],
): QuestRewardTokenMeta {
  const clean = rawSymbol.trim();
  const upper = clean.toUpperCase();

  const fromSpace = spaceTokens.find(
    (t) => t.symbol?.trim().toUpperCase() === upper,
  );
  if (fromSpace) {
    return {
      symbol: fromSpace.symbol,
      name: fromSpace.name || fromSpace.symbol,
      icon:
        fromSpace.icon ||
        BUILTIN_TOKEN_META[upper]?.icon ||
        '/placeholder/token-icon.svg',
      spaceTitle: fromSpace.space?.title,
    };
  }

  const fromCatalogue = TOKENS.find(
    (t) => t.symbol.trim().toUpperCase() === upper,
  );
  if (fromCatalogue) {
    return {
      symbol: fromCatalogue.symbol,
      name: fromCatalogue.name || fromCatalogue.symbol,
      icon: fromCatalogue.icon || '/placeholder/token-icon.svg',
    };
  }

  if (BUILTIN_TOKEN_META[upper]) {
    return BUILTIN_TOKEN_META[upper]!;
  }

  return {
    symbol: clean || 'TOKEN',
    name: clean || 'Token',
    icon: '/placeholder/token-icon.svg',
  };
}

export function useQuestRewardTokenCatalog(spaceSlug?: string): {
  tokens: QuestRewardTokenMeta[];
  spaceTokens: ExtendedToken[];
} {
  const { tokens: spaceTokens } = useTokens({ spaceSlug: spaceSlug ?? '' });

  const tokens = useMemo(() => {
    const byUpper = new Map<string, QuestRewardTokenMeta>();

    for (const st of spaceTokens) {
      const sym = st.symbol?.trim();
      if (!sym) continue;
      const key = sym.toUpperCase();
      if (byUpper.has(key)) continue;
      byUpper.set(key, resolveQuestRewardTokenMeta(sym, spaceTokens));
    }

    for (const sym of QUEST_DEFAULT_REWARD_TOKENS) {
      const key = sym.toUpperCase();
      if (byUpper.has(key)) continue;
      byUpper.set(key, resolveQuestRewardTokenMeta(sym, spaceTokens));
    }

    for (const cat of TOKENS) {
      const key = cat.symbol.toUpperCase();
      if (byUpper.has(key)) continue;
      byUpper.set(key, resolveQuestRewardTokenMeta(cat.symbol, spaceTokens));
    }

    return [...byUpper.values()];
  }, [spaceTokens]);

  return { tokens, spaceTokens };
}

/**
 * Treasury AssetCard (solo layout)-style reward item with circular token logo,
 * tabular amount + symbol, and token name subtitle.
 */
export function QuestRewardTokenCard({
  reward,
  spaceTokens = [],
  compact = false,
}: {
  reward: QuestReward;
  spaceTokens?: readonly ExtendedToken[];
  compact?: boolean;
}) {
  const meta = resolveQuestRewardTokenMeta(reward.token, spaceTokens);

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 border border-border bg-background-2/60 transition-colors',
        compact ? 'px-3 py-2.5' : 'p-3.5',
      )}
    >
      <Image
        className={cn(
          'shrink-0 rounded-full',
          compact ? 'size-7 min-h-7 min-w-7' : 'size-8 min-h-8 min-w-8',
        )}
        src={meta.icon}
        height={compact ? 28 : 32}
        width={compact ? 28 : 32}
        alt={meta.name}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p
          className={cn(
            'flex min-w-0 flex-wrap items-baseline gap-x-1.5 font-semibold tracking-tight text-foreground tabular-nums',
            compact ? 'text-[14px]' : 'text-3',
          )}
        >
          <span>{reward.amount}</span>
          <span className="text-xs font-medium text-neutral-11">
            {meta.symbol}
          </span>
        </p>
        <p className="truncate text-[11px] text-neutral-11">
          {meta.name}
          {meta.spaceTitle ? ` · ${meta.spaceTitle}` : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * Editable multi-token reward rows matching Hypha's TokenPayoutFieldArray
 * (amount input + DropdownMenu token selector with circular token logos).
 */
export function QuestRewardRowsEditor({
  rows,
  onChange,
  spaceSlug,
  tokenSymbols,
  addTestId,
}: {
  rows: QuestReward[];
  onChange: (next: QuestReward[]) => void;
  spaceSlug?: string;
  tokenSymbols?: readonly string[];
  addTestId?: string;
}) {
  const { tokens: catalogTokens, spaceTokens } =
    useQuestRewardTokenCatalog(spaceSlug);

  const options = useMemo(() => {
    const map = new Map<string, QuestRewardTokenMeta>();
    for (const item of catalogTokens) {
      map.set(item.symbol.toUpperCase(), item);
    }
    for (const sym of tokenSymbols ?? []) {
      const key = sym.trim().toUpperCase();
      if (!key || map.has(key)) continue;
      map.set(key, resolveQuestRewardTokenMeta(sym, spaceTokens));
    }
    return [...map.values()];
  }, [catalogTokens, spaceTokens, tokenSymbols]);

  return (
    <div className="w-full space-y-2.5">
      {rows.map((row, idx) => {
        const selectedMeta = resolveQuestRewardTokenMeta(
          row.token,
          spaceTokens,
        );
        return (
          <div
            key={idx}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1">
              <Input
                value={row.amount}
                type="text"
                inputMode="decimal"
                onChange={(e) => {
                  const next = [...rows];
                  next[idx] = { ...row, amount: e.target.value };
                  onChange(next);
                }}
                placeholder="0.00"
                rootClassName="min-h-10 w-full items-stretch"
                className="h-10 min-h-10 rounded-none bg-background-2 font-mono text-sm tabular-nums"
              />
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    role="combobox"
                    className="h-10 min-h-10 min-w-[150px] justify-between rounded-none border-border bg-background-2 px-3 py-0 text-sm font-medium text-foreground"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Image
                        src={selectedMeta.icon}
                        width={20}
                        height={20}
                        alt={selectedMeta.symbol}
                        className="size-5 shrink-0 rounded-full"
                      />
                      <span className="truncate font-semibold">
                        {selectedMeta.symbol}
                      </span>
                    </span>
                    <ChevronDown
                      className="size-3.5 shrink-0 text-neutral-11"
                      aria-hidden
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-[220] max-h-[220px] min-w-[200px] overflow-y-auto">
                  {options.map((opt) => (
                    <DropdownMenuItem
                      key={opt.symbol}
                      onSelect={() => {
                        const next = [...rows];
                        next[idx] = { ...row, token: opt.symbol };
                        onChange(next);
                      }}
                    >
                      <Image
                        src={opt.icon}
                        width={24}
                        height={24}
                        alt={opt.symbol}
                        className="mr-2.5 size-5 shrink-0 rounded-full"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="text-xs font-semibold text-foreground">
                          {opt.symbol}
                        </span>
                        <span className="truncate text-[11px] text-neutral-11">
                          {opt.name}
                          {opt.spaceTitle ? ` · ${opt.spaceTitle}` : ''}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="button"
                variant="ghost"
                colorVariant="neutral"
                onClick={() =>
                  onChange(rows.filter((_, itemIdx) => itemIdx !== idx))
                }
                className="h-10 px-2.5 text-neutral-11 hover:text-foreground"
                aria-label={`Remove ${row.token}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="ghost"
        colorVariant="neutral"
        data-testid={addTestId}
        onClick={() =>
          onChange([
            ...rows,
            {
              amount: '',
              token:
                options.find((opt) => !rows.some((r) => r.token === opt.symbol))
                  ?.symbol ?? 'USDC',
            },
          ])
        }
        className="h-9 gap-1.5 rounded-none border border-border bg-background px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground hover:bg-neutral-3"
      >
        <Plus className="size-3.5" aria-hidden />
        ADD TOKEN
      </Button>
    </div>
  );
}
