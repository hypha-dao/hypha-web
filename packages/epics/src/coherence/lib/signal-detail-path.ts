/** Signal detail route. Chat stays closed until the member opens it. */
export function signalDetailPath(
  lang: string,
  spaceSlug: string,
  signalSlug: string,
): string {
  return `/${lang}/dho/${spaceSlug}/coherence/signal/${encodeURIComponent(
    signalSlug,
  )}`;
}
