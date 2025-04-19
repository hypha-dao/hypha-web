'use client';
import { AssetDetail, SidePanel } from '@hypha-platform/epics';
import { useAssetBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathTreasury } from '../../../../@tab/treasury/constants';

export default function Treasury() {
  const { slug, lang, id } = useParams();
  const { data, isLoading } = useAssetBySlug(slug as string);

  return (
    <SidePanel>
      <AssetDetail
        closeUrl={getDhoPathTreasury(lang as Locale, id as string)}
        assetHeadProps={{
          icon: data?.icon ?? '',
          name: data?.name ?? '',
          symbol: data?.symbol ?? '',
          value: data?.value ?? 0,
          usdEqual: data?.usdEqual ?? 0,
          isLoading: isLoading,
        }}
        chartData={data?.chartData ?? []}
        transactionsListProps={{
          activeFilter: 'all',
          setActiveFilter: () => {
            console.log('set active filter');
          },
          pagination: {
            total: 100,
            totalPages: 10,
            hasNextPage: true,
          },
          sortOptions: [
            { label: 'All', value: 'all' },
            { label: 'Most recent', value: 'most-recent' },
          ],
          transactions: data?.transactions,
          loadMore: () => {
            console.log('loaded more');
          },
        }}
        isLoading={isLoading}
      />
    </SidePanel>
  );
}
