'use client';

import { FormLabel } from '@hypha-platform/ui';
import { EnableTokenPriceField } from './enable-token-price-field';
import { ReferenceCurrencyField } from './reference-currency-field';
import { TokenPriceField } from './token-price-field';
import { useTranslations } from 'next-intl';

export const TokenValueSection = ({
  enableTokenPrice,
}: {
  enableTokenPrice: boolean;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.value.title')}
      </FormLabel>
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.issueNewToken.value.description')}
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
