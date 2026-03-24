'use client';

import { Skeleton } from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type TokenSupplySectionProps = {
  maxSupply: number;
  supply: number;
  isLoadingSupply: boolean;
};

export function TokenSupplySection({
  maxSupply,
  supply,
  isLoadingSupply,
}: TokenSupplySectionProps) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center w-full">
        <span className="text-2 text-neutral-11 w-full">
          {tAgreementFlow('plugins.tokenBackingVault.tokenSupplyLabel')}
        </span>
        {maxSupply === 0 ? (
          <span className="text-2 text-neutral-11 text-nowrap">
            {tAgreementFlow('plugins.tokenBackingVault.unlimitedSupply')}
          </span>
        ) : (
          <span className="text-2 text-neutral-11">
            {formatCurrencyValue(maxSupply)}
          </span>
        )}
      </div>
      <div className="flex justify-between items-center w-full">
        <span className="text-2 text-neutral-11 w-full">
          {tAgreementFlow('plugins.tokenBackingVault.issuanceToDate')}
        </span>
        <Skeleton width={120} height={32} loading={isLoadingSupply}>
          <span className="text-2 text-neutral-11">
            {formatCurrencyValue(supply)}
          </span>
        </Skeleton>
      </div>
    </div>
  );
}
