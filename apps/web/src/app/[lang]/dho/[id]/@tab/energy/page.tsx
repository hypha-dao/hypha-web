import { Locale } from '@hypha-platform/i18n';
import {
  SpaceTabAccessWrapper,
  SpaceEnergySection,
} from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function EnergyPage(props: PageProps) {
  const params = await props.params;
  const { id } = params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb.web3SpaceId as number}
      spaceSlug={id}
    >
      <div className="flex flex-col gap-6 py-4">
        <SpaceEnergySection />
      </div>
    </SpaceTabAccessWrapper>
  );
}
