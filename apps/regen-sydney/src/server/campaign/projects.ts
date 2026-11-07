import 'server-only';

import { asc, eq, sql } from 'drizzle-orm';
import {
  campaignProjects,
  campaignVotes,
  db,
  type CampaignProject,
} from '../db';

import type { CampaignProjectDto, ProjectGroup } from '@rs/lib/campaign-types';

import { clearVotesForProject } from './voting';

export function toProjectDto(project: CampaignProject): CampaignProjectDto {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    program: project.program,
    group: project.group,
    summary: project.summary,
    team: project.team,
    videoUrl: project.videoUrl,
    image: project.imageUrl,
    active: project.active,
    sortOrder: project.sortOrder,
    payoutAddress: project.payoutAddress,
  };
}

export async function listProjects(options: { includeHidden?: boolean } = {}) {
  const rows = options.includeHidden
    ? await db
        .select()
        .from(campaignProjects)
        .orderBy(asc(campaignProjects.sortOrder), asc(campaignProjects.id))
    : await db
        .select()
        .from(campaignProjects)
        .where(eq(campaignProjects.active, true))
        .orderBy(asc(campaignProjects.sortOrder), asc(campaignProjects.id));

  return rows.map(toProjectDto);
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `project-${Date.now()}`
  );
}

export type ProjectInput = {
  title: string;
  program?: string;
  group?: ProjectGroup;
  summary?: string;
  team?: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  payoutAddress?: string | null;
  payoutNote?: string | null;
};

export async function createProject(
  input: ProjectInput,
): Promise<CampaignProjectDto> {
  const [{ maxOrder } = { maxOrder: 0 }] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${campaignProjects.sortOrder}), 0)`,
    })
    .from(campaignProjects);

  let slug = slugify(input.title);
  const clash = await db.query.campaignProjects.findFirst({
    where: eq(campaignProjects.slug, slug),
  });
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const [created] = await db
    .insert(campaignProjects)
    .values({
      slug,
      title: input.title.trim(),
      program: input.program?.trim() || 'Regen Sydney',
      group: input.group ?? 'initiative',
      summary: input.summary?.trim() ?? '',
      team: input.team?.trim() ?? '',
      videoUrl: input.videoUrl?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      payoutAddress: input.payoutAddress?.trim() || null,
      payoutNote: input.payoutNote?.trim() || null,
      sortOrder: Number(maxOrder) + 1,
    })
    .returning();

  if (!created) throw new Error('Could not create the project');
  return toProjectDto(created);
}

export async function updateProject(
  id: number,
  patch: Partial<ProjectInput> & { active?: boolean; sortOrder?: number },
): Promise<CampaignProjectDto> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  const assign = <K extends keyof typeof patch>(key: K, column: string) => {
    const value = patch[key];
    if (value !== undefined) {
      values[column] = typeof value === 'string' ? value.trim() : value;
    }
  };

  assign('title', 'title');
  assign('program', 'program');
  assign('group', 'group');
  assign('summary', 'summary');
  assign('team', 'team');
  assign('videoUrl', 'videoUrl');
  assign('imageUrl', 'imageUrl');
  assign('payoutAddress', 'payoutAddress');
  assign('payoutNote', 'payoutNote');
  assign('active', 'active');
  assign('sortOrder', 'sortOrder');

  const [updated] = await db
    .update(campaignProjects)
    .set(values)
    .where(eq(campaignProjects.id, id))
    .returning();

  if (!updated) throw new Error('Project not found');
  return toProjectDto(updated);
}

/**
 * Hiding is the reversible option and keeps the project's history intact.
 * Deleting is only allowed while nothing has been voted for it, so a closed
 * round's worksheet can never lose the project it refers to.
 */
export async function deleteProject(id: number): Promise<void> {
  const [{ votes } = { votes: 0 }] = await db
    .select({ votes: sql<number>`count(*)` })
    .from(campaignVotes)
    .where(eq(campaignVotes.projectId, id));

  if (Number(votes) > 0) {
    await clearVotesForProject(id);
  }

  await db.delete(campaignProjects).where(eq(campaignProjects.id, id));
}
