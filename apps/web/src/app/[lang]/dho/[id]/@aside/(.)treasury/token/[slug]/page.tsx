'use client';
import { AssetDetail } from '@hypha-platform/epics';
import { SidePanel } from '../../../_components/side-panel';
import { useAssetBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Paths } from 'apps/web/src/app/constants';
import { Locale } from '@hypha-platform/i18n';

export default function Treasury() {
  const { slug, lang, id } = useParams();
  const { data, isLoading } = useAssetBySlug(slug as string);

  return (
    <SidePanel>
      <AssetDetail
        closeUrl={Paths.dho.treasury(lang as Locale, id as string)}
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
