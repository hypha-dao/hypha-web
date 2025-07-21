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
import { Address } from '@hypha-platform/core/client';

interface Token {
  icon: string;
  symbol: string;
  address: Address;
}

interface EntryMethodTokenFieldProps {
  value: {
    amount: number;
    token: Address;
  };
  onChange: (val: { amount: number; token: Address }) => void;
  tokens: Token[];
}

export const EntryMethodTokenField = ({
  value,
  onChange,
  tokens,
}: EntryMethodTokenFieldProps) => {
  const selectedToken = tokens.find((t) => t.address === value.token);

  const handleTokenChange = (token: Token) => {
    onChange({ amount: value.amount, token: token.address });
  };

  const handleAmountChange = (amount: string) => {
    const parsed = Number.parseInt(amount, 10);
    onChange({ amount: Number.isNaN(parsed) ? 0 : parsed, token: value.token });
  };

  return (
    <div className="flex justify-between w-full">
      <label className="text-2 text-neutral-11 flex items-center">
        Required Min. Token Number (Optional)
      </label>
      <div className="flex gap-2 items-center">
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
              className="w-full text-2 md:w-72 justify-between py-2 font-normal"
            >
              <div className="flex items-center gap-2 flex-1">
                {selectedToken ? (
                  <>
                    <Image
                      src={selectedToken.icon}
                      width={20}
                      height={20}
                      alt={selectedToken.symbol}
                    />
                    <span className="text-2 text-neutral-11">
                      {selectedToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-2 text-neutral-11 text-nowrap">
                    Select a token
                  </span>
                )}
              </div>
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {tokens.map((token) => (
              <DropdownMenuItem
                key={token.address}
                onSelect={() => handleTokenChange(token)}
              >
                <Image
                  src={token.icon}
                  width={24}
                  height={24}
                  alt={token.symbol}
                  className="mr-2"
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
