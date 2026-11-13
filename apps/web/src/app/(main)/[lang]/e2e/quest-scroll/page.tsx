import { notFound } from 'next/navigation';

import { E2eQuestScrollHarness } from '@hypha-platform/epics';

/**
 * Playwright harness for a quest settings save that lands on a shorter
 * overview. Hidden in production unless the e2e server opts in.
 */
export default async function E2eQuestScrollPage(props: {
  searchParams: Promise<{ nested?: string }>;
}) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.HYPHA_E2E_HARNESS !== '1'
  ) {
    notFound();
  }

  const searchParams = await props.searchParams;
  return <E2eQuestScrollHarness nested={searchParams.nested === '1'} />;
}
