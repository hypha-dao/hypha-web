import { getDhoPathSpaces } from '../../../@tab/spaces/constants';
import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

/**
 * Legacy aside URL for space navigation. Primary discovery is the in-flow
 * `/spaces` tab; keep this as a hard redirect for bookmarks and old links.
 */
export default async function SelectNavigationActionRedirect({
  params,
}: {
  params: Promise<{ id: string; lang: Locale; tab: string }>;
}) {
  const { id, lang } = await params;
  redirect(getDhoPathSpaces(lang, id));
}
