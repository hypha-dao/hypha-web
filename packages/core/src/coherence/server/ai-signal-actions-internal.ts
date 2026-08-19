import { findSpaceBySlug } from '../../space/server';
import { getAllOrganizationSpacesForNodeById } from '../../space/server/web3';
import type { DbConfig } from '../../server';
import { CreateCoherenceInput } from '../types';
import { createCoherence } from './mutations';

/**
 * Not re-exported from `./index` / `@hypha-platform/core/server` — deliberately unreachable
 * outside `coherence/server`. This performs the raw signal write with no access/auth checks
 * of its own; every caller (`ai-signal-actions.ts`'s authed path, `ai-signal-actions-system.ts`'s
 * system path) is responsible for verifying the caller may write to `host` *before* calling this.
 */

/**
 * Shared ecosystem-root gate for both relay paths (`relayAiSignalToEcosystemSpace` and
 * `relaySystemAiSignalToEcosystemSpace`). This is a security boundary — it decides whether a
 * signal may be relayed from `source` into `target` — so it must not be duplicated: two copies
 * can diverge and one can end up relaying signals outside the ecosystem root.
 */
export async function checkEcosystemRelayAllowed({
  source,
  target,
}: {
  source: { id: number };
  target: { id: number };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [ecosystem, targetEcosystem] = await Promise.all([
    getAllOrganizationSpacesForNodeById({ id: source.id }),
    getAllOrganizationSpacesForNodeById({ id: target.id }),
  ]);

  const resolveRootId = (
    spaces: Array<{ id: number; parentId?: number | null }>,
    fallbackId: number,
  ): number => {
    return spaces.find((space) => space.parentId == null)?.id ?? fallbackId;
  };

  const sourceRootId = resolveRootId(ecosystem, source.id);
  const targetRootId = resolveRootId(targetEcosystem, target.id);
  const targetInEcosystem = ecosystem.some((space) => space.id === target.id);
  const sourceInTargetEcosystem = targetEcosystem.some(
    (space) => space.id === source.id,
  );
  const sameRoot = sourceRootId === targetRootId;

  if (!targetInEcosystem || !sourceInTargetEcosystem || !sameRoot) {
    return {
      ok: false,
      error:
        'Target space is outside the source ecosystem. Relay is limited to spaces that share the same ecosystem root.',
    };
  }
  return { ok: true };
}

const AI_SIGNAL_TAG = 'AI Signal';

export function normalizeTags(tags: string[] | undefined): string[] {
  const uniqueTags = (tags ?? [])
    .map((tag) => tag.trim())
    .filter(
      (tag, index, arr) =>
        tag.length > 0 &&
        arr.findIndex(
          (candidate) =>
            candidate.trim().toLowerCase() === tag.trim().toLowerCase(),
        ) === index,
    );

  if (!uniqueTags.some((tag) => tag.trim().toLowerCase() === 'ai signal')) {
    uniqueTags.push(AI_SIGNAL_TAG);
  }

  return uniqueTags;
}

export async function createSignalInSpace(
  {
    host,
    creatorId,
    title,
    description,
    type,
    priority,
    tags,
  }: {
    host: NonNullable<Awaited<ReturnType<typeof findSpaceBySlug>>>;
    creatorId: number | null;
    title: string;
    description: string;
    type: CreateCoherenceInput['type'];
    priority: CreateCoherenceInput['priority'];
    tags?: string[];
  },
  { db }: DbConfig,
) {
  const payload: CreateCoherenceInput = {
    creatorId,
    spaceId: host.id,
    type,
    priority,
    title: title.trim(),
    description: description.trim(),
    archived: false,
    tags: normalizeTags(tags),
  };
  return createCoherence(payload, { db });
}
