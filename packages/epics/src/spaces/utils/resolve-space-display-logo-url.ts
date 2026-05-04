import { isSafeImageUrl } from './safe-image-url';

type SpaceLogoCandidate = {
  logoUrl?: string | null;
  ecosystemLogoUrlLight?: string | null;
  ecosystemLogoUrlDark?: string | null;
};

export function resolveSpaceDisplayLogoUrl(
  space?: SpaceLogoCandidate | null,
): string | null {
  if (!space) return null;

  const candidates = [
    space.logoUrl,
    space.ecosystemLogoUrlLight,
    space.ecosystemLogoUrlDark,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isSafeImageUrl(trimmed)) {
      return trimmed;
    }
  }

  return null;
}
