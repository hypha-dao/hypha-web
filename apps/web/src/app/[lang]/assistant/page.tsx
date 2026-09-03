import { notFound } from 'next/navigation';

import { Locale } from '@hypha-platform/i18n';
import { getEnableAssistantAsync } from '@hypha-platform/feature-flags';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

/**
 * #2486 milestone 1 — static skeleton.
 *
 * Flag-gated: 404 when `enable-assistant` is off. The interaction bar renders
 * in the navbar slot (see `ConnectedMenuTop`); this page owns the body below it
 * — the next-actions strip and the contextual canvas. Both are placeholders
 * until the text path is wired (milestone 4+).
 *
 * TODO(milestone 4): client-side auth gate via `useMe()` in the shell, matching
 * the rest of the app (auth is enforced client-side, not on page components).
 */
export default async function AssistantPage(props: PageProps) {
  const enabled = await getEnableAssistantAsync();
  if (!enabled) notFound();

  await props.params;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      {/* Next-actions strip — populated by the model / fallback list (milestone 6). */}
      <div
        className="flex min-h-9 items-center gap-2 overflow-x-auto"
        aria-label="Suggested next actions"
      />

      {/* Contextual canvas — registry-driven widgets react to the conversation
          (milestones 2 + 4). Empty until then. */}
      <div className="min-h-[60vh] rounded-lg border border-dashed border-border/60" />
    </div>
  );
}
