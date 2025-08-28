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

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
}

interface TokenPayoutFieldProps {
  value: {
    amount: string;
    token: string;
  };
  onChange: (val: { amount: string; token: string }) => void;
  tokens: Token[];
}

export const TokenPayoutField = ({
  value,
  onChange,
  tokens,
}: TokenPayoutFieldProps) => {
  const selectedToken = tokens.find((t) => t.address === value.token);

  const handleTokenChange = (token: Token) => {
    onChange({ amount: value.amount, token: token.address });
  };

  const handleAmountChange = (amount: string) => {
    if (amount === '') {
      onChange({ amount: '', token: value.token });
      return;
    }
    const parsed = Number.parseInt(amount, 10);
    onChange({
      amount: String(Number.isNaN(parsed) ? 0 : parsed),
      token: value.token,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 md:justify-end items-end">
      <div className="flex top-0 m-0 p-0 flex-1 min-w-0">
        <Input
          value={value.amount}
          type="number"
          step="any"
          placeholder="Amount"
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
              className="w-full flex-1 text-2 justify-between py-2 font-normal"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {selectedToken ? (
                  <>
                    <Image
                      src={selectedToken.icon}
                      width={20}
                      height={20}
                      alt={selectedToken.symbol}
                      className="mr-2 object-cover rounded-full w-5 h-5"
                    />
                    <span className="text-2 truncate">
                      {selectedToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-2 text-nowrap">Select a token</span>
                )}
              </div>
              <ChevronDownIcon className="size-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {tokens.map((token) => (
              <DropdownMenuItem
                key={`${token.address}_${token.symbol}`}
                onSelect={() => handleTokenChange(token)}
              >
                <Image
                  src={token.icon}
                  width={24}
                  height={24}
                  alt={token.symbol}
                  className="mr-2 object-cover rounded-full w-5 h-5"
                />
                <span className="text-2 text-neutral-11">{token.symbol}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
