'use client';

import { NetworkSectionHeader } from '@hypha-platform/epics';
import { Heading } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

/** Two-line centered title for the network directory only. Other network
 * sections use {@link NetworkSectionHeader}. */
export function NetworkPageTitle() {
  const t = useTranslations('Network');

  return (
    <>
      <div className="xl:hidden">
        <NetworkSectionHeader
          eyebrow={t('manySpaces')}
          title={t('oneVibrantNetwork')}
        />
      </div>
      <Heading
        size="9"
        color="secondary"
        weight="medium"
        align="center"
        className="hidden flex-col xl:flex"
      >
        <span>{t('manySpaces')}</span>
        <span>{t('oneVibrantNetwork')}</span>
      </Heading>
    </>
  );
}
