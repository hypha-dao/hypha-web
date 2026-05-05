import { isSafeImageUrl } from './safe-image-url';

type SpaceLogoCandidate = {
  logoUrl?: string | null;
  ecosystemLogoUrlLight?: string | null;
  ecosystemLogoUrlDark?: string | null;
};

export type SpaceLogoVariant = 'light' | 'dark';

export function resolveSpaceDisplayLogoUrl(
  space?: SpaceLogoCandidate | null,
  preferredVariant: SpaceLogoVariant = 'light',
): string | null {
  if (!space) return null;

  const preferredEcosystemLogo =
    preferredVariant === 'dark'
      ? space.ecosystemLogoUrlDark
      : space.ecosystemLogoUrlLight;
  const fallbackEcosystemLogo =
    preferredVariant === 'dark'
      ? space.ecosystemLogoUrlLight
      : space.ecosystemLogoUrlDark;

  const candidates = [
    space.logoUrl,
    preferredEcosystemLogo,
    fallbackEcosystemLogo,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isSafeImageUrl(trimmed)) {
      return trimmed;
    }
  }

  return null;
}
