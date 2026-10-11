import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';
import { listNetworkSharedSignals } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkSectionNav, NetworkSignalList } from '@hypha-platform/epics';
import type { NetworkSignalKind } from '@hypha-platform/core/client';

export async function NetworkSignalPage({
  lang,
  type,
  titleKey,
  bodyKey,
  emptyKey,
}: {
  lang: Locale;
  type: NetworkSignalKind;
  titleKey: 'needsTitle' | 'actionTitle' | 'impactTitle';
  bodyKey: 'needsBody' | 'actionBody' | 'impactBody';
  emptyKey: 'needsEmpty' | 'actionEmpty' | 'impactEmpty';
}) {
  const t = await getTranslations('NetworkExchange');
  const signals = await listNetworkSharedSignals({ type }, { db }).catch(
    () => [],
  );
  return (
    <Container className="flex flex-col gap-6 py-8">
      <NetworkSectionNav lang={lang} />
      <header>
        <h1
          className="text-5"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t(titleKey)}
        </h1>
        <p className="mt-2 max-w-[52ch] text-2 leading-relaxed text-neutral-11">
          {t(bodyKey)}
        </p>
      </header>
      <NetworkSignalList lang={lang} signals={signals} empty={t(emptyKey)} />
    </Container>
  );
}
