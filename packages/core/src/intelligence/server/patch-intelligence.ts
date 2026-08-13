import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { findSpaceBySlug } from '../../space/server/queries';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { findCoherenceBySlug } from '../../coherence/server/queries';
import type { IntelligenceArtifactPatch } from '../patch-types';
import {
  assertSafeArtifactId,
  assertSafeSignalSlug,
  assertSafeSpaceSlug,
  artifactPatchPath,
  matchCallerIntelligencePath,
} from '../paths';
import {
  parseIntelligenceMarkdown,
  stampIntelligenceSourceApp,
  type ParsedIntelligenceMarkdown,
} from '../parse-markdown';
import { assertIntelligenceMarkdownSize } from '../app-identity';
import {
  IntelligenceBlobNotConfiguredError,
  isIntelligenceBlobConfigured,
  putIntelligenceBlobText,
  readIntelligenceBlobText,
} from './blob-client';
import { writeIntelligenceBySpaceSlug } from './write-intelligence';
import { readSpaceIntelligenceManifest } from './manifest';

export type ProposeIntelligencePatchInput = {
  spaceSlug: string;
  signalSlug: string;
  targetId: string;
  expectedSha: string;
  markdown: string;
  source_app?: string;
  title?: string;
  authToken?: string;
  canonicalSourceApp?: string;
  callerPath?: string;
};

export type ApproveIntelligencePatchInput = {
  spaceSlug: string;
  signalSlug: string;
  /** Optional edited markdown; defaults to the stored proposal. */
  markdown?: string;
  authToken?: string;
};

export type RejectIntelligencePatchInput = {
  spaceSlug: string;
  signalSlug: string;
  authToken?: string;
};

export type GetIntelligencePatchInput = {
  spaceSlug: string;
  signalSlug: string;
  authToken?: string;
};

type PatchGateResult =
  | { access: 'ok'; spaceSlug: string; signalSlug: string }
  | { access: 'denied'; message: string; space_slug: string }
  | { access: 'misconfigured'; message: string; space_slug: string };

async function gatePatchAccess(
  input: { spaceSlug: string; signalSlug: string; authToken?: string },
  { db }: { db: DatabaseInstance },
): Promise<PatchGateResult> {
  const spaceSlug = assertSafeSpaceSlug(input.spaceSlug);
  const signalSlug = assertSafeSignalSlug(input.signalSlug);

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

  const signal = await findCoherenceBySlug({ slug: signalSlug }, { db });
  if (!signal || signal.spaceId !== space.id) {
    return {
      access: 'denied',
      message: `Signal "${signalSlug}" was not found in space "${spaceSlug}".`,
      space_slug: spaceSlug,
    };
  }

  return { access: 'ok', spaceSlug, signalSlug };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parsePatchJson(raw: string): IntelligenceArtifactPatch | null {
  try {
    const parsed = JSON.parse(raw) as IntelligenceArtifactPatch;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.target_id ||
      !parsed.expected_sha ||
      !parsed.markdown ||
      !parsed.signal_slug
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readPatchFile(
  spaceSlug: string,
  signalSlug: string,
): Promise<IntelligenceArtifactPatch | null> {
  const path = artifactPatchPath({ spaceSlug, signalSlug });
  const text = await readIntelligenceBlobText(path);
  if (!text) return null;
  return parsePatchJson(text);
}

async function writePatchFile(patch: IntelligenceArtifactPatch): Promise<void> {
  const path = artifactPatchPath({
    spaceSlug: patch.space,
    signalSlug: patch.signal_slug,
  });
  await putIntelligenceBlobText({
    pathname: path,
    body: JSON.stringify(patch, null, 2),
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
  });
}

export async function getIntelligencePatchForSignal(
  input: GetIntelligencePatchInput,
  { db }: { db: DatabaseInstance },
): Promise<
  | {
      access: 'ok';
      configured: boolean;
      space_slug: string;
      patch: IntelligenceArtifactPatch | null;
    }
  | { access: 'denied'; message: string; space_slug: string }
  | { access: 'misconfigured'; message: string; space_slug: string }
> {
  const gated = await gatePatchAccess(input, { db });
  if (gated.access !== 'ok') return gated;

  try {
    const patch = await readPatchFile(gated.spaceSlug, gated.signalSlug);
    return {
      access: 'ok',
      configured: true,
      space_slug: gated.spaceSlug,
      patch,
    };
  } catch (error) {
    if (error instanceof IntelligenceBlobNotConfiguredError) {
      return {
        access: 'misconfigured',
        message: error.message,
        space_slug: gated.spaceSlug,
      };
    }
    throw error;
  }
}

export async function proposeIntelligencePatchForSignal(
  input: ProposeIntelligencePatchInput,
  { db }: { db: DatabaseInstance },
): Promise<
  | {
      access: 'ok';
      space_slug: string;
      patch: IntelligenceArtifactPatch;
    }
  | { access: 'denied'; message: string; space_slug: string }
  | { access: 'misconfigured'; message: string; space_slug: string }
  | {
      access: 'conflict';
      message: string;
      space_slug: string;
      currentSha?: string;
    }
> {
  const gated = await gatePatchAccess(input, { db });
  if (gated.access !== 'ok') return gated;

  const targetId = assertSafeArtifactId(input.targetId);
  const expectedSha = input.expectedSha.trim().toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(expectedSha)) {
    return {
      access: 'denied',
      message: 'expectedSha must be a hex content SHA.',
      space_slug: gated.spaceSlug,
    };
  }

  let markdown = input.markdown;
  try {
    assertIntelligenceMarkdownSize(markdown);
  } catch (error) {
    return {
      access: 'denied',
      message:
        error instanceof Error ? error.message : 'Markdown is too large.',
      space_slug: gated.spaceSlug,
    };
  }

  if (input.canonicalSourceApp) {
    try {
      markdown = stampIntelligenceSourceApp(markdown, input.canonicalSourceApp);
    } catch {
      return {
        access: 'denied',
        message:
          'Proposed markdown is not valid intelligence frontmatter + body.',
        space_slug: gated.spaceSlug,
      };
    }
  }

  let parsed: ParsedIntelligenceMarkdown;
  try {
    parsed = parseIntelligenceMarkdown(markdown);
  } catch {
    return {
      access: 'denied',
      message:
        'Proposed markdown is not valid intelligence frontmatter + body.',
      space_slug: gated.spaceSlug,
    };
  }

  if (parsed.frontmatter.id !== targetId) {
    return {
      access: 'denied',
      message: `Proposed frontmatter id "${parsed.frontmatter.id}" does not match target_id "${targetId}".`,
      space_slug: gated.spaceSlug,
    };
  }
  if (parsed.frontmatter.space !== gated.spaceSlug) {
    return {
      access: 'denied',
      message: `Proposed frontmatter space does not match "${gated.spaceSlug}".`,
      space_slug: gated.spaceSlug,
    };
  }

  const pathMatch = matchCallerIntelligencePath({
    spaceSlug: gated.spaceSlug,
    type: parsed.frontmatter.type,
    id: parsed.frontmatter.id,
    callerPath: input.callerPath,
  });
  if (!pathMatch.ok) {
    return {
      access: 'denied',
      message: pathMatch.message,
      space_slug: gated.spaceSlug,
    };
  }

  const { manifest } = await readSpaceIntelligenceManifest(gated.spaceSlug);
  const existing = manifest.artifacts.find((a) => a.id === targetId);
  if (!existing) {
    return {
      access: 'denied',
      message: `Target artifact "${targetId}" was not found in the space manifest.`,
      space_slug: gated.spaceSlug,
    };
  }
  if (existing.sha !== expectedSha) {
    return {
      access: 'conflict',
      message:
        'expectedSha does not match the live artifact; reload and retry.',
      space_slug: gated.spaceSlug,
      currentSha: existing.sha,
    };
  }

  const now = todayIsoDate();
  const patch: IntelligenceArtifactPatch = {
    status: 'pending',
    space: gated.spaceSlug,
    signal_slug: gated.signalSlug,
    target_id: targetId,
    expected_sha: expectedSha,
    source_app:
      input.canonicalSourceApp ||
      input.source_app?.trim() ||
      parsed.frontmatter.source_app,
    title: input.title?.trim() || parsed.frontmatter.title || existing.title,
    created_at: now,
    updated_at: now,
    markdown,
  };

  await writePatchFile(patch);
  return { access: 'ok', space_slug: gated.spaceSlug, patch };
}

export async function approveIntelligencePatchForSignal(
  input: ApproveIntelligencePatchInput,
  { db }: { db: DatabaseInstance },
): Promise<
  | {
      access: 'ok';
      space_slug: string;
      patch: IntelligenceArtifactPatch;
      artifactId: string;
      sha: string;
    }
  | { access: 'denied'; message: string; space_slug: string }
  | { access: 'misconfigured'; message: string; space_slug: string }
  | {
      access: 'conflict';
      message: string;
      space_slug: string;
      currentSha?: string;
    }
> {
  const gated = await gatePatchAccess(input, { db });
  if (gated.access !== 'ok') return gated;

  const existingPatch = await readPatchFile(gated.spaceSlug, gated.signalSlug);
  if (!existingPatch || existingPatch.status !== 'pending') {
    return {
      access: 'denied',
      message: `No pending intelligence patch for signal "${gated.signalSlug}".`,
      space_slug: gated.spaceSlug,
    };
  }

  const markdown = input.markdown?.trim()
    ? input.markdown
    : existingPatch.markdown;

  const written = await writeIntelligenceBySpaceSlug(
    {
      spaceSlug: gated.spaceSlug,
      markdown,
      expectedSha: existingPatch.expected_sha,
      source_app: existingPatch.source_app,
      authToken: input.authToken,
    },
    { db },
  );

  if (written.access === 'denied' || written.access === 'misconfigured') {
    return written;
  }
  if (written.access === 'conflict') {
    return {
      access: 'conflict',
      message: written.message,
      space_slug: written.space_slug,
      currentSha: written.currentSha,
    };
  }

  const approved: IntelligenceArtifactPatch = {
    ...existingPatch,
    status: 'approved',
    markdown,
    updated_at: todayIsoDate(),
  };
  await writePatchFile(approved);

  return {
    access: 'ok',
    space_slug: gated.spaceSlug,
    patch: approved,
    artifactId: written.artifact.frontmatter.id,
    sha: written.artifact.sha,
  };
}

export async function rejectIntelligencePatchForSignal(
  input: RejectIntelligencePatchInput,
  { db }: { db: DatabaseInstance },
): Promise<
  | {
      access: 'ok';
      space_slug: string;
      patch: IntelligenceArtifactPatch;
    }
  | { access: 'denied'; message: string; space_slug: string }
  | { access: 'misconfigured'; message: string; space_slug: string }
> {
  const gated = await gatePatchAccess(input, { db });
  if (gated.access !== 'ok') return gated;

  const existingPatch = await readPatchFile(gated.spaceSlug, gated.signalSlug);
  if (!existingPatch || existingPatch.status !== 'pending') {
    return {
      access: 'denied',
      message: `No pending intelligence patch for signal "${gated.signalSlug}".`,
      space_slug: gated.spaceSlug,
    };
  }

  const rejected: IntelligenceArtifactPatch = {
    ...existingPatch,
    status: 'rejected',
    updated_at: todayIsoDate(),
  };
  await writePatchFile(rejected);

  return { access: 'ok', space_slug: gated.spaceSlug, patch: rejected };
}
