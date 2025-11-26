import { FormLabel } from '@hypha-platform/ui';
import { EnableTokenPriceField } from './enable-token-price-field';
import { ReferenceCurrencyField } from './reference-currency-field';
import { TokenPriceField } from './token-price-field';

export const TokenValueSection = ({
  enableTokenPrice,
}: {
  enableTokenPrice: boolean;
}) => {
  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Token Value on Treasury</FormLabel>
      <span className="text-2 text-neutral-11">
        Set an initial value for your token. The reference price is displayed in
        your treasury and helps members understand the token’s starting market
        value.
      </span>
      <EnableTokenPriceField />
      {enableTokenPrice && (
        <>
          <ReferenceCurrencyField />
          <TokenPriceField />
        </>
      )}
    </div>
  );
};
