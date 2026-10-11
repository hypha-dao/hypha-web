import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';
import {
  listNetworkFieldSignals,
  NETWORK_FIELD_KINDS,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkFieldBoard } from '@hypha-platform/epics';

export default async function ProofOfActionPage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  const t = await getTranslations('NetworkExchange');
  const signals = await listNetworkFieldSignals(
    { kinds: NETWORK_FIELD_KINDS },
    { db },
  ).catch(() => []);
  return (
    <Container className="flex flex-col py-8">
      <NetworkFieldBoard
        lang={lang}
        variant="action"
        signals={signals}
        empty={t('fieldEmpty')}
      />
    </Container>
  );
}
