import { FormLabel, Switch } from '@hypha-platform/ui';
import { TokenMaxSupplyField } from './token-max-supply-field';
import { TokenMaxSupplyTypeField } from './token-max-supply-type-field';

export const TokenSupplySection = ({
  enableLimitedSupply,
  setEnableLimitedSupply,
}: {
  enableLimitedSupply: boolean;
  setEnableLimitedSupply: (value: boolean) => void;
}) => {
  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Token Supply</FormLabel>
      <span className="text-2 text-neutral-11">
        Choose a fixed or unlimited token supply. Select “Limited Supply” to set
        a maximum token amount, either permanently or with an option to update
        in the future.
      </span>
      <div className="flex w-full justify-between items-center text-2 text-neutral-11">
        <span>Enable Limited Supply</span>
        <Switch
          checked={enableLimitedSupply}
          onCheckedChange={setEnableLimitedSupply}
          className="ml-2"
        />
      </div>
      {enableLimitedSupply && (
        <>
          <TokenMaxSupplyField />
          <TokenMaxSupplyTypeField />
        </>
      )}
    </div>
  );
};
