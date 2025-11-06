import { CreateAgreementForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../../../@tab/agreements/constants';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
};

export default async function CreateAgreementPage({ params }: PageProps) {
  const { lang, id, tab } = await params;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const spaceId = spaceFromDb.id;
  const web3SpaceId = spaceFromDb.web3SpaceId;
  const closeUrl = `/${lang}/dho/${id}/${tab}`;
  const backUrl = `${closeUrl}${PATH_SELECT_CREATE_ACTION}`;
  const successfulUrl = getDhoPathAgreements(lang, id);

  return (
    <SidePanel>
      <CreateAgreementForm
        successfulUrl={successfulUrl}
        backUrl={backUrl}
        closeUrl={closeUrl}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        label="Collective Agreement"
      />
    </SidePanel>
  );
}
