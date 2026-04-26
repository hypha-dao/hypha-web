// path: /[lang]/dho/[id]/{activeTab}/what/ever?path=afterActiveTab
const KNOWN_DHO_TABS = new Set([
  'agreements',
  'artifact',
  'members',
  'treasury',
  'rewards',
  'coherence',
  'wiki',
  'spaces',
  'ecosystem',
  'overview',
]);

// path: /[lang]/dho/[id]/{activeTab}/what/ever?path=afterActiveTab
export function getActiveTabFromPath(pathname: string): string | null {
  // Match the pattern /[lang]/dho/[id]/{activeTab}/ to extract activeTab
  const match = pathname.match(/\/[^/]+\/dho\/[^/]+\/([^/]+)/);
  const segment = match?.[1];
  if (!segment) return null;
  if (KNOWN_DHO_TABS.has(segment)) return segment;
  // Unknown segment: do not pretend the user is on Agreements
  return null;
}

/**
 * @deprecated Prefer {@link getActiveTabFromPath}; Coherence tab visibility is gated by
 * {@link getEnableCoherence}. Space Memory uses {@link getEnableSpaceMemory}.
 */
export function getEffectiveDhoTab(
  pathname: string,
  _options?: { coherenceEnabled: boolean },
): string {
  return getActiveTabFromPath(pathname) ?? 'agreements';
}
