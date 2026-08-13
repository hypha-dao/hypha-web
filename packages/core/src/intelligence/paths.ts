import {
  INTELLIGENCE_ROOT,
  INTELLIGENCE_TYPE_FOLDERS,
  type IntelligenceCoreType,
} from './types';

const SLUG_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SPACE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertSafeSpaceSlug(spaceSlug: string): string {
  const slug = spaceSlug.trim();
  if (!SPACE_SLUG_RE.test(slug)) {
    throw new Error(`Invalid space slug for intelligence path: "${spaceSlug}"`);
  }
  return slug;
}

export function assertSafeArtifactId(id: string): string {
  const value = id.trim();
  if (!SLUG_ID_RE.test(value) || value.startsWith('_')) {
    throw new Error(`Invalid intelligence artifact id: "${id}"`);
  }
  return value;
}

export function spaceIntelligencePrefix(spaceSlug: string): string {
  const slug = assertSafeSpaceSlug(spaceSlug);
  return `${INTELLIGENCE_ROOT}/spaces/${slug}/`;
}

export function spaceManifestPath(spaceSlug: string): string {
  return `${spaceIntelligencePrefix(spaceSlug)}_manifest.json`;
}

export function typeFolderFor(type: string): string {
  if (type in INTELLIGENCE_TYPE_FOLDERS) {
    return INTELLIGENCE_TYPE_FOLDERS[type as IntelligenceCoreType];
  }
  // Pack-specific types land under assessments-style catch-all folder by type slug.
  const safe = type
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || 'assessments';
}

export function artifactCurrentPath(input: {
  spaceSlug: string;
  type: string;
  id: string;
}): string {
  const slug = assertSafeSpaceSlug(input.spaceSlug);
  const id = assertSafeArtifactId(input.id);
  const folder = typeFolderFor(input.type);
  return `${INTELLIGENCE_ROOT}/spaces/${slug}/${folder}/${id}.md`;
}

export function artifactVersionPath(input: {
  spaceSlug: string;
  id: string;
  sha: string;
}): string {
  const slug = assertSafeSpaceSlug(input.spaceSlug);
  const id = assertSafeArtifactId(input.id);
  const sha = input.sha.trim().toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(sha)) {
    throw new Error(`Invalid content sha for version path: "${input.sha}"`);
  }
  return `${INTELLIGENCE_ROOT}/spaces/${slug}/_versions/${id}/${sha}.md`;
}

/** True when pathname is under the space intelligence prefix and is a .md file (not manifest). */
export function isAllowedIntelligenceMarkdownPath(
  spaceSlug: string,
  pathname: string,
): boolean {
  const prefix = spaceIntelligencePrefix(spaceSlug);
  if (!pathname.startsWith(prefix)) return false;
  if (pathname === spaceManifestPath(spaceSlug)) return false;
  if (!pathname.endsWith('.md')) return false;
  // Disallow path traversal segments
  if (pathname.includes('..')) return false;
  return true;
}
