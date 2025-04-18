import { DollarSignIcon } from 'lucide-react';
import { ChevronDownIcon } from '@radix-ui/themes';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Image,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export interface Token {
  icon: string;
  symbol: string;
  name: string;
}

export interface TokenPayout {
  amount: string;
  token: Token | null;
}

export interface TokenPayoutFieldProps {
  arrayFieldName: string;
  arrayFieldIndex: number;
  tokens: Token[];
}

export const TokenPayoutField = ({
  arrayFieldName,
  arrayFieldIndex,
  tokens,
}: TokenPayoutFieldProps) => {
  const { register, watch, setValue } = useFormContext();
  console.debug('TokenPayoutField', {
    [arrayFieldName]: watch(arrayFieldName),
  });

  // Define field names
  const amountFieldName = `${arrayFieldName}.${arrayFieldIndex}.amount`;
  const tokenFieldName = `${arrayFieldName}.${arrayFieldIndex}.token`;

  // Watch the token field value
  const selectedToken = watch(tokenFieldName);

  // Handle token selection
  const handleTokenChange = (token: Token) => {
    setValue(tokenFieldName, token, { shouldValidate: true });
  };

  return (
    <div className="flex justify-between w-full">
      <label className="text-2 text-neutral-11">Payment Request</label>
      <div className="flex gap-2 items-center">
        <Input
          {...register(amountFieldName)}
          type="number"
          leftIcon={<DollarSignIcon size="16px" />}
          placeholder="Type an amount"
        />
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="outline"
              colorVariant="neutral"
              className="flex justify-between items-center gap-2 min-w-[140px]"
            >
              <div className="flex items-center gap-2">
                {selectedToken ? (
                  <>
                    <Image
                      src={selectedToken.icon}
                      width={20}
                      height={20}
                      alt={`${selectedToken.name} icon`}
                    />
                    <span className="text-2 text-neutral-11">
                      {selectedToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-2 text-neutral-11">Select a token</span>
                )}
              </div>
              <ChevronDownIcon />
            </Button>
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
                  alt={`${token.name} icon`}
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
