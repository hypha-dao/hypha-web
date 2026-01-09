import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import {
  getAllOrganizationSpacesForNodeById,
  getSpaceBySlug,
} from '@hypha-platform/core/server';
import { notFound } from 'next/navigation';
import { SubspaceSectionWrapper } from '../../_components/subspace-section-wrapper';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';

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

  const spaces: Space[] = await getAllOrganizationSpacesForNodeById({
    id: spaceFromDb.id,
  });

  for (const space of spaces) {
    if (space.parentId) {
      space.parent = spaces.find((s) => s.id === space.parentId);
    }
  }

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb.web3SpaceId as number}
      spaceSlug={id}
    >
      <SubspaceSectionWrapper
        lang={lang}
        spaces={spaces}
        currentSpaceId={spaceFromDb.id}
      />
    </SpaceTabAccessWrapper>
  );
}
