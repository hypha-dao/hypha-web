import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { findSpaceBySlug } from '../../space/server/queries';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import type { IntelligenceManifestEntry } from '../types';
import { assertSafeSpaceSlug } from '../paths';
import { readSpaceIntelligenceManifest } from './manifest';

export type ListIntelligenceBySpaceSlugInput = {
  spaceSlug: string;
  type?: string;
  status?: string;
  search?: string;
  authToken?: string;
};

export type ListIntelligenceBySpaceSlugResult =
  | {
      access: 'ok';
      configured: boolean;
      space_slug: string;
      artifacts: IntelligenceManifestEntry[];
    }
  | {
      access: 'denied';
      message: string;
      space_slug: string;
    };

export async function listIntelligenceBySpaceSlug(
  input: ListIntelligenceBySpaceSlugInput,
  { db }: { db: DatabaseInstance },
): Promise<ListIntelligenceBySpaceSlugResult> {
  const spaceSlug = assertSafeSpaceSlug(input.spaceSlug);
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

  const { configured, manifest } = await readSpaceIntelligenceManifest(
    spaceSlug,
  );

  let artifacts = manifest.artifacts.filter(
    (a) => a.status !== 'archived' && a.status !== 'superseded',
  );

  if (input.type?.trim()) {
    const type = input.type.trim().toLowerCase();
    artifacts = artifacts.filter((a) => a.type.toLowerCase() === type);
  }
  if (input.status?.trim()) {
    const status = input.status.trim().toLowerCase();
    artifacts = artifacts.filter((a) => a.status === status);
  }
  if (input.search?.trim()) {
    const q = input.search.trim().toLowerCase();
    artifacts = artifacts.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  return {
    access: 'ok',
    configured,
    space_slug: spaceSlug,
    artifacts,
  };
}
