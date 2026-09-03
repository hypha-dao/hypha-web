import { notFound } from 'next/navigation';

import { Locale } from '@hypha-platform/i18n';
import { getEnableAssistantAsync } from '@hypha-platform/feature-flags';

import { AssistantPageClient } from './_hypha/assistant-page-client';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

/**
 * #2486 talk-first entrypoint. Flag-gated: 404 when `enable-assistant` is off.
 * The interaction bar (owned by `AssistantShell`) replaces the app navbar —
 * `ConnectedMenuTop` renders nothing on this route.
 *
 * TODO(milestone 6): P-2 greeting refinements; auth is enforced client-side via
 * the profile button, matching the rest of the app.
 */
export default async function AssistantPage(props: PageProps) {
  const enabled = await getEnableAssistantAsync();
  if (!enabled) notFound();

  await props.params;

  return <AssistantPageClient />;
}
