import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import { gateIntelligenceSpaceAccess } from './space-access';
import { ibaWriteDeniesPublish, IBA_CANNOT_PUBLISH } from '../iba-access';
import type {
  IntelligenceArtifact,
  IntelligenceFrontmatter,
  IntelligenceStatus,
} from '../types';
import {
  assertSafeSpaceSlug,
  artifactCurrentPath,
  artifactVersionPath,
  isAllowedIntelligenceMarkdownPath,
  matchCallerIntelligencePath,
} from '../paths';
import {
  parseIntelligenceMarkdown,
  serializeIntelligenceMarkdown,
  stampIntelligenceSourceApp,
  type ParsedIntelligenceMarkdown,
} from '../parse-markdown';
import {
  formatIntelligenceMarkdownError,
  parseIntelligenceFrontmatter,
} from '../validation';
import { assertIntelligenceMarkdownSize } from '../app-identity';
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
  /** IBA space API key: skip Privy membership / transparency. */
  skipMembershipCheck?: boolean;
  /** Fail if the artifact already exists (MCP memory.create). */
  createOnly?: boolean;
  /** Fail if the artifact does not exist (MCP memory.update publish). */
  updateOnly?: boolean;
  /** Server-assigned app identity; stamped onto frontmatter when set. */
  canonicalSourceApp?: string;
  /** Optional caller path; must match the derived `.md` key. */
  callerPath?: string;
  /** Force frontmatter status (e.g. draft create). */
  forceStatus?: IntelligenceStatus;
  /** If the incoming status is draft, promote to current (member publish). */
  promoteDraft?: boolean;
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

  const membership = await gateIntelligenceSpaceAccess(space, input, spaceSlug);
  if (membership.access === 'denied') {
    return membership;
  }

  if (ibaWriteDeniesPublish(input)) {
    return {
      access: 'denied',
      message: IBA_CANNOT_PUBLISH,
      space_slug: spaceSlug,
    };
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
      linked_signals: input.frontmatter.linked_signals,
      pack_id: input.frontmatter.pack_id,
      pack_alias: input.frontmatter.pack_alias,
      maturity: input.frontmatter.maturity,
      confidence: input.frontmatter.confidence,
      community_id: input.frontmatter.community_id,
      room_id: input.frontmatter.room_id,
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

  try {
    assertIntelligenceMarkdownSize(raw);
  } catch (error) {
    return {
      access: 'denied',
      message:
        error instanceof Error ? error.message : 'Markdown is too large.',
      space_slug: spaceSlug,
    };
  }

  if (input.canonicalSourceApp) {
    try {
      raw = stampIntelligenceSourceApp(raw, input.canonicalSourceApp);
    } catch (error) {
      return {
        access: 'denied',
        message: formatIntelligenceMarkdownError(error),
        space_slug: spaceSlug,
      };
    }
  }

  let parsed: ParsedIntelligenceMarkdown;
  try {
    parsed = parseIntelligenceMarkdown(raw);
  } catch (error) {
    return {
      access: 'denied',
      message: formatIntelligenceMarkdownError(error),
      space_slug: spaceSlug,
    };
  }
  if (parsed.frontmatter.space !== spaceSlug) {
    return {
      access: 'denied',
      message: `Frontmatter space "${parsed.frontmatter.space}" does not match path space "${spaceSlug}".`,
      space_slug: spaceSlug,
    };
  }

  if (input.forceStatus && parsed.frontmatter.status !== input.forceStatus) {
    raw = serializeIntelligenceMarkdown({
      frontmatter: { ...parsed.frontmatter, status: input.forceStatus },
      body: parsed.body,
    });
    parsed = parseIntelligenceMarkdown(raw);
  } else if (
    input.skipMembershipCheck &&
    parsed.frontmatter.status !== 'draft'
  ) {
    raw = serializeIntelligenceMarkdown({
      frontmatter: { ...parsed.frontmatter, status: 'draft' },
      body: parsed.body,
    });
    parsed = parseIntelligenceMarkdown(raw);
  } else if (input.promoteDraft && parsed.frontmatter.status === 'draft') {
    raw = serializeIntelligenceMarkdown({
      frontmatter: { ...parsed.frontmatter, status: 'current' },
      body: parsed.body,
    });
    parsed = parseIntelligenceMarkdown(raw);
  }

  const pathMatch = matchCallerIntelligencePath({
    spaceSlug,
    type: parsed.frontmatter.type,
    id: parsed.frontmatter.id,
    callerPath: input.callerPath,
  });
  if (!pathMatch.ok) {
    return {
      access: 'denied',
      message: pathMatch.message,
      space_slug: spaceSlug,
    };
  }

  const { manifest } = await readSpaceIntelligenceManifest(spaceSlug);
  const existing = manifest.artifacts.find(
    (a) => a.id === parsed.frontmatter.id,
  );
  const created = !existing;

  if (input.createOnly && existing) {
    return {
      access: 'conflict',
      message: `Artifact "${parsed.frontmatter.id}" already exists; use memory.update.`,
      space_slug: spaceSlug,
      currentSha: existing.sha,
    };
  }
  if (input.updateOnly && !existing) {
    return {
      access: 'denied',
      message: `Artifact "${parsed.frontmatter.id}" was not found; use memory.create.`,
      space_slug: spaceSlug,
    };
  }

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

  const path = pathMatch.path;
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
    canonicalSourceApp?: string;
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
      canonicalSourceApp: input.canonicalSourceApp,
    },
    cfg,
  );
}
