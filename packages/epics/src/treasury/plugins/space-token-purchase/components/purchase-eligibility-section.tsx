'use client';

import { FormLabel } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type SpaceToken = {
  name: string;
};

type PurchaseEligibilitySectionProps = {
  selectedToken: SpaceToken | undefined;
};

export const PurchaseEligibilitySection = ({
  selectedToken,
}: PurchaseEligibilitySectionProps) => {
  const t = useTranslations('SpaceTokenPurchase');

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>{t('eligibility.sectionTitle')}</FormLabel>
      <span className="text-2 text-neutral-11">
        {t('eligibility.description')}
      </span>
      {selectedToken && (
        <div className="flex flex-col gap-2 p-3 rounded-md bg-neutral-2 border border-neutral-6">
          <span className="text-2 text-neutral-11">
            {t('eligibility.whitelistInfo', { tokenName: selectedToken.name })}
          </span>
        </div>
      )}
    </div>
  );
};
