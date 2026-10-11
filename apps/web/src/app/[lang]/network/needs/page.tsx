import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';
import { listNetworkOpenNeeds } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkNeedsBoard } from '@hypha-platform/epics';

export default async function NeedsPage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  await props.params;
  const t = await getTranslations('NetworkExchange');
  const needs = await listNetworkOpenNeeds({ db }).catch(() => []);
  return (
    <Container className="flex flex-col py-8">
      <NetworkNeedsBoard needs={needs} empty={t('needsEmpty')} />
    </Container>
  );
}
