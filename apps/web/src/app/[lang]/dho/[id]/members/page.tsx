import { Locale } from '@hypha-platform/i18n';
import { MembersGraph } from '@hypha-platform/ui/server';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function MembersPage(props: PageProps) {
  const params = await props.params;

  const { lang } = params;

  return <MembersGraph />;
}
