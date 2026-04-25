import { getDhoPathWiki } from '../wiki/constants';
import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

/** @deprecated Use `/wiki`. Space memory lives under Wiki. */
export default async function DhoArtifactRedirectPage(props: PageProps) {
  const { lang, id } = await props.params;
  redirect(getDhoPathWiki(lang, id));
}
