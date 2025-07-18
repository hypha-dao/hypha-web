export function isAbsoluteUrl(url: string): boolean {
  const absoluteUrlRegex = /^[a-z][a-z0-9+.-]*:\/\//i;
  return absoluteUrlRegex.test(url);
}
