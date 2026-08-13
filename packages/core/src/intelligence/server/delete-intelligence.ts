import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { findSpaceBySlug } from '../../space/server/queries';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import type { IntelligenceManifestEntry } from '../types';
import { assertSafeArtifactId, assertSafeSpaceSlug } from '../paths';
import {
  archiveManifestEntry,
  readSpaceIntelligenceManifest,
  writeSpaceIntelligenceManifest,
} from './manifest';
import {
  IntelligenceBlobNotConfiguredError,
  isIntelligenceBlobConfigured,
} from './blob-client';

export type DeleteIntelligenceInput = {
  spaceSlug: string;
  artifactId: string;
  expectedSha: string;
  authToken?: string;
  /** Hard delete is not enabled in MVP. */
  hard?: boolean;
};

export type DeleteIntelligenceResult =
  | {
      access: 'ok';
      space_slug: string;
      artifact_id: string;
      archived: true;
      entry: IntelligenceManifestEntry;
    }
  | {
      access: 'denied';
      message: string;
      space_slug: string;
    }
  | {
      access: 'conflict';
      message: string;
      space_slug: string;
      currentSha?: string;
    }
  | {
      access: 'misconfigured';
      message: string;
      space_slug: string;
    };

export async function deleteIntelligenceBySpaceSlug(
  input: DeleteIntelligenceInput,
  { db }: { db: DatabaseInstance },
): Promise<DeleteIntelligenceResult> {
  const spaceSlug = assertSafeSpaceSlug(input.spaceSlug);
  const artifactId = assertSafeArtifactId(input.artifactId);

  if (input.hard) {
    return {
      access: 'denied',
      message:
        'Hard delete is not enabled; artifacts are soft-archived in the manifest.',
      space_slug: spaceSlug,
    };
  }

  if (!isIntelligenceBlobConfigured()) {
    return {
      access: 'misconfigured',
      message:
        'Space Intelligence storage is not configured (BLOB_READ_WRITE_TOKEN).',
      space_slug: spaceSlug,
    };
  }

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

  const expectedSha = input.expectedSha.trim().toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(expectedSha)) {
    return {
      access: 'denied',
      message: 'expectedSha must be a hex content SHA.',
      space_slug: spaceSlug,
    };
  }

  try {
    const { manifest } = await readSpaceIntelligenceManifest(spaceSlug);
    const existing = manifest.artifacts.find((a) => a.id === artifactId);
    if (!existing) {
      return {
        access: 'denied',
        message: `Artifact "${artifactId}" was not found in the space manifest.`,
        space_slug: spaceSlug,
      };
    }
    if (existing.status === 'archived') {
      return {
        access: 'ok',
        space_slug: spaceSlug,
        artifact_id: artifactId,
        archived: true,
        entry: existing,
      };
    }
    if (existing.sha !== expectedSha) {
      return {
        access: 'conflict',
        message: 'Content SHA mismatch; reload and retry.',
        space_slug: spaceSlug,
        currentSha: existing.sha,
      };
    }

    const nextManifest = archiveManifestEntry(manifest, artifactId);
    await writeSpaceIntelligenceManifest({
      spaceSlug,
      manifest: nextManifest,
    });
    const entry =
      nextManifest.artifacts.find((a) => a.id === artifactId) ?? existing;

    return {
      access: 'ok',
      space_slug: spaceSlug,
      artifact_id: artifactId,
      archived: true,
      entry,
    };
  } catch (error) {
    if (error instanceof IntelligenceBlobNotConfiguredError) {
      return {
        access: 'misconfigured',
        message: error.message,
        space_slug: spaceSlug,
      };
    }
    throw error;
  }
}
