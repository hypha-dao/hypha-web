import {
  INTELLIGENCE_ROOT,
  INTELLIGENCE_TYPE_FOLDERS,
  type IntelligenceCoreType,
} from './types';

/** Linear slug check: lowercase alnum segments joined by single hyphens. */
function isSafeSlug(value: string): boolean {
  if (value.length === 0 || value.length > 200) return false;
  let i = 0;
  let sawSegment = false;
  while (i < value.length) {
    const start = i;
    while (
      i < value.length &&
      ((value[i]! >= 'a' && value[i]! <= 'z') ||
        (value[i]! >= '0' && value[i]! <= '9'))
    ) {
      i += 1;
    }
    if (i === start) return false;
    sawSegment = true;
    if (i === value.length) break;
    if (value[i] !== '-') return false;
    i += 1;
    if (i === value.length) return false; // trailing hyphen
  }
  return sawSegment;
}

export function assertSafeSpaceSlug(spaceSlug: string): string {
  const slug = spaceSlug.trim();
  if (!isSafeSlug(slug)) {
    throw new Error(`Invalid space slug for intelligence path: "${spaceSlug}"`);
  }
  return slug;
}

export function assertSafeArtifactId(id: string): string {
  const value = id.trim();
  if (!isSafeSlug(value) || value.startsWith('_')) {
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
  // Pack-specific types: linear sanitize (no quantified regex on user input).
  const trimmed = type.trim().toLowerCase();
  const chars: string[] = [];
  let lastWasHyphen = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]!;
    const ok =
      (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '-';
    if (ok) {
      if (ch === '-') {
        if (chars.length === 0 || lastWasHyphen) continue;
        lastWasHyphen = true;
        chars.push(ch);
      } else {
        lastWasHyphen = false;
        chars.push(ch);
      }
    } else {
      if (chars.length === 0 || lastWasHyphen) continue;
      lastWasHyphen = true;
      chars.push('-');
    }
  }
  while (chars.length > 0 && chars[chars.length - 1] === '-') {
    chars.pop();
  }
  const safe = chars.join('');
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

/** Signal slug-id for `_patches/{signalSlug}.json` (same rules as artifact ids). */
export function assertSafeSignalSlug(signalSlug: string): string {
  return assertSafeArtifactId(signalSlug);
}

export function artifactPatchPath(input: {
  spaceSlug: string;
  signalSlug: string;
}): string {
  const slug = assertSafeSpaceSlug(input.spaceSlug);
  const signalSlug = assertSafeSignalSlug(input.signalSlug);
  return `${INTELLIGENCE_ROOT}/spaces/${slug}/_patches/${signalSlug}.json`;
}

export function assertSafePackId(packId: string): string {
  return assertSafeSpaceSlug(packId);
}

export function frameworkPackPrefix(packId: string): string {
  const id = assertSafePackId(packId);
  return `${INTELLIGENCE_ROOT}/frameworks/${id}/`;
}

export function frameworkPackManifestPath(packId: string): string {
  return `${frameworkPackPrefix(packId)}_pack.json`;
}

export function frameworkPackOntologyPath(packId: string): string {
  return `${frameworkPackPrefix(packId)}ontology.md`;
}

export function frameworkPackTemplatePath(input: {
  packId: string;
  artifactId: string;
}): string {
  const packId = assertSafePackId(input.packId);
  const artifactId = assertSafeArtifactId(input.artifactId);
  return `${INTELLIGENCE_ROOT}/frameworks/${packId}/templates/${artifactId}.md`;
}

function looksLikePathTraversal(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return (
    pathname.includes('..') ||
    lower.includes('%2e') ||
    lower.includes('%2f') ||
    lower.includes('%5c')
  );
}

/** Normalize caller path: trim, forward slashes, strip a single leading slash. */
export function canonicalizeIntelligencePath(pathname: string): string {
  let value = pathname.trim().replace(/\\/g, '/');
  while (value.startsWith('/')) {
    value = value.slice(1);
  }
  return value;
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
  if (looksLikePathTraversal(pathname)) return false;
  return true;
}

/**
 * Intelligence writes derive the object key from space + type + id.
 * If the caller supplies a path, it must match that key and stay a `.md` under
 * the space prefix.
 */
export function matchCallerIntelligencePath(input: {
  spaceSlug: string;
  type: string;
  id: string;
  callerPath?: string;
}): { ok: true; path: string } | { ok: false; message: string } {
  const expected = artifactCurrentPath({
    spaceSlug: input.spaceSlug,
    type: input.type,
    id: input.id,
  });
  const raw = input.callerPath?.trim();
  if (!raw) {
    return { ok: true, path: expected };
  }
  if (looksLikePathTraversal(raw)) {
    return { ok: false, message: 'Path traversal is not allowed.' };
  }
  const caller = canonicalizeIntelligencePath(raw);
  if (!caller.endsWith('.md')) {
    return {
      ok: false,
      message: 'Intelligence writes must target a .md path.',
    };
  }
  if (
    !isAllowedIntelligenceMarkdownPath(input.spaceSlug, caller) ||
    caller !== expected
  ) {
    return {
      ok: false,
      message: `Path must be "${expected}" (space prefix + type folder + id.md).`,
    };
  }
  return { ok: true, path: expected };
}
