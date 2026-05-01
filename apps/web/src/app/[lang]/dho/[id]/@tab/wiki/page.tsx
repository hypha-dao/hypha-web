import { DhoTabPage, SpaceMemorySection } from '@hypha-platform/epics';
import { getDhoPathAgreements } from '../agreements/constants';
import { getDhoPathCoherence } from '../coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';
import { getRedirectWhenWikiDisabled } from './resolve-wiki-redirect';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

/**
 * Memory tab (URL segment `wiki`) — space memory (org memory API).
 * Rich media and transcripts to be extended in a separate task.
 */
export default async function DhoWikiPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;

  const fallback = await getRedirectWhenWikiDisabled(lang, id);
  if (fallback) {
    redirect(fallback);
  }

  return (
    <DhoTabPage>
      <SpaceMemorySection spaceSlug={id} standalonePage />
    </DhoTabPage>
  );
}
