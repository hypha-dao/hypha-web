'use client';

import { Heading } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

/** Stays outside the network data fetch so the loading skeleton cannot paint a second copy. */
export function NetworkPageTitle() {
  const t = useTranslations('Network');

  return (
    <Heading
      size="9"
      color="secondary"
      weight="medium"
      align="center"
      className="flex w-full flex-col items-center"
    >
      <span>{t('manySpaces')}</span>
      <span>{t('oneVibrantNetwork')}</span>
    </Heading>
  );
}
