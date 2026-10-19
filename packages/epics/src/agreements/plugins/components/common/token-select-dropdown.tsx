'use client';

import { ChevronDownIcon } from '@radix-ui/themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button,
  Image,
} from '@hypha-platform/ui';
import type { TokenType } from '@hypha-platform/core/client';
import { getTokenTypeLabel } from '../../../../treasury/components/common/token-type-field';
import { useTranslations } from 'next-intl';

export type TokenSelectDropdownOption = {
  address: string;
  symbol: string;
  iconUrl: string;
  type?: TokenType | null;
  /** Shown as “by {spaceSubtitle}” under the symbol (e.g. space slug or title). */
  spaceSubtitle?: string;
};

type TokenSelectDropdownProps = {
  value: string;
  onValueChange: (address: string) => void;
  tokens: TokenSelectDropdownOption[];
  placeholder: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** Compact symbol control used inside the wallet amount block. */
  variant?: 'default' | 'inline';
};

export const TokenSelectDropdown = ({
  value,
  onValueChange,
  tokens,
  placeholder,
  emptyMessage,
  disabled,
  variant = 'default',
}: TokenSelectDropdownProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const selected = tokens.find(
    (t) => t.address.toLowerCase() === value.toLowerCase(),
  );

  if (variant === 'inline') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="ml-2 inline-flex items-center gap-1 align-middle text-2 tracking-[0.14em] uppercase disabled:opacity-50"
          >
            {selected?.symbol ?? placeholder}
            <ChevronDownIcon className="size-2" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[280px] w-64 overflow-y-auto">
          {tokens.length > 0 ? (
            tokens.map((token) => (
              <DropdownMenuItem
                key={token.address}
                onSelect={() => onValueChange(token.address)}
              >
                <Image
                  src={token.iconUrl}
                  width={24}
                  height={24}
                  alt={token.symbol}
                  className="mr-2 h-5 w-5 shrink-0 rounded-full"
                />
                <div className="flex min-w-0 flex-col text-left">
                  <span className="text-2 text-neutral-11">{token.symbol}</span>
                  {token.spaceSubtitle ? (
                    <span className="text-1 text-accent-11">
                      {tAgreementFlow('plugins.tokenPayoutField.bySpace', {
                        space: token.spaceSubtitle,
                      })}
                    </span>
                  ) : null}
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <span className="block px-2 py-1.5 text-2 text-neutral-11">
              {emptyMessage ?? placeholder}
            </span>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex w-full min-w-0 md:justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            role="combobox"
            disabled={disabled}
            className="w-full text-2 md:w-72 justify-between py-2 font-normal"
          >
            <div className="flex items-center gap-2 min-w-0">
              {selected ? (
                <>
                  <Image
                    src={selected.iconUrl}
                    width={20}
                    height={20}
                    alt={selected.symbol}
                    className="mr-2 rounded-full h-4 w-4 shrink-0"
                  />
                  <span className="text-2 text-neutral-11 truncate">
                    {selected.symbol}
                  </span>
                </>
              ) : (
                <span className="text-2 text-neutral-11 whitespace-nowrap truncate">
                  {placeholder}
                </span>
              )}
            </div>
            <ChevronDownIcon className="size-2 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[280px] overflow-y-auto md:w-72 md:min-w-[18rem]">
          {tokens.length > 0 ? (
            tokens.map((token) => (
              <DropdownMenuItem
                key={token.address}
                onSelect={() => onValueChange(token.address)}
              >
                <Image
                  src={token.iconUrl}
                  width={24}
                  height={24}
                  alt={token.symbol}
                  className="mr-2 rounded-full h-5 w-5 shrink-0"
                />
                <div className="flex flex-col min-w-0 text-left">
                  <span className="flex gap-2 items-center flex-wrap">
                    <span className="text-2 text-neutral-11">
                      {token.symbol}
                    </span>
                    {token.type ? (
                      <div className="rounded-lg text-[10px] text-accent-11 border-1 border-accent-11 px-2 py-0.75 shrink-0">
                        {getTokenTypeLabel(token.type, tAgreementFlow)}
                      </div>
                    ) : null}
                  </span>
                  {token.spaceSubtitle ? (
                    <span className="text-1 text-accent-11">
                      {tAgreementFlow('plugins.tokenPayoutField.bySpace', {
                        space: token.spaceSubtitle,
                      })}
                    </span>
                  ) : null}
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <span className="text-2 text-neutral-11 px-2 py-1.5 block">
              {emptyMessage ?? placeholder}
            </span>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
