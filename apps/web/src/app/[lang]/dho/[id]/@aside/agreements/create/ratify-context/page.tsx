import {
  CreateContextRatifyForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { getDhoPathContext } from '../../../../@tab/context/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function RatifyContextFromAgreementsPage({
  params,
}: PageProps) {
  const { lang, id } = await params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  return (
    <ProposalOverlayShell>
      <CreateContextRatifyForm
        successfulUrl={getDhoPathContext(lang, id)}
        backUrl={getDhoPathAgreements(lang, id)}
        closeUrl={getDhoPathContext(lang, id)}
        spaceId={spaceFromDb.id}
        web3SpaceId={spaceFromDb.web3SpaceId}
        spaceSlug={id}
      />
    </ProposalOverlayShell>
  );
}
