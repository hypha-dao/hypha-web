/**
 * Cleans the pathname by:
 * 1. Truncating the path after number of segments
 *
 * @example
 * cleanPath('/de/dho/my-dho/agreements/something/else') => '/de/dho/my-dho/agreements'
 */
export const cleanPath = (
  pathname: string,
  keepSegments = 4,
): string => {
  return pathname
    .split('/')
    .slice(0, keepSegments + 1)
    .join('/');
};
