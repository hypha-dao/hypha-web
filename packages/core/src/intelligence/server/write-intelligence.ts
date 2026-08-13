import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { findSpaceBySlug } from '../../space/server/queries';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import type { IntelligenceArtifact, IntelligenceFrontmatter } from '../types';
import {
  assertSafeSpaceSlug,
  artifactCurrentPath,
  artifactVersionPath,
  isAllowedIntelligenceMarkdownPath,
} from '../paths';
import {
  parseIntelligenceMarkdown,
  serializeIntelligenceMarkdown,
} from '../parse-markdown';
import { contentSha } from '../content-sha';
import { parseIntelligenceFrontmatter } from '../validation';
import {
  readSpaceIntelligenceManifest,
  upsertManifestEntry,
  writeSpaceIntelligenceManifest,
} from './manifest';
import { manifestEntryFromFrontmatter } from '../validation';
import {
  IntelligenceBlobNotConfiguredError,
  isIntelligenceBlobConfigured,
  putIntelligenceBlobText,
  readIntelligenceBlobText,
} from './blob-client';

export type WriteIntelligenceInput = {
  spaceSlug: string;
  /** Full markdown with YAML frontmatter, or frontmatter + body separately. */
  markdown?: string;
  frontmatter?: Partial<IntelligenceFrontmatter> &
    Pick<
      IntelligenceFrontmatter,
      'id' | 'type' | 'title' | 'source_app' | 'status'
    >;
  body?: string;
  /** Required on update when an artifact already exists. */
  expectedSha?: string;
  source_app?: string;
  authToken?: string;
};

export type WriteIntelligenceResult =
  | {
      access: 'ok';
      artifact: IntelligenceArtifact;
      created: boolean;
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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function writeIntelligenceBySpaceSlug(
  input: WriteIntelligenceInput,
  { db }: { db: DatabaseInstance },
): Promise<WriteIntelligenceResult> {
  const spaceSlug = assertSafeSpaceSlug(input.spaceSlug);

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

  let raw: string;
  if (input.markdown?.trim()) {
    raw = input.markdown;
  } else if (input.frontmatter) {
    const today = todayIsoDate();
    const fm = parseIntelligenceFrontmatter({
      id: input.frontmatter.id,
      type: input.frontmatter.type,
      title: input.frontmatter.title,
      space: spaceSlug,
      source_app: input.frontmatter.source_app || input.source_app || 'hypha',
      status: input.frontmatter.status,
      created_at: input.frontmatter.created_at ?? today,
      updated_at: today,
      tags: input.frontmatter.tags ?? [],
      related: input.frontmatter.related ?? [],
      version: input.frontmatter.version ?? 1,
      supersedes: input.frontmatter.supersedes ?? null,
    });
    raw = serializeIntelligenceMarkdown({
      frontmatter: fm,
      body: input.body ?? '',
    });
  } else {
    return {
      access: 'denied',
      message: 'Provide markdown or frontmatter+body.',
      space_slug: spaceSlug,
    };
  }

  let parsed = parseIntelligenceMarkdown(raw);
  if (parsed.frontmatter.space !== spaceSlug) {
    return {
      access: 'denied',
      message: `Frontmatter space "${parsed.frontmatter.space}" does not match path space "${spaceSlug}".`,
      space_slug: spaceSlug,
    };
  }

  const { manifest } = await readSpaceIntelligenceManifest(spaceSlug);
  const existing = manifest.artifacts.find(
    (a) => a.id === parsed.frontmatter.id,
  );
  const created = !existing;

  if (existing) {
    if (!input.expectedSha) {
      return {
        access: 'conflict',
        message: 'expectedSha is required to update an existing artifact.',
        space_slug: spaceSlug,
        currentSha: existing.sha,
      };
    }
    if (existing.sha !== input.expectedSha) {
      return {
        access: 'conflict',
        message: 'Content SHA mismatch; reload and retry.',
        space_slug: spaceSlug,
        currentSha: existing.sha,
      };
    }

    // Bump version and supersede prior content sha as version pointer metadata.
    const nextFm = parseIntelligenceFrontmatter({
      ...parsed.frontmatter,
      updated_at: todayIsoDate(),
      version: existing.version + 1,
      // Point at prior content sha for provenance (immutable blob under _versions).
      supersedes: existing.sha,
    });
    raw = serializeIntelligenceMarkdown({
      frontmatter: nextFm,
      body: parsed.body,
    });
    parsed = parseIntelligenceMarkdown(raw);
  }

  const path = artifactCurrentPath({
    spaceSlug,
    type: parsed.frontmatter.type,
    id: parsed.frontmatter.id,
  });
  if (!isAllowedIntelligenceMarkdownPath(spaceSlug, path)) {
    return {
      access: 'denied',
      message: 'Resolved path is outside the permitted intelligence prefix.',
      space_slug: spaceSlug,
    };
  }

  const versionPath = artifactVersionPath({
    spaceSlug,
    id: parsed.frontmatter.id,
    sha: parsed.sha,
  });

  try {
    // Immutable version first, then current pointer, then manifest.
    await putIntelligenceBlobText({
      pathname: versionPath,
      body: parsed.raw,
      allowOverwrite: false,
    });
    await putIntelligenceBlobText({
      pathname: path,
      body: parsed.raw,
      allowOverwrite: true,
    });

    const entry = manifestEntryFromFrontmatter({
      frontmatter: parsed.frontmatter,
      path,
      sha: parsed.sha,
    });
    const nextManifest = upsertManifestEntry(manifest, entry);
    await writeSpaceIntelligenceManifest({
      spaceSlug,
      manifest: nextManifest,
    });

    return {
      access: 'ok',
      created,
      artifact: {
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        raw: parsed.raw,
        path,
        sha: parsed.sha,
      },
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

/** Seed helper for demos — writes only if id is absent. */
export async function seedIntelligenceArtifactIfMissing(
  input: {
    spaceSlug: string;
    markdown: string;
    authToken?: string;
  },
  cfg: { db: DatabaseInstance },
): Promise<WriteIntelligenceResult> {
  if (!isIntelligenceBlobConfigured()) {
    return {
      access: 'misconfigured',
      message: 'BLOB_READ_WRITE_TOKEN is not set.',
      space_slug: input.spaceSlug,
    };
  }
  const parsed = parseIntelligenceMarkdown(input.markdown);
  const { manifest } = await readSpaceIntelligenceManifest(input.spaceSlug);
  if (manifest.artifacts.some((a) => a.id === parsed.frontmatter.id)) {
    const text = await readIntelligenceBlobText(
      artifactCurrentPath({
        spaceSlug: input.spaceSlug,
        type: parsed.frontmatter.type,
        id: parsed.frontmatter.id,
      }),
    );
    if (text) {
      const existing = parseIntelligenceMarkdown(text);
      return {
        access: 'ok',
        created: false,
        artifact: {
          frontmatter: existing.frontmatter,
          body: existing.body,
          raw: existing.raw,
          path: artifactCurrentPath({
            spaceSlug: input.spaceSlug,
            type: existing.frontmatter.type,
            id: existing.frontmatter.id,
          }),
          sha: existing.sha,
        },
      };
    }
  }
  return writeIntelligenceBySpaceSlug(
    {
      spaceSlug: input.spaceSlug,
      markdown: input.markdown,
      authToken: input.authToken,
      source_app: parsed.frontmatter.source_app,
    },
    cfg,
  );
}
