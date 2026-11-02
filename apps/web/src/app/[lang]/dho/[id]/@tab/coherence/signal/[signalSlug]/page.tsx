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

type PageProps = {
  params: Promise<{ lang: Locale; id: string; signalSlug: string }>;
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
