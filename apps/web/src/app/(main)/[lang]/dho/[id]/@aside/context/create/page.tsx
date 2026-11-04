import {
  CreateContextRatifyForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { getDhoPathContext } from '../../../@tab/context/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateContextRatifyPage({ params }: PageProps) {
  const { lang, id } = await params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const successfulUrl = getDhoPathContext(lang, id);

  return (
    <ProposalOverlayShell>
      <CreateContextRatifyForm
        successfulUrl={successfulUrl}
        backUrl={successfulUrl}
        closeUrl={successfulUrl}
        spaceId={spaceFromDb.id}
        web3SpaceId={spaceFromDb.web3SpaceId}
        spaceSlug={id}
      />
    </ProposalOverlayShell>
  );
}
