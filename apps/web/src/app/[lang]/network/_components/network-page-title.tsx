'use client';

import { NetworkSectionHeader } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

/** Same eyebrow and title as the other network sections. Shown while the directory loads. */
export function NetworkPageTitle() {
  const t = useTranslations('Network');

  return (
    <NetworkSectionHeader
      eyebrow={t('manySpaces').replace(/,\s*$/, '')}
      title={t('oneVibrantNetwork')}
    />
  );
}
