import { ConnectedCreateSignalForm } from '@web/components/connected-create-signal-form';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../../../@tab/coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import {
  COHERENCE_SIGNAL_TYPES,
  COHERENCE_TAGS,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
  searchParams: Promise<{
    boardTag?: string | string[];
    type?: string;
    title?: string;
    description?: string;
    amount?: string | string[];
    token?: string | string[];
    video?: string;
    sharedWithNetwork?: string;
  }>;
};

export default async function NewSignalPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, id } = await params;
  const {
    boardTag,
    type,
    title,
    description,
    amount,
    token,
    video,
    sharedWithNetwork,
  } = await searchParams;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const boardTagsRaw = Array.isArray(boardTag)
    ? boardTag
    : boardTag
    ? [boardTag]
    : [];
  const canonicalTags = new Set(COHERENCE_TAGS as readonly string[]);
  const inheritedBoardTags = [...new Set(boardTagsRaw.map((tag) => tag.trim()))]
    .filter(Boolean)
    .filter((tag) => canonicalTags.has(tag));
  const signalType = (COHERENCE_SIGNAL_TYPES as readonly string[]).includes(
    type ?? '',
  )
    ? (type as (typeof COHERENCE_SIGNAL_TYPES)[number])
    : undefined;
  const signalTitle =
    typeof title === 'string' ? title.trim().slice(0, 50) : '';
  const signalDescription =
    typeof description === 'string' ? description.trim().slice(0, 4000) : '';
  const signalVideo =
    typeof video === 'string' && /^https?:\/\//i.test(video.trim())
      ? video.trim().slice(0, 2000)
      : '';
  const amountList = Array.isArray(amount) ? amount : amount ? [amount] : [];
  const tokenList = Array.isArray(token) ? token : token ? [token] : [];
  const indicativePayouts = Array.from(
    { length: Math.max(amountList.length, tokenList.length) },
    (_, index) => {
      const rawAmount = amountList[index]?.trim() ?? '';
      const rawToken = tokenList[index]?.trim() ?? '';
      return {
        amount:
          /^\d+(\.\d{1,2})?$/.test(rawAmount) && Number(rawAmount) > 0
            ? rawAmount
            : '',
        token: /^0x[a-fA-F0-9]{40}$/.test(rawToken) ? rawToken : '',
      };
    },
  ).filter((row) => row.amount || row.token);
  const shareOnNetwork =
    sharedWithNetwork === '1' || sharedWithNetwork === 'true';

  const successfulUrl = getDhoPathCoherence(lang, id);
  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard
        spaceSlug={id}
        spaceId={spaceFromDb.web3SpaceId ?? undefined}
      >
        <ConnectedCreateSignalForm
          successfulUrl={successfulUrl}
          closeUrl={successfulUrl}
          backUrl={successfulUrl}
          spaceId={spaceFromDb.id}
          initialValues={
            inheritedBoardTags.length > 0 ||
            signalType ||
            signalTitle ||
            signalDescription ||
            signalVideo ||
            indicativePayouts.length > 0 ||
            shareOnNetwork
              ? {
                  ...(inheritedBoardTags.length > 0
                    ? { tags: inheritedBoardTags }
                    : {}),
                  ...(signalType ? { type: signalType } : {}),
                  ...(signalTitle ? { title: signalTitle } : {}),
                  ...(signalDescription
                    ? { description: signalDescription }
                    : {}),
                  ...(signalVideo ? { videoUrl: signalVideo } : {}),
                  ...(indicativePayouts.length > 0
                    ? { indicativePayouts }
                    : {}),
                  ...(shareOnNetwork ? { sharedWithNetwork: true } : {}),
                }
              : undefined
          }
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
