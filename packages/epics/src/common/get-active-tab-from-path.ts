// path: /[lang]/dho/[id]/{activeTab}/what/ever?path=afterActiveTab
const KNOWN_DHO_TABS = new Set([
  'agreements',
  'members',
  'treasury',
  'coherence',
  'spaces',
  'overview',
]);

// path: /[lang]/dho/[id]/{activeTab}/what/ever?path=afterActiveTab
export function getActiveTabFromPath(pathname: string) {
  // Match the pattern /[lang]/dho/[id]/{activeTab}/ to extract activeTab
  const match = pathname.match(/\/[^/]+\/dho\/[^/]+\/([^/]+)/);
  const segment = match?.[1];
  if (segment && KNOWN_DHO_TABS.has(segment)) {
    return segment;
  }
  // Unknown first segment (e.g. future routes) or missing tab → default primary tab
  return 'agreements';
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
