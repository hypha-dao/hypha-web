// path: /[lang]/dho/[id]/{activeTab}/what/ever?path=afterActiveTab
export function getActiveTabFromPath(pathname: string) {
  // Match the pattern /[lang]/dho/[id]/{activeTab}/ to extract activeTab
  const match = pathname.match(/\/[^/]+\/dho\/[^/]+\/([^/]+)/);

  // Return the matched tab name or default to 'governance'
  return match?.[1] || 'governance';
}
