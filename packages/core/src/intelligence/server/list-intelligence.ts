import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { findSpaceBySlug } from '../../space/server/queries';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import type { IntelligenceListItem, IntelligenceManifestEntry } from '../types';
import { excerptIntelligenceBody } from '../excerpt';
import { assertSafeSpaceSlug } from '../paths';
import { readSpaceIntelligenceManifest } from './manifest';
import { readIntelligenceBlobText } from './blob-client';
import {
  parseIntelligenceMarkdown,
  splitIntelligenceFrontmatter,
} from '../parse-markdown';

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
      artifacts: IntelligenceListItem[];
      enabled_packs: string[];
    }
  | {
      access: 'denied';
      message: string;
      space_slug: string;
    };

async function withExcerpt(
  entry: IntelligenceManifestEntry,
): Promise<IntelligenceListItem> {
  try {
    const raw = await readIntelligenceBlobText(entry.path);
    if (!raw) return { ...entry, excerpt: '' };
    let body = '';
    try {
      body = parseIntelligenceMarkdown(raw).body;
    } catch {
      try {
        body = splitIntelligenceFrontmatter(raw).body;
      } catch {
        body = raw;
      }
    }
    return { ...entry, excerpt: excerptIntelligenceBody(body) };
  } catch {
    return { ...entry, excerpt: '' };
  }
}

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

  const listed = await Promise.all(artifacts.map(withExcerpt));

  const search = input.search?.trim().toLowerCase();
  const filtered = search
    ? listed.filter(
        (a) =>
          a.title.toLowerCase().includes(search) ||
          a.id.toLowerCase().includes(search) ||
          a.tags.some((tag) => tag.toLowerCase().includes(search)) ||
          (a.excerpt ?? '').toLowerCase().includes(search),
      )
    : listed;

  return {
    access: 'ok',
    configured,
    space_slug: spaceSlug,
    artifacts: filtered,
    enabled_packs: manifest.enabled_packs ?? [],
  };
}
