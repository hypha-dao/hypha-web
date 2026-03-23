'use client';

import { FormLabel, Switch } from '@hypha-platform/ui';
import { TokenMaxSupplyField } from './token-max-supply-field';
import { TokenMaxSupplyTypeField } from './token-max-supply-type-field';
import { useTranslations } from 'next-intl';

export const TokenSupplySection = ({
  enableLimitedSupply,
  setEnableLimitedSupply,
}: {
  enableLimitedSupply: boolean;
  setEnableLimitedSupply: (value: boolean) => void;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.supply.title')}
      </FormLabel>
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.issueNewToken.supply.description')}
      </span>
      <div className="flex w-full justify-between items-center text-2 text-neutral-11">
        <span>
          {tAgreementFlow('plugins.issueNewToken.supply.enableLimited')}
        </span>
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
