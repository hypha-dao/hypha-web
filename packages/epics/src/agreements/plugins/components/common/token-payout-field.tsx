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
    }
    const parsed = Number.parseInt(amount, 10);
    onChange({ amount: String(Number.isNaN(parsed) ? 0 : parsed), token: value.token });
  };

  return (
    <div className="flex flex-row md:justify-end gap-4 items-end">
      <Input
        value={value.amount}
        type="number"
        placeholder="Type an amount"
        onChange={(e) => handleAmountChange(e.target.value)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            colorVariant="neutral"
            role="combobox"
            className="w-full flex-1 text-2 md:w-72 justify-between py-2 font-normal"
          >
            <div className="flex items-center gap-2 w-24">
              {selectedToken ? (
                <>
                  <Image
                    src={selectedToken.icon}
                    width={20}
                    height={20}
                    alt={selectedToken.symbol}
                    className="mr-2 object-cover rounded-full w-5 h-5"
                  />
                  <span className="text-2">{selectedToken.symbol}</span>
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
  );
};
