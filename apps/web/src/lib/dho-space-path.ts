/** Locale-prefixed DHO space path: `/{locale}/dho/{slug}` */
export const DHO_SPACE_PATH_RE = /^\/[^/]+\/dho\/[^/]+/;

export function isDhoSpaceRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return DHO_SPACE_PATH_RE.test(pathname);
}
