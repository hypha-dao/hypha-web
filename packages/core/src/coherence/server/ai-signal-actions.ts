import {
  spacePaymentTrackerAbi,
  spacePaymentTrackerAddress,
} from '../../generated';
import { getDb, web3Client } from '../../common/server';
import { findSelf } from '../../people/server/queries';
import { checkSpaceAccessForSpace, findSpaceBySlug } from '../../space/server';
import { getAllOrganizationSpacesForNodeById } from '../../space/server/web3';
import { CreateCoherenceInput } from '../types';
import { createCoherence } from './mutations';
import { DbConfig } from '../../server';

const PAYMENT_CHAIN_ID = 8453 as const;

export type SignalType =
  | 'Opportunity'
  | 'Risk'
  | 'Tension'
  | 'Insight'
  | 'Trend'
  | 'Proposal';
export type SignalPriority = 'critical' | 'high' | 'medium' | 'low';

export type PaymentEligibility = {
  eligible: boolean;
  hasSpacePaid: boolean;
  daysLeft: number;
  reason?: string;
};

type CreateAiSignalInput = {
  spaceSlug: string;
  authToken?: string;
  title: string;
  description: string;
  type: SignalType;
  priority: SignalPriority;
  tags?: string[];
};

type RelayAiSignalInput = {
  sourceSpaceSlug: string;
  targetSpaceSlug: string;
  authToken?: string;
  title: string;
  summary: string;
  recommendedAction: string;
  relevanceRationale: string;
  type: SignalType;
  priority: SignalPriority;
  tags?: string[];
  sourceAssetKeys?: string[];
};

const AI_SIGNAL_TAG = 'AI Signal';

function normalizeTags(tags: string[] | undefined): string[] {
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

export function toPaymentReason(
  status: PaymentEligibility,
): string | undefined {
  if (status.eligible) return undefined;
  if (!status.hasSpacePaid) {
    return 'AI signal actions are limited to active paid spaces.';
  }
  if (status.daysLeft <= 0) {
    return 'This space payment is expired. Reactivate it to enable AI signal actions.';
  }
  return status.reason ?? 'Space is not eligible for AI signal actions.';
}

export async function getSpacePaymentEligibility(
  web3SpaceId?: number | null,
): Promise<PaymentEligibility> {
  if (
    typeof web3SpaceId !== 'number' ||
    !Number.isFinite(web3SpaceId) ||
    !Number.isInteger(web3SpaceId) ||
    web3SpaceId <= 0
  ) {
    return {
      eligible: false,
      hasSpacePaid: false,
      daysLeft: 0,
      reason: 'Space has no valid positive integer web3 id for payment checks.',
    };
  }

  const contractAddress = spacePaymentTrackerAddress[PAYMENT_CHAIN_ID];
  const spaceId = BigInt(web3SpaceId);

  let hasSpacePaid: unknown;
  let payments: unknown;
  try {
    [hasSpacePaid, payments] = await Promise.all([
      web3Client.readContract({
        address: contractAddress,
        abi: spacePaymentTrackerAbi,
        functionName: 'hasSpacePaid',
        args: [spaceId],
      }),
      web3Client.readContract({
        address: contractAddress,
        abi: spacePaymentTrackerAbi,
        functionName: 'spacePayments',
        args: [spaceId],
      }),
    ]);
  } catch (error) {
    return {
      eligible: false,
      hasSpacePaid: false,
      daysLeft: 0,
      reason:
        error instanceof Error
          ? `rpc_error: ${error.message}`
          : 'rpc_error: unknown_error',
    };
  }

  const [expiryTime] = payments as readonly [bigint, boolean];
  const expiryMs = Number(expiryTime) * 1000;
  const daysLeft = Number.isFinite(expiryMs)
    ? Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    eligible: Boolean(hasSpacePaid) && daysLeft > 0,
    hasSpacePaid: Boolean(hasSpacePaid),
    daysLeft,
  };
}

export async function resolveSignalActorId(authToken: string | undefined) {
  if (!authToken) return null;
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  return self?.id ?? null;
}

async function createSignalInSpace(
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
    creatorId: number;
    title: string;
    description: string;
    type: SignalType;
    priority: SignalPriority;
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

export async function createAiSignalForSpaceBySlug(
  {
    spaceSlug,
    authToken,
    title,
    description,
    type,
    priority,
    tags,
  }: CreateAiSignalInput,
  { db }: DbConfig,
) {
  if (!authToken) {
    return { ok: false as const, error: 'authToken is required' };
  }

  const host = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!host) {
    return { ok: false as const, error: 'Space not found' };
  }

  const access = await checkSpaceAccessForSpace(host, authToken);
  if (!access.hasAccess) {
    return { ok: false as const, error: access.message };
  }

  const payment = await getSpacePaymentEligibility(host.web3SpaceId);
  const paymentReason = toPaymentReason(payment);
  if (paymentReason) {
    return { ok: false as const, error: paymentReason };
  }

  const actorId = await resolveSignalActorId(authToken);
  if (!actorId) {
    return {
      ok: false as const,
      error: 'Could not resolve authenticated user.',
    };
  }

  const created = await createSignalInSpace(
    {
      host,
      creatorId: actorId,
      title,
      description,
      type,
      priority,
      tags,
    },
    { db },
  );

  return {
    ok: true as const,
    signalId: created.id,
    signalSlug: created.slug,
    spaceSlug: host.slug,
    creatorId: actorId,
  };
}

export async function relayAiSignalToEcosystemSpace(
  {
    sourceSpaceSlug,
    targetSpaceSlug,
    authToken,
    title,
    summary,
    recommendedAction,
    relevanceRationale,
    type,
    priority,
    tags,
    sourceAssetKeys,
  }: RelayAiSignalInput,
  { db }: DbConfig,
) {
  if (!authToken) {
    return { ok: false as const, error: 'authToken is required' };
  }

  const [source, target] = await Promise.all([
    findSpaceBySlug({ slug: sourceSpaceSlug }, { db }),
    findSpaceBySlug({ slug: targetSpaceSlug }, { db }),
  ]);

  if (!source) return { ok: false as const, error: 'Source space not found' };
  if (!target) return { ok: false as const, error: 'Target space not found' };

  const [sourceAccess, targetAccess] = await Promise.all([
    checkSpaceAccessForSpace(source, authToken),
    checkSpaceAccessForSpace(target, authToken),
  ]);
  if (!sourceAccess.hasAccess) {
    return { ok: false as const, error: sourceAccess.message };
  }
  if (!targetAccess.hasAccess) {
    return { ok: false as const, error: targetAccess.message };
  }

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

  const actorId = await resolveSignalActorId(authToken);
  if (!actorId) {
    return {
      ok: false as const,
      error: 'Could not resolve authenticated user.',
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
      creatorId: actorId,
      title,
      description: composedDescription,
      type,
      priority,
      tags,
    },
    { db },
  );

  return {
    ok: true as const,
    signalId: created.id,
    signalSlug: created.slug,
    sourceSpaceSlug: source.slug,
    targetSpaceSlug: target.slug,
    creatorId: actorId,
  };
}
