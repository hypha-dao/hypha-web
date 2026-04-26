import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';
import { getEnableCoherence } from '@hypha-platform/feature-flags';
import { getDhoPathCoherence } from './coherence/constants';
import { getDhoPathSpaces } from './spaces/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

/**
 * Visiting `/dho/[id]` (no tab segment): open **Signals** when coherence is on
 * (default workspace focus), otherwise **Ecosystem** (spaces graph).
 */
export default async function DhoTabIndexPage(props: PageProps) {
  const { lang, id } = await props.params;
  const coherenceEnabled = await getEnableCoherence();
  if (coherenceEnabled) {
    redirect(getDhoPathCoherence(lang, id));
  }
  redirect(getDhoPathSpaces(lang, id));
}
