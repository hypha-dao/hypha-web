import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { listNetworkFieldSignals } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkFieldBoard } from '@hypha-platform/epics';
import { NetworkSectionShell } from '../_components/network-section-shell';

export default async function ProofOfActionPage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  const t = await getTranslations('NetworkExchange');
  const signals = await listNetworkFieldSignals(
    { kinds: ['Action'] },
    { db },
  ).catch(() => []);
  return (
    <NetworkSectionShell>
      <NetworkFieldBoard
        lang={lang}
        variant="action"
        signals={signals}
        empty={t('fieldEmpty')}
      />
    </NetworkSectionShell>
  );
}
