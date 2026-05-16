import 'server-only';

import { and, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import {
  signalOrchestratorCooldowns,
  signalOrchestratorDispatches,
  signalOrchestratorQueue,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../server';
import { COHERENCE_TAGS } from '../coherence-tags';
import type { OrgMemoryAsset } from '../../governance/server/get-org-memory-by-space-slug';
import { getOrgMemoryBySpaceSlug } from '../../governance/server/get-org-memory-by-space-slug';
import { findAllCoherences } from './queries';
import {
  findAllOrganizationSpacesForNodeById,
  findSpaceById,
  findSpaceBySlug,
} from '../../space/server/queries';
import {
  createAiSignalForSpaceBySlug,
  getSpacePaymentEligibility,
  relayAiSignalToEcosystemSpace,
  toPaymentReason,
  type SignalPriority,
  type SignalType,
} from './ai-signal-actions';

function parseEnvNumber(
  value: string | undefined,
  fallback: number,
  options?: { int?: boolean },
): number {
  const raw = Number(value ?? '');
  if (!Number.isFinite(raw)) return fallback;
  if (options?.int) return Math.trunc(raw);
  return raw;
}

const WINDOW_MINUTES = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_WINDOW_MINUTES,
  20,
  { int: true },
);
const MAX_ATTEMPTS = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_MAX_ATTEMPTS,
  5,
  { int: true },
);
const MIN_RELEVANCE = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_MIN_RELEVANCE,
  68,
);
const MIN_CONFIDENCE = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_MIN_CONFIDENCE,
  66,
);
const MIN_NOVELTY = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_MIN_NOVELTY,
  45,
);
const RELAY_MIN_RELEVANCE = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_RELAY_MIN_RELEVANCE,
  78,
);
const RELAY_MIN_CONFIDENCE = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_RELAY_MIN_CONFIDENCE,
  76,
);
const DAILY_SPACE_LIMIT = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_SPACE_DAILY_LIMIT,
  3,
  { int: true },
);
const DAILY_RELAY_LIMIT = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_RELAY_DAILY_LIMIT,
  2,
  { int: true },
);
const TAG_COOLDOWN_HOURS = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_TAG_COOLDOWN_HOURS,
  18,
);
const SPACE_COOLDOWN_HOURS = parseEnvNumber(
  process.env.HYPHA_SIGNAL_ORCHESTRATOR_SPACE_COOLDOWN_HOURS,
  6,
);

const SOURCE_TO_TAGS: Record<string, string[]> = {
  call_recording: ['Learning', 'Knowledge'],
  call_transcript: ['Learning', 'Feedback Loop', 'Knowledge'],
  discussion_summary: ['Feedback Loop', 'Processes', 'Rhythms'],
  matrix_chat: ['Feedback Loop', 'Communities'],
  proposal_upload: ['Strategy', 'Milestones', 'Governance'],
};

type EnqueueInput = {
  spaceSlug: string;
  triggerKind:
    | 'memory_ingest'
    | 'discussion_summary'
    | 'ops_refresh'
    | 'manual'
    | 'unknown';
  sourceAssetKeys?: string[];
  metadata?: Record<string, unknown>;
};

type ProcessBatchInput = {
  limit?: number;
  authToken?: string;
  requestUrlForSessionMatrix?: string;
  dryRun?: boolean;
};

type Candidate = {
  type: SignalType;
  priority: SignalPriority;
  title: string;
  description: string;
  summary: string;
  tags: string[];
  relevance: number;
  novelty: number;
  actionability: number;
  confidence: number;
  rationale: string;
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function words(value: string | null | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let c = 0;
  for (const x of a) if (b.has(x)) c += 1;
  return c / Math.max(1, Math.min(a.size, b.size));
}

function summarizeSources(assets: OrgMemoryAsset[]) {
  const map = new Map<string, number>();
  for (const a of assets) map.set(a.source, (map.get(a.source) ?? 0) + 1);
  return [...map.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

function inferTags(assets: OrgMemoryAsset[], existingTags: string[]) {
  const fromSources = assets.flatMap((a) => SOURCE_TO_TAGS[a.source] ?? []);
  const merged = [...fromSources, ...existingTags].filter((tag, idx, arr) => {
    if (!COHERENCE_TAGS.includes(tag as (typeof COHERENCE_TAGS)[number]))
      return false;
    return arr.indexOf(tag) === idx;
  });
  return merged.slice(0, 5);
}

function buildCandidate({
  spaceTitle,
  spacePurpose,
  assets,
  existingTitles,
  existingTags,
  eventCount,
}: {
  spaceTitle: string;
  spacePurpose: string | null;
  assets: OrgMemoryAsset[];
  existingTitles: string[];
  existingTags: string[];
  eventCount: number;
}): Candidate {
  const sourceSummary = summarizeSources(assets);
  const top = sourceSummary.slice(0, 3);
  const relevance = clampScore(
    35 +
      Math.min(30, assets.length * 3) +
      Math.min(25, eventCount * 5) +
      (top.length >= 2 ? 10 : top.length === 1 ? 5 : 0) +
      (spacePurpose?.trim() ? 10 : 0),
  );
  const title = `${spaceTitle}: high-signal ${(
    top[0]?.source ?? 'activity'
  ).replace(/_/g, ' ')} update`;
  const titleSet = words(title);
  const novelty = clampScore(
    100 -
      existingTitles.reduce(
        (max, existing) => Math.max(max, overlap(titleSet, words(existing))),
        0,
      ) *
        100,
  );
  const actionability = clampScore(
    45 +
      (top.some((s) => s.source === 'discussion_summary') ? 20 : 0) +
      (top.some((s) => s.source === 'proposal_upload') ? 18 : 0) +
      (top.some((s) => s.source === 'call_transcript') ? 15 : 0),
  );
  const confidence = clampScore(
    relevance * 0.4 + novelty * 0.3 + actionability * 0.3,
  );
  const type: SignalType = top.some((s) => s.source === 'proposal_upload')
    ? 'Proposal'
    : top.some((s) => s.source === 'matrix_chat')
    ? 'Opportunity'
    : 'Insight';
  const priority: SignalPriority =
    relevance >= 85 && confidence >= 82
      ? 'high'
      : relevance >= 76 && confidence >= 72
      ? 'medium'
      : 'low';
  const tags = inferTags(assets, existingTags);
  const summary =
    top.length > 0
      ? top.map((s) => `${s.source.replace(/_/g, ' ')}:${s.count}`).join(', ')
      : 'limited activity';
  const description = [
    'Recent space-memory activity indicates a coordination opportunity.',
    `Observed signals: ${summary}.`,
    spacePurpose?.trim()
      ? `Purpose alignment: this supports "${spacePurpose.trim()}".`
      : 'Purpose alignment should be confirmed explicitly in next team check-in.',
    'Proposed next step: run a focused discussion to convert this activity into one concrete decision and owner.',
  ].join('\n');
  return {
    type,
    priority,
    title,
    description,
    summary,
    tags,
    relevance,
    novelty,
    actionability,
    confidence,
    rationale: `relevance=${relevance}, novelty=${novelty}, actionability=${actionability}, confidence=${confidence}`,
  };
}

async function recentDispatchCount({
  spaceId,
  mode,
  db,
}: {
  spaceId: number;
  mode: 'space' | 'relay';
  db: DbConfig['db'];
}) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(signalOrchestratorDispatches)
    .where(
      and(
        eq(signalOrchestratorDispatches.sourceSpaceId, spaceId),
        eq(signalOrchestratorDispatches.mode, mode),
        eq(signalOrchestratorDispatches.decision, 'emitted'),
        gte(signalOrchestratorDispatches.createdAt, since),
      ),
    );
  return Number(row?.count ?? 0);
}

async function activeCooldowns(
  spaceId: number,
  keys: string[],
  { db }: DbConfig,
) {
  if (keys.length === 0) return new Set<string>();
  const rows = await db
    .select({ key: signalOrchestratorCooldowns.key })
    .from(signalOrchestratorCooldowns)
    .where(
      and(
        eq(signalOrchestratorCooldowns.spaceId, spaceId),
        inArray(signalOrchestratorCooldowns.key, keys),
        gt(signalOrchestratorCooldowns.cooldownUntil, new Date()),
      ),
    );
  return new Set(rows.map((r) => r.key));
}

async function saveCooldowns(
  spaceId: number,
  keys: string[],
  reason: string,
  hours: number,
  { db }: DbConfig,
) {
  const until = new Date(Date.now() + hours * 60 * 60 * 1000);
  for (const key of keys) {
    await db
      .insert(signalOrchestratorCooldowns)
      .values({ spaceId, key, cooldownUntil: until, reason })
      .onConflictDoUpdate({
        target: [
          signalOrchestratorCooldowns.spaceId,
          signalOrchestratorCooldowns.key,
        ],
        set: { cooldownUntil: until, reason, updatedAt: new Date() },
      });
  }
}

async function saveDispatch(
  {
    queueId,
    sourceSpaceId,
    candidate,
    mode,
    decision,
    rationale,
    targetSpaceId,
    emittedSignalId,
    metadata,
  }: {
    queueId: number;
    sourceSpaceId: number;
    candidate: Candidate;
    mode: 'space' | 'relay';
    decision: 'emitted' | 'suppressed' | 'error' | 'discarded';
    rationale: string;
    targetSpaceId?: number;
    emittedSignalId?: number;
    metadata?: Record<string, unknown>;
  },
  { db }: DbConfig,
) {
  await db.insert(signalOrchestratorDispatches).values({
    queueId,
    sourceSpaceId,
    targetSpaceId: targetSpaceId ?? null,
    emittedSignalId: emittedSignalId ?? null,
    mode,
    decision,
    relevanceScore: candidate.relevance,
    noveltyScore: candidate.novelty,
    actionabilityScore: candidate.actionability,
    confidenceScore: candidate.confidence,
    rationale,
    tags: candidate.tags,
    metadata: metadata ?? {},
  });
}

export async function enqueueSignalEvaluationFromMemory(
  input: EnqueueInput,
  { db }: DbConfig,
) {
  const slug = input.spaceSlug.trim();
  if (!slug) return { ok: false as const, error: 'spaceSlug is required' };
  const host = await findSpaceBySlug({ slug }, { db });
  if (!host) return { ok: false as const, error: 'Space not found' };
  const dueAt = new Date(Date.now() + Math.max(5, WINDOW_MINUTES) * 60 * 1000);

  const payload: Record<string, unknown> = {
    trigger_kind: input.triggerKind,
    source_asset_keys: input.sourceAssetKeys ?? [],
    metadata: input.metadata ?? {},
  };
  return db.transaction(async (tx) => {
    // Serialize enqueue per space to avoid duplicate pending rows under contention.
    await tx.execute(sql`select pg_advisory_xact_lock(${host.id})`);

    const pending = await tx.query.signalOrchestratorQueue.findFirst({
      where: (q, { and, eq }) =>
        and(eq(q.spaceId, host.id), eq(q.state, 'pending')),
    });

    if (pending) {
      const prevKeys = Array.isArray(pending.payload?.source_asset_keys)
        ? (pending.payload.source_asset_keys as string[])
        : [];
      await tx
        .update(signalOrchestratorQueue)
        .set({
          eventCount: pending.eventCount + 1,
          dueAt,
          triggerKind: input.triggerKind,
          payload: {
            ...pending.payload,
            ...payload,
            source_asset_keys: Array.from(
              new Set([...(input.sourceAssetKeys ?? []), ...prevKeys]),
            ).slice(0, 30),
          },
          updatedAt: new Date(),
        })
        .where(eq(signalOrchestratorQueue.id, pending.id));
      return { ok: true as const, queueId: pending.id, deduped: true };
    }

    const [inserted] = await tx
      .insert(signalOrchestratorQueue)
      .values({
        spaceId: host.id,
        state: 'pending',
        triggerKind: input.triggerKind,
        eventCount: 1,
        dueAt,
        payload,
      })
      .returning();
    return {
      ok: true as const,
      queueId: inserted?.id ?? null,
      deduped: false,
    };
  });
}

export async function processSignalOrchestratorBatch(
  {
    limit = 20,
    authToken,
    requestUrlForSessionMatrix,
    dryRun = false,
  }: ProcessBatchInput,
  { db }: DbConfig,
) {
  const rows = await db
    .select()
    .from(signalOrchestratorQueue)
    .where(
      and(
        eq(signalOrchestratorQueue.state, 'pending'),
        lte(signalOrchestratorQueue.dueAt, new Date()),
      ),
    )
    .orderBy(signalOrchestratorQueue.dueAt)
    .limit(Math.max(1, Math.min(100, limit)));

  const systemAuthToken =
    authToken?.trim() ||
    process.env.HYPHA_SIGNAL_ORCHESTRATOR_AUTH_TOKEN?.trim() ||
    process.env.HYPHA_MCP_AUTH_TOKEN?.trim();
  const results: Array<{ queue_id: number; status: string; message: string }> =
    [];

  for (const row of rows) {
    const [lock] = await db
      .update(signalOrchestratorQueue)
      .set({
        state: 'processing',
        attempts: row.attempts + 1,
        processingStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(signalOrchestratorQueue.id, row.id),
          eq(signalOrchestratorQueue.state, 'pending'),
        ),
      )
      .returning();
    if (!lock) continue;

    try {
      if (lock.attempts > MAX_ATTEMPTS) {
        await db
          .update(signalOrchestratorQueue)
          .set({
            state: 'discarded',
            lastError: 'Max attempts exceeded',
            updatedAt: new Date(),
          })
          .where(eq(signalOrchestratorQueue.id, lock.id));
        results.push({
          queue_id: lock.id,
          status: 'discarded',
          message: 'Max attempts exceeded',
        });
        continue;
      }

      const host = await findSpaceById({ id: lock.spaceId }, { db });
      if (!host) {
        await db
          .update(signalOrchestratorQueue)
          .set({
            state: 'discarded',
            lastError: 'Space no longer exists',
            updatedAt: new Date(),
          })
          .where(eq(signalOrchestratorQueue.id, lock.id));
        results.push({
          queue_id: lock.id,
          status: 'discarded',
          message: 'Space no longer exists',
        });
        continue;
      }

      const payment = await getSpacePaymentEligibility(host.web3SpaceId);
      const paymentReason = toPaymentReason(payment);
      if (paymentReason) {
        await db
          .update(signalOrchestratorQueue)
          .set({
            state: 'discarded',
            lastError: paymentReason,
            updatedAt: new Date(),
          })
          .where(eq(signalOrchestratorQueue.id, lock.id));
        results.push({
          queue_id: lock.id,
          status: 'discarded',
          message: paymentReason,
        });
        continue;
      }

      const [orgMemory, existingSignals] = await Promise.all([
        getOrgMemoryBySpaceSlug(
          {
            spaceSlug: host.slug,
            assetsPage: 1,
            assetsPageSize: 40,
            requestUrlForSessionMatrix,
          },
          { db, authToken: systemAuthToken },
        ),
        findAllCoherences(
          { db },
          { spaceId: host.id, includeArchived: false, orderBy: 'mostrecent' },
        ),
      ]);

      if (orgMemory.access === 'denied' || !orgMemory.result.found) {
        const msg =
          orgMemory.access === 'denied'
            ? orgMemory.message
            : 'Org memory unavailable';
        await db
          .update(signalOrchestratorQueue)
          .set({ state: 'failed', lastError: msg, updatedAt: new Date() })
          .where(eq(signalOrchestratorQueue.id, lock.id));
        results.push({ queue_id: lock.id, status: 'error', message: msg });
        continue;
      }

      const candidate = buildCandidate({
        spaceTitle: host.title,
        spacePurpose: host.description ?? null,
        assets: orgMemory.result.org_memory_assets,
        existingTitles: existingSignals.map((s) => s.title),
        existingTags: existingSignals.flatMap((s) => s.tags ?? []),
        eventCount: lock.eventCount,
      });

      const recentSpaceSignals = await recentDispatchCount({
        spaceId: host.id,
        mode: 'space',
        db,
      });
      const cooldownSet = await activeCooldowns(
        host.id,
        [`space:${host.id}`, ...candidate.tags.map((tag) => `tag:${tag}`)],
        { db },
      );
      const suppress =
        candidate.relevance < MIN_RELEVANCE ||
        candidate.confidence < MIN_CONFIDENCE ||
        candidate.novelty < MIN_NOVELTY ||
        recentSpaceSignals >= DAILY_SPACE_LIMIT ||
        cooldownSet.size > 0;

      if (suppress || dryRun) {
        await saveDispatch(
          {
            queueId: lock.id,
            sourceSpaceId: host.id,
            candidate,
            mode: 'space',
            decision: 'suppressed',
            rationale: `${candidate.rationale}${dryRun ? ' | dry_run' : ''}`,
            metadata: {
              dry_run: dryRun,
              active_cooldowns: [...cooldownSet],
              recent_space_signals: recentSpaceSignals,
            },
          },
          { db },
        );
        await db
          .update(signalOrchestratorQueue)
          .set({ state: 'done', lastError: null, updatedAt: new Date() })
          .where(eq(signalOrchestratorQueue.id, lock.id));
        results.push({
          queue_id: lock.id,
          status: 'suppressed',
          message: dryRun
            ? 'Dry run evaluation only'
            : 'Suppressed by guardrails',
        });
        continue;
      }

      const local = await createAiSignalForSpaceBySlug(
        {
          spaceSlug: host.slug,
          authToken: systemAuthToken,
          title: candidate.title,
          description: candidate.description,
          type: candidate.type,
          priority: candidate.priority,
          tags: candidate.tags,
        },
        { db },
      );
      if (!local.ok) {
        await saveDispatch(
          {
            queueId: lock.id,
            sourceSpaceId: host.id,
            candidate,
            mode: 'space',
            decision: 'error',
            rationale: local.error,
          },
          { db },
        );
        await db
          .update(signalOrchestratorQueue)
          .set({
            state: 'failed',
            lastError: local.error,
            updatedAt: new Date(),
          })
          .where(eq(signalOrchestratorQueue.id, lock.id));
        results.push({
          queue_id: lock.id,
          status: 'error',
          message: local.error,
        });
        continue;
      }

      await saveDispatch(
        {
          queueId: lock.id,
          sourceSpaceId: host.id,
          emittedSignalId: local.signalId,
          candidate,
          mode: 'space',
          decision: 'emitted',
          rationale: candidate.rationale,
        },
        { db },
      );
      await saveCooldowns(
        host.id,
        [`space:${host.id}`],
        'space_signal_emitted',
        SPACE_COOLDOWN_HOURS,
        { db },
      );
      await saveCooldowns(
        host.id,
        candidate.tags.map((tag) => `tag:${tag}`),
        'tag_signal_emitted',
        TAG_COOLDOWN_HOURS,
        { db },
      );

      let relayMessage = 'local signal emitted';
      if (
        candidate.confidence >= RELAY_MIN_CONFIDENCE &&
        candidate.relevance >= RELAY_MIN_RELEVANCE
      ) {
        const recentRelaySignals = await recentDispatchCount({
          spaceId: host.id,
          mode: 'relay',
          db,
        });
        if (recentRelaySignals < DAILY_RELAY_LIMIT) {
          const ecosystem = await findAllOrganizationSpacesForNodeById(
            { id: host.id },
            { db },
          );
          const targets = ecosystem
            .filter(
              (s) =>
                s.id !== host.id &&
                !s.flags?.includes('archived') &&
                Boolean(s.slug),
            )
            .map((s) => ({
              id: s.id,
              slug: s.slug,
              title: s.title,
              description: s.description,
            }));
          const sourceWords = words(`${host.title} ${host.description ?? ''}`);
          const best = targets
            .map((t) => ({
              ...t,
              relevance: clampScore(
                overlap(
                  sourceWords,
                  words(`${t.title} ${t.description ?? ''}`),
                ) * 100,
              ),
            }))
            .sort((a, b) => b.relevance - a.relevance)[0];

          if (best && best.relevance >= 52) {
            const relay = await relayAiSignalToEcosystemSpace(
              {
                sourceSpaceSlug: host.slug,
                targetSpaceSlug: best.slug,
                authToken: systemAuthToken,
                title: `${host.title} -> ${best.title}: relevant signal`,
                summary: `Local signal summary: ${candidate.summary}.`,
                recommendedAction:
                  'Review this signal in next coordination cycle and decide if shared workstream alignment is required.',
                relevanceRationale: `Target overlap relevance score ${best.relevance}/100 from purpose-language alignment and ecosystem adjacency.`,
                type: candidate.type,
                priority: candidate.priority,
                tags: candidate.tags,
                sourceAssetKeys:
                  (lock.payload?.source_asset_keys as string[] | undefined) ??
                  [],
              },
              { db },
            );

            await saveDispatch(
              {
                queueId: lock.id,
                sourceSpaceId: host.id,
                targetSpaceId: best.id,
                emittedSignalId: relay.ok ? relay.signalId : undefined,
                candidate,
                mode: 'relay',
                decision: relay.ok ? 'emitted' : 'suppressed',
                rationale: relay.ok
                  ? `relay_score=${best.relevance}`
                  : relay.error ?? 'relay suppressed',
              },
              { db },
            );
            if (relay.ok) relayMessage = `relay emitted to ${best.slug}`;
          }
        }
      }

      await db
        .update(signalOrchestratorQueue)
        .set({ state: 'done', lastError: null, updatedAt: new Date() })
        .where(eq(signalOrchestratorQueue.id, lock.id));
      results.push({
        queue_id: lock.id,
        status: relayMessage.startsWith('relay') ? 'relay_emitted' : 'emitted',
        message: relayMessage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(signalOrchestratorQueue)
        .set({ state: 'failed', lastError: message, updatedAt: new Date() })
        .where(eq(signalOrchestratorQueue.id, lock.id));
      results.push({ queue_id: lock.id, status: 'error', message });
    }
  }

  return {
    ok: true as const,
    scanned: rows.length,
    processed: results.length,
    results,
  };
}

export async function getSignalOrchestratorMetrics({ db }: DbConfig) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [pending, failed, emitted, relays] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(signalOrchestratorQueue)
      .where(eq(signalOrchestratorQueue.state, 'pending')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(signalOrchestratorQueue)
      .where(eq(signalOrchestratorQueue.state, 'failed')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(signalOrchestratorDispatches)
      .where(
        and(
          eq(signalOrchestratorDispatches.mode, 'space'),
          eq(signalOrchestratorDispatches.decision, 'emitted'),
          gte(signalOrchestratorDispatches.createdAt, since24h),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(signalOrchestratorDispatches)
      .where(
        and(
          eq(signalOrchestratorDispatches.mode, 'relay'),
          eq(signalOrchestratorDispatches.decision, 'emitted'),
          gte(signalOrchestratorDispatches.createdAt, since24h),
        ),
      ),
  ]);

  const latestErrors = await db.query.signalOrchestratorQueue.findMany({
    where: (q, { and, eq, isNotNull }) =>
      and(eq(q.state, 'failed'), isNotNull(q.lastError)),
    orderBy: (q, { desc }) => [desc(q.updatedAt)],
    limit: 8,
  });

  return {
    queue_pending: Number(pending[0]?.count ?? 0),
    queue_failed: Number(failed[0]?.count ?? 0),
    signals_emitted_last_24h: Number(emitted[0]?.count ?? 0),
    relays_emitted_last_24h: Number(relays[0]?.count ?? 0),
    latest_errors: latestErrors.map((row) => ({
      queue_id: row.id,
      space_id: row.spaceId,
      error: row.lastError,
      updated_at: row.updatedAt.toISOString(),
    })),
  };
}
