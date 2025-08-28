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
import { useEffect, useState } from 'react';

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
  const [displayAmount, setDisplayAmount] = useState(
    String(value.amount ?? ''),
  );

  useEffect(() => {
    setDisplayAmount(String(value.amount ?? ''));
  }, [value.amount]);

  const selectedToken = tokens.find((t) => t.address === value.token);

  const handleTokenChange = (token: Token) => {
    onChange({ amount: value.amount, token: token.address });
  };

  const handleAmountChange = (next: string) => {
    // allow only digits with a single optional decimal point;
    // support intermediate states
    if (!/^\d*(?:[\.\,]\d*)?$/.test(next)) return;
    setDisplayAmount(next);
    // don't propagate while incomplete (empty or trailing '.')
    if (next === '' || next.endsWith('.') || next.endsWith(',')) return;
    const parsed = Number.parseFloat(next);
    onChange({
      amount: Number.isFinite(parsed) ? parsed : 0,
      token: value.token,
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:justify-between w-full">
      <label className="text-2 text-neutral-11 flex items-center">
        Required Min. Token Number (Optional)
      </label>
      <div className="flex gap-2 items-center">
        <Input
          value={displayAmount}
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="Type an amount"
          onChange={(e) => handleAmountChange(e.target.value)}
          onBlur={() => {
            const next = displayAmount;
            if (next === '') {
              onChange({ amount: 0, token: value.token });
              return;
            }
            if (next.endsWith('.') || next.endsWith(',')) {
              const parsed = Number.parseFloat(next);
              onChange({
                amount: Number.isFinite(parsed) ? parsed : 0,
                token: value.token,
              });
              setDisplayAmount(Number.isFinite(parsed) ? String(parsed) : '');
            }
          }}
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
