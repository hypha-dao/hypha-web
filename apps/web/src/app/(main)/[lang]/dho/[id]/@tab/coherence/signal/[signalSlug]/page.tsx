import { SignalPage, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import {
  getEnableCoherence,
  getEnableHumanChat,
} from '@hypha-platform/feature-flags';
import { Locale } from '@hypha-platform/i18n';
import {
  findSpaceBySlug,
  getCoherenceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound, redirect } from 'next/navigation';
import { getDhoPathOverview } from '../../../overview/constants';
import { OpenMemberDiscussion } from './open-member-discussion';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; signalSlug: string }>;
  searchParams: Promise<{ discussion?: string | string[] }>;
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function SignalDetailPage(props: PageProps) {
  const { lang, id, signalSlug: rawSlug } = await props.params;
  const searchParams = await props.searchParams;
  const discussion = searchParams.discussion;
  const openDiscussion =
    (Array.isArray(discussion) ? discussion[0] : discussion) === 'open';
  const signalSlug = safeDecode(rawSlug).trim();

  if (!(await getEnableCoherence())) {
    redirect(
      `${getDhoPathOverview(lang, id)}?signal=${encodeURIComponent(
        signalSlug,
      )}`,
    );
  }

  const [space, signal, humanChatEnabled] = await Promise.all([
    findSpaceBySlug({ slug: id }, { db }),
    getCoherenceBySlug({ slug: signalSlug }),
    getEnableHumanChat(),
  ]);
  if (!space || !signal || signal.spaceId !== space.id) {
    notFound();
  }

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        {openDiscussion && humanChatEnabled ? (
          <OpenMemberDiscussion
            enabled
            spaceSlug={id}
            slug={signal.slug ?? signalSlug}
            title={signal.title}
            description={signal.description}
            roomId={signal.roomId ?? null}
          />
        ) : null}
        <SignalPage
          lang={lang}
          spaceSlug={id}
          signalSlug={signalSlug}
          humanChatEnabled={humanChatEnabled}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
