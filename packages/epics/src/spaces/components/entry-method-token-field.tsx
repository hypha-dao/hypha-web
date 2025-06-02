'use client';

import { ChevronDownIcon } from '@radix-ui/themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Image,
} from '@hypha-platform/ui';
import { Address } from '@core/governance/types';

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
    onChange({ amount: parseInt(amount), token: value.token });
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
            <div className="flex justify-between items-center gap-2 min-w-[140px] px-4 py-2 border border-neutral-7 rounded-md hover:bg-neutral-3 cursor-pointer">
              <div className="flex items-center gap-2">
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
            </div>
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
