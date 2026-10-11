import { Locale } from '@hypha-platform/i18n';
import { NetworkSignalPage } from '../_components/network-signal-page';

export default async function ProofOfActionPage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  return (
    <NetworkSignalPage
      lang={lang}
      type="Action"
      titleKey="actionTitle"
      bodyKey="actionBody"
      emptyKey="actionEmpty"
    />
  );
}
