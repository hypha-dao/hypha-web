'use client';

import { ChevronDownIcon } from '@radix-ui/themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Image,
} from '@hypha-platform/ui';
import { Token } from './token-payout-field-array';

interface TokenSelectorProps {
  value: string;
  onChange: (tokenAddress: string) => void;
  tokens: Token[];
}

export const TokenSelector = ({
  value,
  onChange,
  tokens,
}: TokenSelectorProps) => {
  const selectedToken = tokens.find((t) => t.address === value);

  const handleTokenChange = (token: Token) => {
    onChange(token.address);
  };

  return (
    <div className="flex justify-between w-full">
      <label className="text-2 text-neutral-11 flex items-center">Token</label>
      <div>
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
                  <span className="text-2 text-neutral-11 whitespace-nowrap">
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
