import { unstable_cache } from 'next/cache';
import { db } from '@hypha-platform/storage-postgres';
import { findNetworkDashboardStats } from '@hypha-platform/core/server';
import { NetworkDashboard } from './_components/network-dashboard';

const getCachedNetworkDashboardStats = unstable_cache(
  async () => findNetworkDashboardStats({ db }),
  ['network-dashboard-stats-v2'],
  { revalidate: 300 },
);

export async function NetworkDashboardLoader() {
  try {
    const stats = await getCachedNetworkDashboardStats();
    return <NetworkDashboard stats={stats} />;
  } catch (error) {
    console.error('Failed to load network dashboard', error);
    return null;
  }
}
