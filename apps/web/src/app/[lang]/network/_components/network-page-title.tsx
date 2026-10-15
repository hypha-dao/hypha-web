'use client';

import { Heading } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

/** Two-line centered title for the network directory only. Other network
 * sections use {@link NetworkSectionHeader}. */
export function NetworkPageTitle() {
  const t = useTranslations('Network');

  return (
    <Heading
      size="9"
      color="secondary"
      weight="medium"
      align="center"
      className="flex flex-col"
    >
      <span>{t('manySpaces')}</span>
      <span>{t('oneVibrantNetwork')}</span>
    </Heading>
  );
}
