// path: /[lang]/dho/[id]/{activeTab}/what/ever?path=afterActiveTab
export function getActiveTabFromPath(pathname: string) {
  // Match the pattern /[lang]/dho/[id]/{activeTab}/ to extract activeTab
  const match = pathname.match(/\/[^/]+\/dho\/[^/]+\/([^/]+)/);

  // Return the matched tab name or default to 'agreements'
  return match?.[1] || 'agreements';
}

/**
 * @deprecated The Coherence tab is always shown; Space Memory alone is gated by
 * {@link getEnableSpaceMemory}. Prefer {@link getActiveTabFromPath} for tab state.
 */
export function getEffectiveDhoTab(
  pathname: string,
  _options?: { coherenceEnabled: boolean },
): string {
  return getActiveTabFromPath(pathname);
}
