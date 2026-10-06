import { Suspense } from 'react';
import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { getEnableNetworkMapAsync } from '@hypha-platform/feature-flags';
import { NetworkPageHeading } from './_components/network-dashboard';
import { NetworkDashboardSkeleton } from './_components/network-dashboard-skeleton';
import { NetworkDashboardLoader } from './network-dashboard-loader';
import {
  ExploreSpacesLoader,
  NetworkExploreFallback,
} from './explore-spaces-loader';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
    category?: string;
    order?: string;
    view?: string;
  }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const query = searchParams?.query;
  const orderRaw = searchParams?.order;
  const { lang } = params;
  const enableNetworkMap = await getEnableNetworkMapAsync();

  return (
    <Container className="flex flex-col gap-9 py-9">
      <NetworkPageHeading />
      <Suspense fallback={<NetworkDashboardSkeleton />}>
        <NetworkDashboardLoader />
      </Suspense>
      <Suspense fallback={<NetworkExploreFallback />}>
        <ExploreSpacesLoader
          lang={lang}
          query={query}
          category={searchParams?.category}
          orderRaw={orderRaw}
          enableNetworkMap={enableNetworkMap}
        />
      </Suspense>
    </Container>
  );
}
