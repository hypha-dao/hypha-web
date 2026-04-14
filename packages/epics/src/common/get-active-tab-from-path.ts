// path: /[lang]/dho/[id]/{activeTab}/what/ever?path=afterActiveTab
export function getActiveTabFromPath(pathname: string) {
  // Match the pattern /[lang]/dho/[id]/{activeTab}/ to extract activeTab
  const match = pathname.match(/\/[^/]+\/dho\/[^/]+\/([^/]+)/);

  // Return the matched tab name or default to 'agreements'
  return match?.[1] || 'agreements';
}

/**
 * Radix Tabs `value` must match a rendered `TabsTrigger`. When Coherence is
 * disabled in the shell but the URL is still `/…/coherence` (e.g. stale link or
 * env mismatch), map away from `coherence` so the tab list does not 500.
 */
export function getEffectiveDhoTab(
  pathname: string,
  options: { coherenceEnabled: boolean },
): string {
  const raw = getActiveTabFromPath(pathname);
  if (raw === 'coherence' && !options.coherenceEnabled) {
    return 'agreements';
  }
  return raw;
}
