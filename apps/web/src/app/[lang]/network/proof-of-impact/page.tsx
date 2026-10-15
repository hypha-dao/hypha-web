import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { listNetworkFieldSignals } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkImpactBoard } from '@hypha-platform/epics';
import { NetworkSectionShell } from '../_components/network-section-shell';

export default async function ProofOfImpactPage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  const t = await getTranslations('NetworkExchange');
  const signals = await listNetworkFieldSignals(
    { kinds: ['Insight', 'Impact'] },
    { db },
  ).catch(() => []);
  return (
    <NetworkSectionShell>
      <NetworkImpactBoard
        lang={lang}
        signals={signals}
        empty={t('storiesEmpty')}
      />
    </NetworkSectionShell>
  );
}
