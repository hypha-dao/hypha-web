import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { findSpaceBySlug } from '../../space/server/queries';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import type { IntelligenceArtifact } from '../types';
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

  if (space.web3SpaceId != null) {
    if (!canConvertToBigInt(space.web3SpaceId)) {
      return {
        access: 'denied',
        message: `Space "${space.slug}" has an invalid on-chain space id.`,
        space_slug: spaceSlug,
      };
    }
    const gate = await checkSpaceAccessForSpace(space, input.authToken);
    if (!gate.hasAccess) {
      return {
        access: 'denied',
        message: gate.message,
        space_slug: spaceSlug,
      };
    }
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
  if (!entry) {
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
