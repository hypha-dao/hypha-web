'use client';

import { ChevronDownIcon } from '@radix-ui/themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Image,
  Button,
} from '@hypha-platform/ui';
import { TokenType } from '@hypha-platform/core/client';
import { getTokenTypeLabel } from '../../../../treasury/components/common/token-type-field';
import { useTranslations } from 'next-intl';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  value?: number;
  tokenPrice?: number;
  tokenCurrencyLabel?: string;
  space?: {
    title: string;
    slug: string;
  };
  type?: TokenType | null;
}

interface TokenPayoutFieldProps {
  value: {
    amount: string;
    token: string;
    spaceSlug?: string;
  };
  onChange: (val: {
    amount: string;
    token: string;
    spaceSlug?: string;
  }) => void;
  tokens: Token[];
  readOnlyDropdown?: boolean;
  showSelectedTokenBalanceHint?: boolean;
  selectedTokenPriceHint?: string;
}

export const TokenPayoutField = ({
  value,
  onChange,
  tokens,
  readOnlyDropdown,
  showSelectedTokenBalanceHint = false,
  selectedTokenPriceHint,
}: TokenPayoutFieldProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const selectedToken = tokens.find(
    (t) => t.address.toLowerCase() === value.token.toLowerCase(),
  );

  const handleTokenChange = (token: Token) => {
    onChange({
      amount: value.amount,
      token: token.address,
      spaceSlug: token.space?.slug,
    });
  };

  const handleAmountChange = (amount: string) => {
    if (amount === '') {
      onChange({
        amount: '',
        token: value.token,
        spaceSlug: value.spaceSlug,
      });
      return;
    }

    const normalizedAmount = amount.replace(',', '.');

    if (/^\d*\.?\d*$/.test(normalizedAmount)) {
      onChange({
        amount: normalizedAmount,
        token: value.token,
        spaceSlug: value.spaceSlug,
      });
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 md:justify-end items-end w-full">
        <div className="flex top-0 m-0 p-0 flex-1 min-w-0">
          <Input
            value={value.amount ?? ''}
            type="text"
            inputMode="decimal"
            placeholder={tAgreementFlow('plugins.tokenPayoutField.amount')}
            onChange={(e) => handleAmountChange(e.target.value)}
          />
        </div>
        <div className="flex top-0 w-full sm:w-60 shrink-0 min-w-0 m-0 p-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                colorVariant="neutral"
                role="combobox"
                className="w-full text-2 md:w-72 justify-between py-2 font-normal"
              >
                <div className="flex items-center gap-2">
                  {selectedToken ? (
                    <>
                      <Image
                        src={selectedToken.icon}
                        width={20}
                        height={20}
                        alt={selectedToken.symbol}
                        className="mr-2 rounded-full h-4 w-4"
                      />
                      <span className="text-2 text-neutral-11">
                        {selectedToken.symbol}
                      </span>
                    </>
                  ) : (
                    <span className="text-2 text-neutral-11 whitespace-nowrap">
                      {tAgreementFlow('plugins.tokenPayoutField.selectToken')}
                    </span>
                  )}
                </div>
                <ChevronDownIcon className="size-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full max-h-[200px] overflow-y-scroll">
              {tokens.length > 0 ? (
                tokens.map((token) => (
                  <DropdownMenuItem
                    key={token.address}
                    onSelect={() => handleTokenChange(token)}
                  >
                    <Image
                      src={token.icon}
                      width={24}
                      height={24}
                      alt={token.symbol}
                      className="mr-2 rounded-full h-5 w-5"
                    />
                    <div className="flex flex-col">
                      <span className="flex gap-2 items-center">
                        <span className="text-2 text-neutral-11">
                          {token.symbol}
                        </span>
                        {token?.type && (
                          <div className="rounded-lg text-[10px] text-accent-11 border-1 border-accent-11 px-2 py-0.75">
                            {getTokenTypeLabel(token.type, tAgreementFlow)}
                          </div>
                        )}
                      </span>
                      {token?.space?.title ? (
                        <span className="text-1 text-accent-11">
                          {tAgreementFlow('plugins.tokenPayoutField.bySpace', {
                            space: token.space.title,
                          })}
                        </span>
                      ) : null}
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <span className="text-2 text-neutral-11">
                  {tAgreementFlow('plugins.tokenPayoutField.noTokensFound')}
                </span>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {showSelectedTokenBalanceHint &&
      selectedToken &&
      typeof selectedToken.value === 'number' &&
      Number.isFinite(selectedToken.value) ? (
        <div className="text-1 text-neutral-11 w-full min-w-0 self-end overflow-x-auto">
          <span className="whitespace-nowrap inline-block min-w-full text-right">
            Wallet balance: {selectedToken.value.toFixed(2)}{' '}
            {selectedToken.symbol}
            {selectedTokenPriceHint
              ? ` · Token redemption price: ${selectedTokenPriceHint}`
              : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
};
