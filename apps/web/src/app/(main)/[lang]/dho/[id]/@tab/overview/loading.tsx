import { cookies } from 'next/headers';
import {
  ORIENTATION_COOKIE,
  readOrientationCookie,
} from '@hypha-platform/epics';
import { TabLoadingSkeleton } from '../_components/tab-loading-skeleton';

export default async function Loading() {
  const remembered = readOrientationCookie(
    (await cookies()).get(ORIENTATION_COOKIE)?.value,
  );
  return (
    <TabLoadingSkeleton
      layout={remembered === 'member' ? 'member-home' : 'overview'}
      showTitle={false}
    />
  );
}
