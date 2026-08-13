import 'server-only';

import type { IntelligenceManifest, IntelligenceManifestEntry } from '../types';
import { spaceManifestPath } from '../paths';
import {
  emptyIntelligenceManifest,
  parseIntelligenceManifest,
} from '../validation';
import {
  IntelligenceBlobNotConfiguredError,
  isIntelligenceBlobConfigured,
  putIntelligenceBlobText,
  readIntelligenceBlobText,
} from './blob-client';

export async function readSpaceIntelligenceManifest(
  spaceSlug: string,
): Promise<{
  configured: boolean;
  manifest: IntelligenceManifest;
}> {
  if (!isIntelligenceBlobConfigured()) {
    return {
      configured: false,
      manifest: emptyIntelligenceManifest(spaceSlug),
    };
  }

  const pathname = spaceManifestPath(spaceSlug);
  try {
    const text = await readIntelligenceBlobText(pathname);
    if (!text) {
      return {
        configured: true,
        manifest: emptyIntelligenceManifest(spaceSlug),
      };
    }
    const json = JSON.parse(text) as unknown;
    return {
      configured: true,
      manifest: parseIntelligenceManifest(json),
    };
  } catch (error) {
    if (error instanceof IntelligenceBlobNotConfiguredError) {
      return {
        configured: false,
        manifest: emptyIntelligenceManifest(spaceSlug),
      };
    }
    throw error;
  }
}

export async function writeSpaceIntelligenceManifest(input: {
  spaceSlug: string;
  manifest: IntelligenceManifest;
}): Promise<void> {
  const pathname = spaceManifestPath(input.spaceSlug);
  const body = `${JSON.stringify(input.manifest, null, 2)}\n`;
  await putIntelligenceBlobText({
    pathname,
    body,
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
  });
}

export function upsertManifestEntry(
  manifest: IntelligenceManifest,
  entry: IntelligenceManifestEntry,
): IntelligenceManifest {
  const artifacts = manifest.artifacts.filter((a) => a.id !== entry.id);
  artifacts.push(entry);
  artifacts.sort((a, b) => a.id.localeCompare(b.id));
  return {
    ...manifest,
    updated_at: new Date().toISOString().slice(0, 10),
    artifacts,
  };
}

export function archiveManifestEntry(
  manifest: IntelligenceManifest,
  artifactId: string,
): IntelligenceManifest {
  return {
    ...manifest,
    updated_at: new Date().toISOString().slice(0, 10),
    artifacts: manifest.artifacts.map((a) =>
      a.id === artifactId ? { ...a, status: 'archived' as const } : a,
    ),
  };
}
