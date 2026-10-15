import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { listNetworkFieldSignals } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkImpactBoard } from '@hypha-platform/epics';

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
    <div className="flex w-full min-w-0 flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
      <NetworkImpactBoard
        lang={lang}
        signals={signals}
        empty={t('storiesEmpty')}
      />
    </div>
  );
}
