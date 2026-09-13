import { notFound } from 'next/navigation';

import { Locale } from '@hypha-platform/i18n';
import { getEnableCoherentIntelligentSystemAsync } from '@hypha-platform/feature-flags';

import { CoherentPageClient } from './_hypha/coherent-page-client';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

/**
 * #2486 talk-first Coherent entrypoint. Flag-gated: 404 when
 * `enable-coherent-intelligent-system` is off. The interaction bar (owned by
 * `AssistantShell`) replaces the app navbar — `ConnectedMenuTop` renders
 * nothing on this route.
 *
 * Auth is enforced client-side via the profile button, matching the rest of
 * the app.
 */
export default async function CoherentPage(props: PageProps) {
  const enabled = await getEnableCoherentIntelligentSystemAsync();
  if (!enabled) notFound();

  await props.params;

  return <CoherentPageClient />;
}
