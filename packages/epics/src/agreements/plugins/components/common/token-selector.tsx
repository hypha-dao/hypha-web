'use client';

import { ChevronDownIcon } from '@radix-ui/themes';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Image,
  RequirementMark,
} from '@hypha-platform/ui';
import { Token } from './token-payout-field-array';

interface TokenSelectorProps {
  value: string;
  onChange: (tokenAddress: string) => void;
  tokens: Token[];
  showRequirementMark?: boolean;
}

export const TokenSelector = ({
  value,
  onChange,
  tokens,
  showRequirementMark = false,
}: TokenSelectorProps) => {
  const selectedToken = tokens.find((t) => t.address === value);

  const handleTokenChange = (token: Token) => {
    onChange(token.address);
  };

  return (
    <div className="flex justify-between w-full">
      <span className="flex items-center gap-2">
        <label className="text-2 text-neutral-11 flex items-center">
          Token
        </label>
        {showRequirementMark && <RequirementMark className="text-2" />}
      </span>
      <div>
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
                    Select a token
                  </span>
                )}
              </div>
              <ChevronDownIcon className="size-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full max-h-[200px] overflow-y-scroll">
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
                  className="mr-2 rounded-full h-5 w-5"
                />
                <div className="flex flex-col">
                  <span className="flex gap-2 items-center">
                    <span className="text-2 text-neutral-11">
                      {token.symbol}
                    </span>
                    {token?.type && (
                      <div className="rounded-lg capitalize text-[10px] text-accent-11 border-1 border-accent-11 px-2 py-0.75">
                        {token.type}
                      </div>
                    )}
                  </span>
                  {token.space?.title ? (
                    <span className="text-1 text-accent-11">
                      by {token.space?.title}
                    </span>
                  ) : null}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
