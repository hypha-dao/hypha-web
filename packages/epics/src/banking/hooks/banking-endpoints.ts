/**
 * Banking API base path resolver. The banking hooks/components are owner-agnostic:
 * pass an explicit `basePath` (e.g. a person-scoped route) or a `spaceSlug` to use
 * the default space-scoped path. Space call sites keep passing `spaceSlug`.
 */
export type BankingBasePathOptions = {
  spaceSlug?: string;
  basePath?: string;
};

export function resolveBankingBasePath({
  spaceSlug,
  basePath,
}: BankingBasePathOptions): string | null {
  if (basePath) {
    return basePath.replace(/\/$/, '');
  }
  if (spaceSlug) {
    return `/api/v1/spaces/${spaceSlug}/banking`;
  }
  return null;
}
