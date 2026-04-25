import { SpaceMemorySection } from '@hypha-platform/epics';
import { getDhoPathAgreements } from '../agreements/constants';
import { getDhoPathCoherence } from '../coherence/constants';
import {
  getEnableSpaceMemory,
  getEnableCoherence,
} from '@hypha-platform/feature-flags';
import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

/**
 * Wiki — space memory (org memory API). Rich media and transcripts
 * to be extended in a separate task; data source unchanged for now.
 */
export default async function DhoWikiPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;

  const spaceMemoryEnabled = await getEnableSpaceMemory();
  if (!spaceMemoryEnabled) {
    const coherenceEnabled = await getEnableCoherence();
    redirect(
      coherenceEnabled
        ? getDhoPathCoherence(lang, id)
        : getDhoPathAgreements(lang, id),
    );
  }

  return (
    <div className="w-full min-w-0">
      <div className="rounded-2xl border border-border/60 bg-card/35 py-4 shadow-sm backdrop-blur-[2px] supports-[backdrop-filter]:bg-card/25 dark:bg-card/40 dark:supports-[backdrop-filter]:bg-card/30">
        <div className="px-4 pb-4 pt-0 md:px-8">
          <SpaceMemorySection spaceSlug={id} standalonePage />
        </div>
      </div>
    </div>
  );
}
