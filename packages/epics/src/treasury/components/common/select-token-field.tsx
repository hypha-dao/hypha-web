'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { ChevronDownIcon } from '@radix-ui/themes';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Image,
  RequirementMark,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { getTokenTypeLabel } from './token-type-field';

interface TokenItem {
  /** DB id — used when `address` is not yet deployed */
  id?: number;
  name?: string;
  symbol?: string;
  address: string;
  iconUrl?: string;
  type?:
    | 'utility'
    | 'credits'
    | 'ownership'
    | 'voice'
    | 'impact'
    | 'community_currency';
}

type SelectTokenFieldProps = {
  name: string;
  label: string;
  tokens: TokenItem[];
  required?: boolean;
  onValueChange?: (value: string) => void;
  /** Called when the menu opens or closes — e.g. refetch tokens so the list is not stale SWR data. */
  onMenuOpenChange?: (open: boolean) => void;
  placeholder?: string;
  emptyListMessage?: string;
};

export function SelectTokenField({
  name,
  label,
  tokens,
  required = false,
  onValueChange,
  onMenuOpenChange,
  placeholder,
  emptyListMessage,
}: SelectTokenFieldProps) {
  const { control } = useFormContext();
  /** Subscribes this field to identity edits so the trigger/list re-render (FormField alone may not). */
  const liveName = useWatch({ control, name: 'name' });
  const liveSymbol = useWatch({ control, name: 'symbol' });
  const liveIconUrl = useWatch({ control, name: 'iconUrl' });
  const tTreasury = useTranslations('TreasuryTab');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});
  /** Same as token icon preview: `iconUrl` may be a File before save. */
  const [fileIconDataUrl, setFileIconDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!(liveIconUrl instanceof File)) {
      setFileIconDataUrl(null);
      return;
    }
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled) {
        setFileIconDataUrl(reader.result as string);
      }
    };
    reader.onerror = () => {
      if (!cancelled) {
        setFileIconDataUrl(null);
      }
    };
    reader.readAsDataURL(liveIconUrl);
    return () => {
      cancelled = true;
    };
  }, [liveIconUrl]);

  const resolvedLiveIconSrc = (() => {
    if (typeof liveIconUrl === 'string' && liveIconUrl.trim() !== '') {
      return liveIconUrl.trim();
    }
    if (fileIconDataUrl) {
      return fileIconDataUrl;
    }
    return undefined;
  })();

  const overlayTokenWithLiveEdits = (
    token: TokenItem,
    selectedNorm: string,
  ) => {
    const addr = typeof token.address === 'string' ? token.address.trim() : '';
    const isSelected =
      Boolean(selectedNorm) &&
      addr.startsWith('0x') &&
      addr.toLowerCase() === selectedNorm;
    if (!isSelected) {
      return token;
    }
    const n =
      typeof liveName === 'string' && liveName.trim() !== ''
        ? liveName.trim()
        : token.name;
    const s =
      typeof liveSymbol === 'string' && liveSymbol.trim() !== ''
        ? liveSymbol.trim()
        : token.symbol;
    const icon = resolvedLiveIconSrc ?? token.iconUrl;
    return { ...token, name: n, symbol: s, iconUrl: icon };
  };

  const isEmpty = tokens.length === 0;
  const placeholderText = placeholder ?? tTreasury('selectTokenPlaceholder');
  const emptyText = emptyListMessage ?? tTreasury('noTokensAvailable');

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const rawVal =
          typeof field.value === 'string' ? field.value.trim() : '';
        const normalized =
          rawVal && rawVal.startsWith('0x') ? rawVal.toLowerCase() : rawVal;

        const selectedRaw = normalized
          ? tokens.find(
              (t) =>
                typeof t.address === 'string' &&
                t.address.toLowerCase() === normalized,
            )
          : undefined;
        const selectedToken = selectedRaw
          ? overlayTokenWithLiveEdits(selectedRaw, normalized)
          : undefined;

        const isSelectable = (token: TokenItem) => {
          const raw =
            typeof token.address === 'string' ? token.address.trim() : '';
          return raw.startsWith('0x');
        };

        const handleSelect = (token: TokenItem) => {
          if (!isSelectable(token)) {
            return;
          }
          const raw = token.address.trim().toLowerCase();
          flushSync(() => {
            field.onChange(raw);
          });
          onValueChange?.(raw);
        };

        return (
          <FormItem>
            <div className="flex w-full justify-between items-start gap-2">
              <FormLabel className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max md:pt-1">
                {label} {required && <RequirementMark className="text-2" />}
              </FormLabel>
              <FormControl className="min-w-0 flex-1 max-w-[min(100%,20rem)]">
                {isEmpty ? (
                  <div className="text-2 text-neutral-11 italic">
                    {emptyText}
                  </div>
                ) : (
                  <DropdownMenu
                    modal={false}
                    onOpenChange={(open) => {
                      onMenuOpenChange?.(open);
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        colorVariant="neutral"
                        role="combobox"
                        className="w-full justify-between py-2 font-normal text-2 md:w-72"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {selectedToken ? (
                            <>
                              <Image
                                src={
                                  brokenIcons[normalized!]
                                    ? '/placeholder/token-icon.svg'
                                    : selectedToken.iconUrl?.trim() ??
                                      '/placeholder/token-icon.svg'
                                }
                                width={20}
                                height={20}
                                alt={selectedToken.symbol ?? ''}
                                className="mr-2 h-4 w-4 shrink-0 rounded-full"
                                unoptimized
                                onError={() =>
                                  setBrokenIcons((prev) => ({
                                    ...prev,
                                    [normalized!]: true,
                                  }))
                                }
                              />
                              <span className="text-2 text-neutral-11 truncate">
                                {selectedToken.symbol}
                              </span>
                            </>
                          ) : (
                            <span className="text-2 text-neutral-11 whitespace-nowrap">
                              {placeholderText}
                            </span>
                          )}
                        </div>
                        <ChevronDownIcon className="size-2 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="max-h-[200px] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                      align="start"
                    >
                      {tokens.map((token) => {
                        const displayToken = normalized
                          ? overlayTokenWithLiveEdits(token, normalized)
                          : token;
                        const selectable = isSelectable(token);
                        const key = selectable
                          ? token.address.trim().toLowerCase()
                          : `no-${token.id ?? token.symbol ?? 'token'}`;
                        const rawIcon = displayToken.iconUrl?.trim();
                        const showFallback = brokenIcons[key] || !rawIcon;
                        const src = showFallback
                          ? '/placeholder/token-icon.svg'
                          : rawIcon;
                        return (
                          <DropdownMenuItem
                            key={key}
                            disabled={!selectable}
                            className={
                              !selectable ? 'opacity-60 cursor-not-allowed' : ''
                            }
                            onSelect={() => handleSelect(token)}
                          >
                            <Image
                              src={src}
                              width={24}
                              height={24}
                              alt={displayToken.symbol ?? ''}
                              className="mr-2 h-5 w-5 shrink-0 rounded-full"
                              unoptimized
                              onError={() =>
                                setBrokenIcons((prev) => ({
                                  ...prev,
                                  [key]: true,
                                }))
                              }
                            />
                            <div className="flex min-w-0 flex-col">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-2 text-neutral-11">
                                  {displayToken.symbol}
                                </span>
                                {token?.type ? (
                                  <span className="rounded-lg border border-accent-11 px-2 py-0.75 text-[10px] text-accent-11">
                                    {getTokenTypeLabel(
                                      token.type,
                                      tAgreementFlow,
                                    )}
                                  </span>
                                ) : null}
                              </span>
                              {displayToken?.name ? (
                                <span className="text-1 text-accent-11 truncate">
                                  {displayToken.name}
                                </span>
                              ) : null}
                              {!selectable ? (
                                <span className="text-1 text-neutral-10">
                                  {tTreasury('tokenPendingContractAddress')}
                                </span>
                              ) : null}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
