import { Locale } from '@hypha-platform/i18n';
import { NetworkSignalPage } from '../_components/network-signal-page';

export default async function ProofOfImpactPage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  return (
    <NetworkSignalPage
      lang={lang}
      type="Impact"
      titleKey="impactTitle"
      bodyKey="impactBody"
      emptyKey="impactEmpty"
    />
  );
}
