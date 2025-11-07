import { Locale } from '@hypha-platform/i18n';
import { AssetsSection, TransactionsSection } from '@hypha-platform/epics';
import { getDhoPathTreasury } from './constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function TreasuryPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = getDhoPathTreasury(lang, id);
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  return (
    <div className="flex flex-col gap-6 py-4">
      <AssetsSection
        basePath={basePath}
        web3SpaceId={spaceFromDb?.web3SpaceId as number}
      />
      <TransactionsSection spaceSlug={id} />
    </div>
  );
}
