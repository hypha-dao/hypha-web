import { notFound } from 'next/navigation';
import { SignalPage, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { getEnableCoherence } from '@hypha-platform/feature-flags';
import { getCoherenceBySlug } from '@hypha-platform/core/server';
import type { Locale } from '@hypha-platform/i18n';

import {
  decodeSignalSlug,
  signalBelongsToSpace,
} from '@web/lib/white-label/signal';
import { getWhiteLabelSpace } from '../../../../../../_lib/space';

type PageProps = {
  params: Promise<{ id: string; lang: string; signalSlug: string }>;
};

/**
 * One signal, read-only. Same checks as the main app's page (the signal must
 * be one of this Space's), except that a Space with Coherence off gets the
 * white-label 404 instead of a redirect to the full app's Overview. No chat,
 * no upvote, no creator actions (decisions of 3.3); the data comes from the
 * Space's `coherences` route, which checks access.
 */
export default async function WhiteLabelSignalPage(props: PageProps) {
  const { id: slug, lang, signalSlug: rawSlug } = await props.params;
  if (!(await getEnableCoherence())) notFound();

  const signalSlug = decodeSignalSlug(rawSlug);
  const [space, signal] = await Promise.all([
    getWhiteLabelSpace(slug),
    getCoherenceBySlug({ slug: signalSlug }),
  ]);
  if (!signalBelongsToSpace(signal, space)) notFound();

  return (
    <SpaceTabAccessWrapper spaceSlug={slug}>
      <div className="flex flex-col gap-4 py-4">
        <SignalPage
          readOnly
          lang={lang as Locale}
          spaceSlug={slug}
          signalSlug={signalSlug}
          humanChatEnabled={false}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
