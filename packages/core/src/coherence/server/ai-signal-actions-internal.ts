import { findSpaceBySlug } from '../../space/server';
import type { DbConfig } from '../../server';
import { CreateCoherenceInput } from '../types';
import { createCoherence } from './mutations';

/**
 * Not re-exported from `./index` / `@hypha-platform/core/server` — deliberately unreachable
 * outside `coherence/server`. This performs the raw signal write with no access/auth checks
 * of its own; every caller (`ai-signal-actions.ts`'s authed path, `ai-signal-actions-system.ts`'s
 * system path) is responsible for verifying the caller may write to `host` *before* calling this.
 */

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
