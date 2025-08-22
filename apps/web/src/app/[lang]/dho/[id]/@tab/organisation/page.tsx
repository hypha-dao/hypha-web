import { Locale } from '@hypha-platform/i18n';
import { SubspaceSection } from '@hypha-platform/epics';
import { Space } from '@hypha-platform/core/client';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import { notFound } from 'next/navigation';
import { useMembers } from '@web/hooks/use-members';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function OrganisationPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const spaceFromDb = await getSpaceBySlug({ slug: id });

  if (!spaceFromDb) {
    return notFound();
  }

  const spaces: Space[] = [spaceFromDb, ...(spaceFromDb.subspaces || [])];
  for (const space of spaces) {
    if (space.parentId) {
      space.parent = spaces.find((s) => s.id === space.parentId);
    }
  }

  return (
    <SubspaceSection
      spaces={spaces}
      lang={lang}
      currentSpaceId={spaceFromDb.id}
      useMembers={useMembers}
    />
  );
}
