import { Locale } from '@hypha-platform/i18n';
import { AssetsSection, TransactionsSection } from '@hypha-platform/epics';
import { getDhoPathTreasury } from './constants';
import { getDhoPathAgreements } from '../agreements/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function TreasuryPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = getDhoPathTreasury(lang as Locale, id as string);
  const governancePath = getDhoPathAgreements(lang as Locale, id as string);
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  return (
    <div className="flex flex-col gap-6 py-4">
      <AssetsSection
        basePath={basePath}
        governancePath={governancePath}
        web3SpaceId={spaceFromDb?.web3SpaceId as number}
      />
      {/* TODO: Temporarily hidden for #1331 */}
      {/* <TransactionsSection spaceSlug={id} /> */}
    </div>
  );
}
