import { Locale } from '@hypha-platform/i18n';
import { DocumentsSections, SubspaceSection } from '@hypha-platform/epics';
import { DirectionType } from '@hypha-platform/core/client';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { getDhoPathGovernance } from '../governance/constants';
import { useMembers } from '@web/hooks/use-members';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function AgreementsPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) {
    return notFound();
  }

  const subspaces = spaceFromDb.subspaces;

  return (
    <SubspaceSection
      spaces={subspaces || []}
      lang={lang}
      getSpaceDetailLink={(lang, id) =>
        `${getDhoPathGovernance(lang, id)}${PATH_SELECT_CREATE_ACTION}`
      }
      useMembers={useMembers}
    />
  );
}
