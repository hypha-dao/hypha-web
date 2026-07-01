// path: /[lang]/dho/[id]/{activeTab}/what/ever?path=afterActiveTab
export function getActiveTabFromPath(pathname: string) {
  // Match the pattern /[lang]/dho/[id]/{activeTab}/ to extract activeTab
  const match = pathname.match(/\/[^/]+\/dho\/[^/]+\/([^/]+)/);

  // Return the matched tab name or default to overview (bare `/dho/[slug]` URLs).
  return match?.[1] || 'overview';
}

/**
 * @deprecated Prefer {@link getActiveTabFromPath}; Coherence tab visibility is gated by
 * {@link getEnableCoherence}. Space Memory uses {@link getEnableSpaceMemory}.
 */
export function getEffectiveDhoTab(
  pathname: string,
  _options?: { coherenceEnabled: boolean },
): string {
  return getActiveTabFromPath(pathname);
}
