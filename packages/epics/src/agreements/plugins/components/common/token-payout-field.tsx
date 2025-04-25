'use client';

import { DollarSignIcon } from 'lucide-react';
import { ChevronDownIcon } from '@radix-ui/themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Image,
} from '@hypha-platform/ui';

interface Token {
  icon: string;
  symbol: string;
  name: string;
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
  const selectedToken = tokens.find((t) => t.symbol === value.token);

  const handleTokenChange = (token: Token) => {
    onChange({ amount: value.amount, token: token.symbol });
  };

  const handleAmountChange = (amount: string) => {
    onChange({ amount, token: value.token });
  };

  return (
    <div className="flex justify-between w-full">
      <label className="text-2 text-neutral-11 flex items-center">
        Payment Request
      </label>
      <div className="flex gap-2 items-center">
        {selectedToken && (
          <Input
            value={value.amount}
            type="number"
            leftIcon={<DollarSignIcon size="16px" />}
            placeholder="Type an amount"
            onChange={(e) => handleAmountChange(e.target.value)}
          />
        )}
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
                      alt={selectedToken.name}
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
                key={token.symbol}
                onSelect={() => handleTokenChange(token)}
              >
                <Image
                  src={token.icon}
                  width={24}
                  height={24}
                  alt={token.name}
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
