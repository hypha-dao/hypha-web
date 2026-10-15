import { Locale } from '@hypha-platform/i18n';
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
    <div className="flex w-full min-w-0 flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
      <NetworkFieldBoard
        lang={lang}
        variant="action"
        signals={signals}
        empty={t('fieldEmpty')}
      />
    </div>
  );
}
