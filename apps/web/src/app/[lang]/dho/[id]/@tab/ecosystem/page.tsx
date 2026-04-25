import { getDhoPathSpaces } from '../spaces/constants';
import { Locale } from '@hypha-platform/i18n';
import { permanentRedirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

/** Alias URL for the Ecosystem (space graph) view; canonical path remains `/spaces`. */
export default async function DhoEcosystemAliasPage(props: PageProps) {
  const { lang, id } = await props.params;
  permanentRedirect(getDhoPathSpaces(lang, id));
}
