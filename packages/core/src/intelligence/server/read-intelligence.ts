import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import type { IntelligenceArtifact } from '../types';
import { gateIntelligenceSpaceAccess } from './space-access';
import {
  assertSafeArtifactId,
  assertSafeSpaceSlug,
  isAllowedIntelligenceMarkdownPath,
} from '../paths';
import { toIntelligenceArtifact } from '../parse-markdown';
import { readSpaceIntelligenceManifest } from './manifest';
import {
  IntelligenceBlobNotConfiguredError,
  isIntelligenceBlobConfigured,
  readIntelligenceBlobText,
} from './blob-client';

export type ReadIntelligenceBySpaceSlugInput = {
  spaceSlug: string;
  artifactId: string;
  authToken?: string;
  skipMembershipCheck?: boolean;
};

export type ReadIntelligenceBySpaceSlugResult =
  | {
      access: 'ok';
      configured: boolean;
      space_slug: string;
      artifact: IntelligenceArtifact | null;
    }
  | {
      access: 'denied';
      message: string;
      space_slug: string;
    };

export async function readIntelligenceBySpaceSlug(
  input: ReadIntelligenceBySpaceSlugInput,
  { db }: { db: DatabaseInstance },
): Promise<ReadIntelligenceBySpaceSlugResult> {
  const spaceSlug = assertSafeSpaceSlug(input.spaceSlug);
  const artifactId = assertSafeArtifactId(input.artifactId);

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      access: 'denied',
      message: `Space "${spaceSlug}" was not found.`,
      space_slug: spaceSlug,
    };
  }

  const membership = await gateIntelligenceSpaceAccess(space, input, spaceSlug);
  if (membership.access === 'denied') {
    return membership;
  }

  if (!isIntelligenceBlobConfigured()) {
    return {
      access: 'ok',
      configured: false,
      space_slug: spaceSlug,
      artifact: null,
    };
  }

  const { manifest } = await readSpaceIntelligenceManifest(spaceSlug);
  const entry = manifest.artifacts.find((a) => a.id === artifactId);
  if (!entry || entry.status === 'archived') {
    return {
      access: 'ok',
      configured: true,
      space_slug: spaceSlug,
      artifact: null,
    };
  }

  if (!isAllowedIntelligenceMarkdownPath(spaceSlug, entry.path)) {
    return {
      access: 'denied',
      message: 'Artifact path is outside the permitted intelligence prefix.',
      space_slug: spaceSlug,
    };
  }

  try {
    const text = await readIntelligenceBlobText(entry.path);
    if (!text) {
      return {
        access: 'ok',
        configured: true,
        space_slug: spaceSlug,
        artifact: null,
      };
    }
    const artifact = toIntelligenceArtifact({ raw: text, path: entry.path });
    return {
      access: 'ok',
      configured: true,
      space_slug: spaceSlug,
      artifact,
    };
  } catch (error) {
    if (error instanceof IntelligenceBlobNotConfiguredError) {
      return {
        access: 'ok',
        configured: false,
        space_slug: spaceSlug,
        artifact: null,
      };
    }
    throw error;
  }
}
