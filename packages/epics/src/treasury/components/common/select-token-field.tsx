'use client';

import { useFormContext } from 'react-hook-form';
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
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { getTokenTypeLabel } from './token-type-field';

interface TokenItem {
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
  placeholder?: string;
  emptyListMessage?: string;
};

export function SelectTokenField({
  name,
  label,
  tokens,
  required = false,
  onValueChange,
  placeholder,
  emptyListMessage,
}: SelectTokenFieldProps) {
  const { control } = useFormContext();
  const tTreasury = useTranslations('TreasuryTab');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});

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

        const selectedToken = normalized
          ? tokens.find(
              (t) =>
                typeof t.address === 'string' &&
                t.address.toLowerCase() === normalized,
            )
          : undefined;

        const handleSelect = (token: TokenItem) => {
          const raw =
            typeof token.address === 'string' ? token.address.trim() : '';
          if (!raw.startsWith('0x')) {
            return;
          }
          const addr = raw.toLowerCase();
          flushSync(() => {
            field.onChange(addr);
          });
          onValueChange?.(addr);
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
                  <DropdownMenu modal={false}>
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
                        const key =
                          typeof token.address === 'string' &&
                          token.address.startsWith('0x')
                            ? token.address.toLowerCase()
                            : token.address;
                        const rawIcon = token.iconUrl?.trim();
                        const showFallback = brokenIcons[key] || !rawIcon;
                        const src = showFallback
                          ? '/placeholder/token-icon.svg'
                          : rawIcon;
                        return (
                          <DropdownMenuItem
                            key={key}
                            onSelect={() => handleSelect(token)}
                          >
                            <Image
                              src={src}
                              width={24}
                              height={24}
                              alt={token.symbol ?? ''}
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
                                  {token.symbol}
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
                              {token?.name ? (
                                <span className="text-1 text-accent-11 truncate">
                                  {token.name}
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
