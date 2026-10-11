import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';
import { listNetworkFieldSignals } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkFieldBoard } from '@hypha-platform/epics';

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
    <Container className="flex flex-col py-8">
      <NetworkFieldBoard
        lang={lang}
        variant="impact"
        signals={signals}
        empty={t('storiesEmpty')}
      />
    </Container>
  );
}
