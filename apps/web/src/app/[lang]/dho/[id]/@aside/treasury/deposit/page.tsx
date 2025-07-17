import { DepositFunds, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { getDhoPathTreasury } from '../../../@tab/treasury/constants';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams: Promise<{ back: string }>;
};

export default async function Treasury({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  const { back: backHref } = await searchParams;

  // TODO: implement authorization
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const spaceId = spaceFromDb.web3SpaceId;

  const closeUrl = getDhoPathTreasury(lang as Locale, id);

  return (
    <SidePanel>
      <DepositFunds
        closeUrl={closeUrl}
        backUrl={
          backHref ? backHref : `${closeUrl}${PATH_SELECT_CREATE_ACTION}`
        }
        spaceId={spaceId}
      />
    </SidePanel>
  );
}
