import { Locale } from '@hypha-platform/i18n';
import { DocumentsSections } from '@hypha-platform/epics';
import { DirectionType } from '@hypha-platform/core/client';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { getDhoPathGovernance } from './constants';

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

  const web3SpaceId = spaceFromDb.web3SpaceId;

  return (
    <DocumentsSections
      lang={lang}
      spaceSlug={id}
      web3SpaceId={web3SpaceId as number}
      order={[
        {
          name: 'createdAt',
          dir: DirectionType.DESC,
        },
      ]}
      createProposalPath={`${getDhoPathGovernance(lang, id)}${PATH_SELECT_CREATE_ACTION}`}
    />
  );
}
