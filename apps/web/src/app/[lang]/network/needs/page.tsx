import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { listNetworkOpenNeeds } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkNeedsBoard } from '@hypha-platform/epics';
import { NetworkSectionShell } from '../_components/network-section-shell';

export default async function NeedsPage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  const t = await getTranslations('NetworkExchange');
  const needs = await listNetworkOpenNeeds({ db }).catch(() => []);
  return (
    <NetworkSectionShell>
      <NetworkNeedsBoard lang={lang} needs={needs} empty={t('needsEmpty')} />
    </NetworkSectionShell>
  );
}
