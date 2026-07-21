import { Locale } from '@hypha-platform/i18n';
import { HighlightsPage, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import type { Metadata } from 'next';
import { findHighlightProfileBySpaceId } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const space = await getSpaceBySlug({ slug: id });
  if (!space) {
    return { title: 'Highlights' };
  }
  const profile = await findHighlightProfileBySpaceId(space.id, { db });
  const title = `${space.title} · Highlights`;
  const description =
    profile?.summary?.trim() ||
    `Highlights and funding profile for ${space.title}`;
  const image = profile?.coverImageUrl || space.leadImage || space.logoUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function HighlightsTabPage(props: PageProps) {
  const { id } = await props.params;
  const space = await getSpaceBySlug({ slug: id });

  return (
    <SpaceTabAccessWrapper
      spaceId={space?.web3SpaceId ?? undefined}
      spaceSlug={id}
    >
      <HighlightsPage spaceSlug={id} />
    </SpaceTabAccessWrapper>
  );
}
