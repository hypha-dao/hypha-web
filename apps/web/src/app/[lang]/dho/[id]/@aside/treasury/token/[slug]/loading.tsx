'use client';
import { AssetDetail, SidePanel } from '@hypha-platform/epics';

export default function Loading() {
  return (
    <SidePanel>
      <AssetDetail
        isLoading
        assetHeadProps={{
          icon: '',
          name: '',
          symbol: '',
          value: 0,
          usdEqual: 0,
          isLoading: true,
        }}
        chartData={[]}
        transactionsListProps={{
          activeFilter: '',
          setActiveFilter: () => {
            console.log('set active filter');
          },
          pagination: {
            total: 0,
            totalPages: 0,
            hasNextPage: true,
          },
          sortOptions: [],
          transactions: [],
          loadMore: () => {
            console.log('loaded more');
          },
        }}
      />
    </SidePanel>
  );
}
