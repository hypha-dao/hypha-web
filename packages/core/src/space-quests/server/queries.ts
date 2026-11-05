import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  documents,
  people,
  spaceQuestDeliverables,
  spaceQuestMembers,
  spaceQuestMilestones,
  spaceQuests,
  spaceQuestUpdates,
  type SpaceQuest,
  type SpaceQuestDeliverable,
  type SpaceQuestMember,
  type SpaceQuestMilestone,
  type SpaceQuestUpdate,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import {
  isQuestHealthState,
  isQuestMilestoneStatus,
  isQuestStatus,
  type QuestHealthState,
  type QuestStatus,
  type QuestUpdateKind,
} from '../constants';
import { bulletsToMarkdownList, stripViewerYouMarker } from '../markdown';
import type {
  QuestDeliverableRecord,
  QuestHealthSummary,
  QuestMemberRecord,
  QuestMilestoneRecord,
  QuestRecord,
  QuestUpdateRecord,
  SpaceQuestsOverview,
} from '../types';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function computeDaysToTarget(
  targetDate: string | null | undefined,
): number | null {
  if (!targetDate) return null;
  const trimmed = targetDate.trim();
  if (!trimmed || trimmed === '—') return null;
  const withYear = /\b20\d{2}\b/.test(trimmed)
    ? trimmed
    : `${trimmed}, ${new Date().getFullYear()}`;
  const parsed = new Date(withYear);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = parsed.getTime() - Date.now();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function mapMilestoneRow(row: SpaceQuestMilestone): QuestMilestoneRecord {
  return {
    id: row.id,
    questId: row.questId,
    order: row.order,
    name: row.name,
    description: row.description ?? '',
    dueDate: row.dueDate ?? null,
    ownerPersonId: row.ownerPersonId ?? null,
    ownerName: row.ownerName ?? null,
    status: isQuestMilestoneStatus(row.status) ? row.status : 'not_started',
  };
}

function mapMemberRow(
  row: SpaceQuestMember,
  leadPersonId: number | null,
  leadName: string,
): QuestMemberRecord {
  const cleanLead = stripViewerYouMarker(leadName).trim().toLowerCase();
  const cleanMember = stripViewerYouMarker(row.memberName).trim().toLowerCase();
  const isLead =
    (leadPersonId != null && row.personId === leadPersonId) ||
    row.roleLabel?.toLowerCase() === 'lead' ||
    Boolean(cleanLead && cleanMember === cleanLead);

  return {
    id: row.id,
    questId: row.questId,
    personId: row.personId ?? null,
    memberName: row.memberName,
    memberAvatarUrl: row.memberAvatarUrl ?? null,
    roleLabel: row.roleLabel ?? null,
    responsibilities: Array.isArray(row.responsibilities)
      ? row.responsibilities
      : [],
    order: row.order,
    isLead,
  };
}

function mapDeliverableRow(row: SpaceQuestDeliverable): QuestDeliverableRecord {
  return {
    id: row.id,
    questId: row.questId,
    name: row.name,
    url: row.url ?? null,
    note: row.note ?? null,
    order: row.order,
    updatedByPersonId: row.updatedByPersonId ?? null,
    updatedByName: row.updatedByName ?? null,
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function mapUpdateRow(row: SpaceQuestUpdate): QuestUpdateRecord {
  const kind: QuestUpdateKind =
    row.kind === 'edit_event' || row.kind === 'agent_post' ? row.kind : 'post';
  return {
    id: row.id,
    questId: row.questId,
    authorPersonId: row.authorPersonId ?? null,
    authorName: row.authorName,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
    kind,
    // Ship without MCP live: keep viaAgent false at ship unless explicitly stored
    viaAgent: false,
    milestoneOrder: row.milestoneOrder ?? null,
    milestoneLabel: row.milestoneLabel ?? null,
    text: row.text,
    links: Array.isArray(row.links) ? row.links : [],
    change: row.change ?? null,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function buildHealthSummary(
  row: SpaceQuest,
  updates: QuestUpdateRecord[],
  milestones: QuestMilestoneRecord[],
): QuestHealthSummary {
  const state: QuestHealthState = isQuestHealthState(row.healthState)
    ? row.healthState
    : 'on_track';
  const defaultMarker =
    state === 'on_track' ? 80 : state === 'at_risk' ? 48 : 18;
  const marker =
    typeof row.healthMarker === 'number' && Number.isFinite(row.healthMarker)
      ? Math.max(0, Math.min(100, row.healthMarker))
      : defaultMarker;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const updatesThisWeek = updates.filter(
    (u) => new Date(u.createdAt).getTime() >= weekAgo,
  ).length;
  const lastUpdateAt = updates[0]?.createdAt ?? null;
  const doneCount = milestones.filter((m) => m.status === 'done').length;

  const defaultSummary =
    row.healthSummary?.trim() ||
    (updates.length > 0
      ? `${doneCount} of ${
          milestones.length
        } milestones complete. ${updatesThisWeek} update${
          updatesThisWeek === 1 ? '' : 's'
        } posted this week.`
      : 'No updates posted yet. Post progress updates to keep Quest health current.');

  return {
    state,
    marker,
    summary: defaultSummary,
    updatesThisWeek,
    lastUpdateAt,
    generatedAt:
      toIso(row.healthUpdatedAt) ?? lastUpdateAt ?? toIso(row.updatedAt),
    daysToTarget: computeDaysToTarget(row.targetDate),
  };
}

function formatLatestUpdateLine(
  row: SpaceQuest,
  updates: QuestUpdateRecord[],
): string | null {
  const latest = updates[0];
  if (!latest) {
    if (row.status === 'proposed') {
      const leadFirst = (row.leadName || 'Lead').split(' ')[0];
      return `${leadFirst} · just now: proposed, waiting for votes`;
    }
    return null;
  }
  const firstAuthor = latest.authorName.split(' ')[0] || latest.authorName;
  return `${firstAuthor} · ${latest.text}`;
}

type HydratedQuestExtras = {
  spaceSlug: string;
  spaceTitle: string;
  leadAvatarUrl?: string | null;
  proposalSlug?: string | null;
  proposalWeb3Id?: number | null;
  proposalStatus?: 'accepted' | 'rejected' | 'onVoting' | null;
  milestones: SpaceQuestMilestone[];
  members: SpaceQuestMember[];
  deliverables: SpaceQuestDeliverable[];
  updates: SpaceQuestUpdate[];
};

export function assembleQuestRecord(
  row: SpaceQuest,
  extras: HydratedQuestExtras,
): QuestRecord {
  const status: QuestStatus = isQuestStatus(row.status) ? row.status : 'active';
  const leadName = row.leadName?.trim() || 'Quest Lead';
  const milestones = [...extras.milestones]
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map(mapMilestoneRow);
  const members = [...extras.members]
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map((m) => mapMemberRow(m, row.leadPersonId ?? null, leadName));
  const deliverables = [...extras.deliverables]
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map(mapDeliverableRow);
  const updates = [...extras.updates]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        b.id - a.id,
    )
    .map(mapUpdateRow);

  const scopeIn = Array.isArray(row.scopeIn) ? row.scopeIn : [];
  const scopeOut = Array.isArray(row.scopeOut) ? row.scopeOut : [];
  const scopeInMarkdown =
    row.scopeInMarkdown?.trim() || bulletsToMarkdownList(scopeIn);
  const scopeOutMarkdown =
    row.scopeOutMarkdown?.trim() || bulletsToMarkdownList(scopeOut);
  const health = buildHealthSummary(row, updates, milestones);
  const latestUpdateAt =
    updates[0]?.createdAt ??
    toIso(row.updatedAt) ??
    toIso(row.createdAt) ??
    new Date().toISOString();

  return {
    id: row.id,
    spaceId: row.spaceId,
    spaceSlug: extras.spaceSlug,
    spaceTitle: extras.spaceTitle,
    slug: row.slug,
    name: row.name,
    goal: row.goal ?? '',
    scopeIn,
    scopeOut,
    scopeInMarkdown,
    scopeOutMarkdown,
    successCriteria: row.successCriteria ?? '',
    rewards: Array.isArray(row.rewards) ? row.rewards : [],
    status,
    targetDate: row.targetDate ?? null,
    leadPersonId: row.leadPersonId ?? null,
    leadName,
    leadAvatarUrl: extras.leadAvatarUrl ?? null,
    creatorPersonId: row.creatorPersonId ?? null,
    proposalDocumentId: row.proposalDocumentId ?? null,
    proposalSlug: extras.proposalSlug ?? null,
    proposalWeb3Id: extras.proposalWeb3Id ?? null,
    proposalStatus: extras.proposalStatus ?? null,
    acceptedAt: toIso(row.acceptedAt),
    chatRoomId: row.chatRoomId ?? null,
    health,
    stewardHealthSummaries: row.stewardHealthSummaries ?? true,
    memberUpdateAlerts: row.memberUpdateAlerts ?? true,
    milestones,
    members,
    deliverables,
    updates,
    latestUpdateLine: formatLatestUpdateLine(row, updates),
    latestUpdateAt,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

/**
 * Sample Quests are QA fixtures. They must never be written in production:
 * only development, Vercel previews, or an explicit opt-in seed them, and
 * `HYPHA_SEED_SAMPLE_QUESTS=false` turns them off everywhere.
 */
function shouldSeedSampleQuests(): boolean {
  const flag = process.env.HYPHA_SEED_SAMPLE_QUESTS?.trim().toLowerCase();
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  if (process.env.VERCEL_ENV === 'production') return false;
  return (
    process.env.VERCEL_ENV === 'preview' ||
    process.env.NODE_ENV === 'development'
  );
}

/**
 * Seed default Quests matching the finalized Figma frames when a space has
 * no Quests yet, so visual and flow QA works out of the box.
 */
async function ensureSampleQuestsForSpace(
  spaceId: number,
  { db }: DbConfig,
): Promise<void> {
  if (!shouldSeedSampleQuests()) return;
  const existing = await db
    .select({ id: spaceQuests.id })
    .from(spaceQuests)
    .where(eq(spaceQuests.spaceId, spaceId))
    .limit(1);
  if (existing.length > 0) return;

  const now = Date.now();
  const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000);
  const d = (daysAgo: number) => new Date(now - daysAgo * 86_400_000);

  const [q1] = await db
    .insert(spaceQuests)
    .values({
      spaceId,
      slug: 'space-context-mvp',
      name: 'Space Context MVP',
      goal: 'Every Space has an 8-section, ratifiable Markdown context that humans and agents can read.',
      scopeIn: [
        'Markdown editor per section',
        'Specialist agent per section',
        'Ratify via Agreements',
        'Read-only endpoint',
      ],
      scopeOut: ['Cross-Space search', 'Version diffs UI (v2)'],
      scopeInMarkdown:
        '- Markdown editor per section\n- Specialist agent per section\n- Ratify via Agreements\n- Read-only endpoint',
      scopeOutMarkdown: '- Cross-Space search\n- Version diffs UI (v2)',
      successCriteria:
        '- 3 pilot spaces using context weekly\n- 80% of what-is-this-space-doing questions resolved from context',
      rewards: [
        { amount: '2,500', token: 'USDC' },
        { amount: '0.4', token: 'ETH' },
      ],
      status: 'active',
      targetDate: 'Nov 20, 2026',
      leadName: 'Anton V.',
      acceptedAt: d(3),
      healthState: 'on_track',
      healthMarker: 80,
      healthSummary:
        'M1 shipped on time. Updates this week cover the section editor (PR #2602 in review) and the specialist prompts. Watch-point: review on the read spec this week keeps the Nov 20 target on track.',
      healthUpdatedAt: h(2),
      stewardHealthSummaries: true,
      memberUpdateAlerts: true,
      updatedAt: h(2),
    })
    .returning();

  if (q1) {
    await db.insert(spaceQuestMilestones).values([
      {
        questId: q1.id,
        order: 1,
        name: 'Sections + editor',
        description:
          '- Schema for 8 Context sections\n- Markdown editor shipped and closed',
        dueDate: 'Nov 6',
        ownerName: 'Maria S.',
        status: 'done',
      },
      {
        questId: q1.id,
        order: 2,
        name: 'Specialist agents',
        description:
          'Specialist agents draft each Context section from space signals and prior agreements. Open: prompt pack for Roles + Treasury sections; PR updates posted to the Quest.',
        dueDate: 'Nov 13',
        ownerName: 'Vlad K.',
        status: 'in_progress',
      },
      {
        questId: q1.id,
        order: 3,
        name: 'Ratify + read',
        description:
          '- Ratify via Agreements\n- Read-only endpoint for space context',
        dueDate: 'Nov 20',
        ownerName: 'Anton V.',
        status: 'not_started',
      },
    ]);

    await db.insert(spaceQuestMembers).values([
      {
        questId: q1.id,
        memberName: 'Anton V.',
        roleLabel: 'Lead',
        responsibilities: [
          'Delivers the space context model + API (M1, Nov 6)',
          'Keeps the Quest scope and success metric current',
          'Owns final acceptance of each milestone',
        ],
        order: 1,
      },
      {
        questId: q1.id,
        memberName: 'Vlad K.',
        roleLabel: 'Design + build',
        responsibilities: [
          'Ships the Markdown section editor (PR #2602) to review-ready',
          'Ships the read-only endpoint with spec reviewed by Nov 12',
          'Posts updates from each merged PR to the Quest feed',
        ],
        order: 2,
      },
      {
        questId: q1.id,
        memberName: 'Maria S.',
        roleLabel: 'Specialist agents',
        responsibilities: [
          'Prompt pack for Roles + Treasury sections',
          'Section editor UX review',
        ],
        order: 3,
      },
      {
        questId: q1.id,
        memberName: 'Ben O.',
        roleLabel: 'Governance',
        responsibilities: [
          'Ratification proposal template',
          'Agreements vote flow verification',
        ],
        order: 4,
      },
    ]);

    await db.insert(spaceQuestDeliverables).values([
      {
        questId: q1.id,
        order: 1,
        name: 'Space Context editor (8 sections)',
        url: 'https://github.com/hypha-dao/hypha-web/pull/2602',
        note: 'Section editor + specialist drafts; in review',
        updatedByName: 'Vlad K.',
      },
      {
        questId: q1.id,
        order: 2,
        name: 'Context read spec',
        url: 'https://hypha.earth/docs/space-context',
        note: 'Read-only endpoint spec',
        updatedByName: 'Anton V.',
      },
      {
        questId: q1.id,
        order: 3,
        name: 'Ratified Context · Hypha Platform Space',
        url: null,
        note: 'First Space context passed via Agreements',
        updatedByName: 'Anton V.',
      },
    ]);

    await db.insert(spaceQuestUpdates).values([
      {
        questId: q1.id,
        authorName: 'Vlad K.',
        kind: 'post',
        viaAgent: false,
        milestoneOrder: 2,
        milestoneLabel: 'M2',
        text: 'Section editor PR opened.',
        links: [
          {
            label: 'PR #2602',
            url: 'https://github.com/hypha-dao/hypha-web/pull/2602',
            kind: 'pr',
          },
          {
            label: 'pr-2602.preview-app.hypha.earth',
            url: 'https://pr-2602.preview-app.hypha.earth',
            kind: 'preview',
          },
        ],
        createdAt: h(2),
        updatedAt: h(2),
      },
      {
        questId: q1.id,
        authorName: 'Vlad K.',
        kind: 'post',
        viaAgent: false,
        milestoneOrder: 2,
        milestoneLabel: 'M2',
        text: 'Fixed 2 tester bugs in specialist prompts.',
        links: [
          {
            label: 'PR #2598',
            url: 'https://github.com/hypha-dao/hypha-web/pull/2598',
            kind: 'pr',
          },
        ],
        createdAt: h(4),
        updatedAt: h(4),
      },
      {
        questId: q1.id,
        authorName: 'Anton V.',
        kind: 'post',
        viaAgent: false,
        milestoneOrder: 3,
        milestoneLabel: 'M3',
        text: 'Asked Vlad to review the read spec.',
        links: [],
        createdAt: h(5),
        updatedAt: h(5),
      },
      {
        questId: q1.id,
        authorName: 'Vlad K.',
        kind: 'post',
        viaAgent: false,
        milestoneOrder: 2,
        milestoneLabel: 'M2',
        text: 'Mobile layout fix merged.',
        links: [
          {
            label: 'PR #2591',
            url: 'https://github.com/hypha-dao/hypha-web/pull/2591',
            kind: 'pr',
          },
        ],
        createdAt: d(1),
        updatedAt: d(1),
      },
      {
        questId: q1.id,
        authorName: 'Anton V.',
        kind: 'post',
        viaAgent: false,
        milestoneOrder: 3,
        milestoneLabel: 'M3',
        text: 'Drafted read spec.',
        links: [
          {
            label: 'docs/context-read.md',
            url: 'https://hypha.earth/docs/context-read.md',
            kind: 'doc',
          },
        ],
        createdAt: d(1),
        updatedAt: d(1),
      },
      {
        questId: q1.id,
        authorName: 'Anton V.',
        kind: 'post',
        viaAgent: false,
        milestoneOrder: 1,
        milestoneLabel: 'M1',
        text: 'M1 done: sections + editor shipped.',
        links: [],
        createdAt: d(4),
        updatedAt: d(4),
      },
    ]);
  }

  const otherQuests = [
    {
      slug: 'agent-gateway',
      name: 'Agent gateway',
      goal: 'Let space stewards read Space Context & Quests cleanly',
      scopeIn: ['Auth spec', 'Space Context read', 'Quest status read'],
      scopeOut: ['External write webhooks'],
      rewards: [{ amount: '1,800', token: 'USDC' }],
      status: 'active',
      targetDate: 'Dec 5, 2026',
      leadName: 'Vlad K.',
      healthState: 'at_risk',
      healthMarker: 48,
      healthSummary: 'Auth spec waiting on review for 1 day.',
      milestones: [
        {
          name: 'Auth spec',
          dueDate: 'Nov 12',
          ownerName: 'Vlad K.',
          status: 'in_progress',
        },
        {
          name: 'Read endpoints',
          dueDate: 'Nov 24',
          ownerName: 'Vlad K.',
          status: 'not_started',
        },
        {
          name: 'Pilot verification',
          dueDate: 'Dec 5',
          ownerName: 'Anton V.',
          status: 'not_started',
        },
      ],
      update: {
        authorName: 'Vlad K.',
        text: 'auth spec waiting on review',
        createdAt: d(1),
      },
    },
    {
      slug: 'onboarding-matcher',
      name: 'Onboarding matcher',
      goal: 'Match new joiners to Spaces by context',
      scopeIn: [
        'Interest survey for new joiners',
        'Matching from Space Context',
        'Intro message to suggested Spaces',
      ],
      scopeOut: ['Paid placements', 'Cross-network search'],
      rewards: [
        { amount: '2,500', token: 'USDC' },
        { amount: '0.4', token: 'ETH' },
      ],
      status: 'active',
      targetDate: 'Jan 15, 2027',
      leadName: 'Maria L.',
      healthState: 'on_track',
      healthMarker: 82,
      healthSummary: 'Scoped v1 and aligned survey signals with Space Context.',
      milestones: [
        {
          name: 'Survey + data',
          dueDate: 'Nov 27',
          ownerName: 'Maria S.',
          status: 'in_progress',
        },
        {
          name: 'Matching v1',
          dueDate: 'Dec 18',
          ownerName: 'Vlad K.',
          status: 'not_started',
        },
        {
          name: 'Pilot with 50 joiners',
          dueDate: 'Jan 15',
          ownerName: 'Anton V.',
          status: 'not_started',
        },
      ],
      update: {
        authorName: 'Maria L.',
        text: 'scoped v1',
        createdAt: d(3),
      },
    },
    {
      slug: 'treasury-reporting',
      name: 'Treasury reporting',
      goal: 'Monthly treasury summary for members',
      scopeIn: ['Monthly inflow/outflow digest', 'Token holdings snapshot'],
      scopeOut: ['Tax filing exports'],
      rewards: [{ amount: '1,200', token: 'USDC' }],
      status: 'active',
      targetDate: 'Oct 31, 2026',
      leadName: 'Ben O.',
      healthState: 'off_track',
      healthMarker: 18,
      healthSummary: 'No update in 6 days on export.',
      milestones: [
        {
          name: 'Data model',
          dueDate: 'Oct 10',
          ownerName: 'Ben O.',
          status: 'done',
        },
        {
          name: 'Export format',
          dueDate: 'Oct 20',
          ownerName: 'Ben O.',
          status: 'in_progress',
        },
        {
          name: 'Member digest',
          dueDate: 'Oct 31',
          ownerName: 'Ben O.',
          status: 'not_started',
        },
      ],
      update: {
        authorName: 'Ben O.',
        text: 'no update in 6 days on export',
        createdAt: h(5),
      },
    },
    {
      slug: 'website-refresh',
      name: 'Website refresh',
      goal: 'New landing + docs IA',
      scopeIn: ['Landing hero refresh', 'Docs navigation tree'],
      scopeOut: ['Blog migration'],
      rewards: [{ amount: '1,500', token: 'USDC' }],
      status: 'proposed',
      targetDate: null,
      leadName: 'Sam R.',
      healthState: 'on_track',
      healthMarker: 85,
      healthSummary: 'Proposed, waiting for votes.',
      milestones: [],
      update: {
        authorName: 'Sam R.',
        text: 'proposed, waiting for votes',
        createdAt: h(1),
      },
    },
    {
      slug: 'q3-governance-audit',
      name: 'Q3 governance audit',
      goal: 'Review all agreements from Q3',
      scopeIn: ['Audit passed proposals', 'Publish summary report'],
      scopeOut: ['Smart contract upgrades'],
      rewards: [{ amount: '900', token: 'USDC' }],
      status: 'completed',
      targetDate: 'Sep 30, 2026',
      leadName: 'Anton V.',
      healthState: 'on_track',
      healthMarker: 95,
      healthSummary: 'All 3 milestones completed and final summary posted.',
      milestones: [
        {
          name: 'Collect Q3 proposals',
          dueDate: 'Sep 10',
          ownerName: 'Anton V.',
          status: 'done',
        },
        {
          name: 'Verify execution logs',
          dueDate: 'Sep 20',
          ownerName: 'Anton V.',
          status: 'done',
        },
        {
          name: 'Final summary report',
          dueDate: 'Sep 30',
          ownerName: 'Anton V.',
          status: 'done',
        },
      ],
      update: {
        authorName: 'Anton V.',
        text: 'final summary posted',
        createdAt: d(14),
      },
    },
  ];

  for (const item of otherQuests) {
    const [created] = await db
      .insert(spaceQuests)
      .values({
        spaceId,
        slug: item.slug,
        name: item.name,
        goal: item.goal,
        scopeIn: item.scopeIn,
        scopeOut: item.scopeOut,
        scopeInMarkdown: bulletsToMarkdownList(item.scopeIn),
        scopeOutMarkdown: bulletsToMarkdownList(item.scopeOut),
        successCriteria: '- Ship on target date\n- Verified by space members',
        rewards: item.rewards,
        status: item.status,
        targetDate: item.targetDate,
        leadName: item.leadName,
        healthState: item.healthState,
        healthMarker: item.healthMarker,
        healthSummary: item.healthSummary,
        healthUpdatedAt: item.update.createdAt,
        updatedAt: item.update.createdAt,
      })
      .returning();

    if (!created) continue;

    if (item.milestones.length > 0) {
      await db.insert(spaceQuestMilestones).values(
        item.milestones.map((m, idx) => ({
          questId: created.id,
          order: idx + 1,
          name: m.name,
          description: m.name,
          dueDate: m.dueDate,
          ownerName: m.ownerName,
          status: m.status,
        })),
      );
    }

    await db.insert(spaceQuestMembers).values([
      {
        questId: created.id,
        memberName: item.leadName,
        roleLabel: 'Lead',
        responsibilities: ['Overall delivery', 'Unblock reviews'],
        order: 1,
      },
    ]);

    await db.insert(spaceQuestUpdates).values([
      {
        questId: created.id,
        authorName: item.update.authorName,
        kind: 'post',
        viaAgent: false,
        milestoneOrder: 1,
        milestoneLabel: item.milestones.length > 0 ? 'M1' : null,
        text: item.update.text,
        links: [],
        createdAt: item.update.createdAt,
        updatedAt: item.update.createdAt,
      },
    ]);
  }
}

export async function listSpaceQuests(
  { spaceSlug }: { spaceSlug: string },
  { db }: DbConfig,
): Promise<SpaceQuestsOverview | null> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;

  await ensureSampleQuestsForSpace(space.id, { db });

  const rows = await db
    .select({
      quest: spaceQuests,
      proposalSlug: documents.slug,
      proposalWeb3Id: documents.web3ProposalId,
      leadAvatarUrl: people.avatarUrl,
    })
    .from(spaceQuests)
    .leftJoin(documents, eq(documents.id, spaceQuests.proposalDocumentId))
    .leftJoin(people, eq(people.id, spaceQuests.leadPersonId))
    .where(eq(spaceQuests.spaceId, space.id))
    .orderBy(desc(spaceQuests.updatedAt));

  const questIds = rows.map((r) => r.quest.id);
  const [milestoneRows, memberRows, deliverableRows, updateRows] =
    questIds.length === 0
      ? [[], [], [], []]
      : await Promise.all([
          db
            .select()
            .from(spaceQuestMilestones)
            .where(inArray(spaceQuestMilestones.questId, questIds))
            .orderBy(asc(spaceQuestMilestones.order)),
          db
            .select()
            .from(spaceQuestMembers)
            .where(inArray(spaceQuestMembers.questId, questIds))
            .orderBy(asc(spaceQuestMembers.order)),
          db
            .select()
            .from(spaceQuestDeliverables)
            .where(inArray(spaceQuestDeliverables.questId, questIds))
            .orderBy(asc(spaceQuestDeliverables.order)),
          db
            .select()
            .from(spaceQuestUpdates)
            .where(inArray(spaceQuestUpdates.questId, questIds))
            .orderBy(desc(spaceQuestUpdates.createdAt)),
        ]);

  const milestonesByQuest = new Map<number, SpaceQuestMilestone[]>();
  for (const row of milestoneRows) {
    const list = milestonesByQuest.get(row.questId) ?? [];
    list.push(row);
    milestonesByQuest.set(row.questId, list);
  }
  const membersByQuest = new Map<number, SpaceQuestMember[]>();
  for (const row of memberRows) {
    const list = membersByQuest.get(row.questId) ?? [];
    list.push(row);
    membersByQuest.set(row.questId, list);
  }
  const deliverablesByQuest = new Map<number, SpaceQuestDeliverable[]>();
  for (const row of deliverableRows) {
    const list = deliverablesByQuest.get(row.questId) ?? [];
    list.push(row);
    deliverablesByQuest.set(row.questId, list);
  }
  const updatesByQuest = new Map<number, SpaceQuestUpdate[]>();
  for (const row of updateRows) {
    const list = updatesByQuest.get(row.questId) ?? [];
    list.push(row);
    updatesByQuest.set(row.questId, list);
  }

  const quests = rows
    .map((r) =>
      assembleQuestRecord(r.quest, {
        spaceSlug: space.slug,
        spaceTitle: space.title,
        leadAvatarUrl: r.leadAvatarUrl,
        proposalSlug: r.proposalSlug,
        proposalWeb3Id: r.proposalWeb3Id,
        milestones: milestonesByQuest.get(r.quest.id) ?? [],
        members: membersByQuest.get(r.quest.id) ?? [],
        deliverables: deliverablesByQuest.get(r.quest.id) ?? [],
        updates: updatesByQuest.get(r.quest.id) ?? [],
      }),
    )
    .sort(
      (a, b) =>
        new Date(b.latestUpdateAt).getTime() -
        new Date(a.latestUpdateAt).getTime(),
    );

  const counts = {
    active: quests.filter((q) => q.status === 'active').length,
    proposed: quests.filter((q) => q.status === 'proposed').length,
    paused: quests.filter((q) => q.status === 'paused').length,
    completed: quests.filter((q) => q.status === 'completed').length,
    archived: quests.filter((q) => q.status === 'archived').length,
    total: quests.filter((q) => q.status !== 'archived').length,
  };

  return {
    spaceSlug: space.slug,
    spaceTitle: space.title,
    quests,
    counts,
  };
}

export async function getSpaceQuestBySlug(
  { spaceSlug, questSlug }: { spaceSlug: string; questSlug: string },
  { db }: DbConfig,
): Promise<QuestRecord | null> {
  const overview = await listSpaceQuests({ spaceSlug }, { db });
  if (!overview) return null;
  return overview.quests.find((q) => q.slug === questSlug) ?? null;
}

export async function findSpaceQuestByProposalDocumentId(
  { documentId }: { documentId: number },
  { db }: DbConfig,
): Promise<{ spaceSlug: string; questSlug: string } | null> {
  const [row] = await db
    .select({
      questSlug: spaceQuests.slug,
      spaceId: spaceQuests.spaceId,
    })
    .from(spaceQuests)
    .where(eq(spaceQuests.proposalDocumentId, documentId))
    .limit(1);
  if (!row) return null;
  const spaceRow = await db.query.spaces.findFirst({
    where: (s, { eq: eqOp }) => eqOp(s.id, row.spaceId),
  });
  if (!spaceRow) return null;
  return { spaceSlug: spaceRow.slug, questSlug: row.questSlug };
}
