import { findSpaceBySlug } from '../../space/server';
import { getAllOrganizationSpacesForNodeById } from '../../space/server/web3';
import type { DbConfig } from '../../server';
import {
  buildAiSignalNavigation,
  getSpacePaymentEligibility,
  toPaymentReason,
  type SignalPriority,
  type SignalType,
} from './ai-signal-actions';
import { createSignalInSpace } from './ai-signal-actions-internal';

/**
 * System-triggered signal writes — no Privy token, no `checkSpaceAccessForSpace` gate,
 * `creatorId` always written as `null`. Deliberately **not** re-exported from `./index` /
 * `@hypha-platform/core/server` — the only supported caller is `signal-orchestrator.ts`
 * (relative import), which is itself only reachable from HTTP routes already gated by a
 * shared secret before any of this runs:
 * `apps/web/src/app/api/cron/signals-orchestrate/route.ts` (CRON_SECRET, Vercel Cron only)
 * `apps/web/src/app/api/v1/ops/signals/orchestrate/route.ts` (HYPHA_SPACE_MEMORY_OPS_SECRET)
 *
 * Do not import this from chat-server/mcp-server tool handlers or any other user-facing
 * entrypoint — those must keep going through `createAiSignalForSpaceBySlug` /
 * `relayAiSignalToEcosystemSpace` in `./ai-signal-actions`, which always require a real
 * `authToken` and always run the access gate.
 */

type CreateSystemAiSignalInput = {
  spaceSlug: string;
  title: string;
  description: string;
  type: SignalType;
  priority: SignalPriority;
  tags?: string[];
  lang?: string;
};

type RelaySystemAiSignalInput = {
  sourceSpaceSlug: string;
  targetSpaceSlug: string;
  title: string;
  summary: string;
  recommendedAction: string;
  relevanceRationale: string;
  type: SignalType;
  priority: SignalPriority;
  tags?: string[];
  sourceAssetKeys?: string[];
  lang?: string;
};

export async function createSystemAiSignalForSpaceBySlug(
  {
    spaceSlug,
    title,
    description,
    type,
    priority,
    tags,
    lang,
  }: CreateSystemAiSignalInput,
  { db }: DbConfig,
) {
  const host = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!host) {
    return { ok: false as const, error: 'Space not found' };
  }

  const payment = await getSpacePaymentEligibility(host.web3SpaceId);
  const paymentReason = toPaymentReason(payment);
  if (paymentReason) {
    return { ok: false as const, error: paymentReason };
  }

  const created = await createSignalInSpace(
    { host, creatorId: null, title, description, type, priority, tags },
    { db },
  );

  const signalSlug = created.slug?.trim();
  if (!signalSlug) {
    return {
      ok: false as const,
      error: 'Signal was created but slug is missing.',
    };
  }

  return {
    ok: true as const,
    signalId: created.id,
    signalSlug,
    spaceSlug: host.slug,
    creatorId: null,
    navigation: buildAiSignalNavigation({
      lang,
      spaceSlug: host.slug,
      signalSlug,
      signalTitle: title,
      roomId: created.roomId,
    }),
  };
}

export async function relaySystemAiSignalToEcosystemSpace(
  {
    sourceSpaceSlug,
    targetSpaceSlug,
    title,
    summary,
    recommendedAction,
    relevanceRationale,
    type,
    priority,
    tags,
    sourceAssetKeys,
    lang,
  }: RelaySystemAiSignalInput,
  { db }: DbConfig,
) {
  const [source, target] = await Promise.all([
    findSpaceBySlug({ slug: sourceSpaceSlug }, { db }),
    findSpaceBySlug({ slug: targetSpaceSlug }, { db }),
  ]);

  if (!source) return { ok: false as const, error: 'Source space not found' };
  if (!target) return { ok: false as const, error: 'Target space not found' };

  const sourcePayment = await getSpacePaymentEligibility(source.web3SpaceId);
  const targetPayment = await getSpacePaymentEligibility(target.web3SpaceId);
  const sourcePaymentReason = toPaymentReason(sourcePayment);
  if (sourcePaymentReason)
    return { ok: false as const, error: sourcePaymentReason };
  const targetPaymentReason = toPaymentReason(targetPayment);
  if (targetPaymentReason)
    return { ok: false as const, error: targetPaymentReason };

  const ecosystem = await getAllOrganizationSpacesForNodeById({
    id: source.id,
  });
  const targetEcosystem = await getAllOrganizationSpacesForNodeById({
    id: target.id,
  });

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
      ok: false as const,
      error:
        'Target space is outside the source ecosystem. Relay is limited to spaces that share the same ecosystem root.',
    };
  }

  const composedDescription = [
    summary.trim(),
    '',
    `Recommended action: ${recommendedAction.trim()}`,
    '',
    `Why this is relevant for ${target.slug}: ${relevanceRationale.trim()}`,
    sourceAssetKeys && sourceAssetKeys.length > 0
      ? `Source memory asset keys: ${sourceAssetKeys.join(', ')}`
      : null,
    `Relayed from ecosystem space: ${source.slug}`,
  ]
    .filter(Boolean)
    .join('\n');

  const created = await createSignalInSpace(
    {
      host: target,
      creatorId: null,
      title,
      description: composedDescription,
      type,
      priority,
      tags,
    },
    { db },
  );

  const signalSlug = created.slug?.trim();
  if (!signalSlug) {
    return {
      ok: false as const,
      error: 'Signal was created but slug is missing.',
    };
  }

  return {
    ok: true as const,
    signalId: created.id,
    signalSlug,
    sourceSpaceSlug: source.slug,
    targetSpaceSlug: target.slug,
    creatorId: null,
    navigation: buildAiSignalNavigation({
      lang,
      spaceSlug: target.slug,
      signalSlug,
      signalTitle: title,
      roomId: created.roomId,
    }),
  };
}
