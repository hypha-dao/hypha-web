import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import {
  listNetworkFieldSignals,
  NETWORK_FIELD_KINDS,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkReciprocalExchange } from '@hypha-platform/epics';
import { NetworkSectionShell } from '../_components/network-section-shell';

export default async function ReciprocalExchangePage(props: {
  params: Promise<{ lang: Locale }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { lang } = await props.params;
  const { type } = await props.searchParams;
  const t = await getTranslations('NetworkExchange');
  const signals = await listNetworkFieldSignals(
    { kinds: NETWORK_FIELD_KINDS },
    { db },
  ).catch(() => []);
  return (
    <NetworkSectionShell>
      <NetworkReciprocalExchange
        lang={lang}
        signals={signals}
        empty={t('fieldEmpty')}
        initialType={type}
      />
    </NetworkSectionShell>
  );
}
