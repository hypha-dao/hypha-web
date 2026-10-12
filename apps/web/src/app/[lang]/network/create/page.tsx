import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { NetworkQuickCreate } from '@hypha-platform/epics';

export default async function NetworkCreatePage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  return (
    <Container className="flex flex-col gap-6 py-8">
      <NetworkQuickCreate lang={lang} />
    </Container>
  );
}
