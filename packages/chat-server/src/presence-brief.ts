import 'server-only';

import {
  resolveMemberCaller,
  readNetworkOffer,
} from '@hypha-platform/core/server';
import {
  formatEcosystemLines,
  formatSignedInMemberLine,
  readEcosystemRows,
} from './presence-brief-format';
import { sanitizeSlug } from './system-prompt';
import { createGetEcosystemBySpaceSlugTool } from './tools/get-ecosystem-by-space-slug';
import { getSpaceBySlugTool } from './tools/get-space-by-slug';

export { formatEcosystemLines, formatSignedInMemberLine };

async function loadMemberLine(authToken: string): Promise<string | null> {
  try {
    const caller = await resolveMemberCaller(authToken);
    if (!caller?.person) return null;
    const networkOffer = await readNetworkOffer(caller.db, caller.person.id);
    return formatSignedInMemberLine({
      ...caller.person,
      networkOffer: networkOffer ?? null,
    });
  } catch {
    return null;
  }
}

export async function loadSignedInMemberBrief(
  authToken: string,
): Promise<string | null> {
  return loadMemberLine(authToken);
}

async function loadEcosystemLines(
  authToken: string,
  spaceSlug: string,
): Promise<string | null> {
  try {
    const ecosystemTool = createGetEcosystemBySpaceSlugTool(authToken);
    const result = await ecosystemTool.execute({
      space_slug: spaceSlug,
      include_archived: false,
    });
    const parsed = readEcosystemRows(result);
    if (!parsed) return null;
    return formatEcosystemLines(parsed);
  } catch {
    return null;
  }
}

/**
 * Records for the active space: who is signed in, what this space is, and
 * how the organisation around it sits. A failed read omits that part.
 */
export async function buildSpaceContextSnapshot(
  spaceSlug: string,
  clientTitle?: string | null,
  authToken?: string | null,
): Promise<string | null> {
  const safe = sanitizeSlug(spaceSlug);
  if (!safe) return null;

  const token = authToken?.trim() || '';
  const [memberLine, ecosystemLines] = token
    ? await Promise.all([
        loadMemberLine(token),
        loadEcosystemLines(token, safe),
      ])
    : [null, null];

  try {
    const result = await getSpaceBySlugTool.execute({ slug: safe });
    if (
      !result ||
      typeof result !== 'object' ||
      !('found' in result) ||
      result.found !== true ||
      !('space' in result) ||
      !result.space ||
      typeof result.space !== 'object'
    ) {
      const fallback = [memberLine, ecosystemLines].filter(Boolean);
      return fallback.length > 0 ? fallback.join('\n') : null;
    }

    const space = result.space as {
      title?: string;
      description?: string | null;
      memberCount?: number;
      documentCount?: number;
    };
    const title = typeof space.title === 'string' ? space.title : safe;
    const description =
      typeof space.description === 'string' && space.description.trim()
        ? space.description.trim()
        : null;

    return [
      'CRITICAL — ACTIVE SPACE CONTEXT (this overrides any other space name from earlier chat turns):',
      `- Active space slug for tools: ${safe}`,
      `- Display name: ${title}`,
      ...(clientTitle && clientTitle !== title
        ? [`- Client-reported title: ${clientTitle}`]
        : []),
      ...(description ? [`- Purpose: ${description}`] : []),
      ...(typeof space.memberCount === 'number'
        ? [`- Members: ${space.memberCount}`]
        : []),
      ...(typeof space.documentCount === 'number'
        ? [`- Documents: ${space.documentCount}`]
        : []),
      ...(typeof (space as { activationMode?: string }).activationMode ===
      'string'
        ? [
            `- Activation mode: ${
              (space as { activationMode: string }).activationMode
            }`,
          ]
        : []),
      ...((
        space as { privacy?: { isAlreadyPrivate?: boolean; summary?: string } }
      ).privacy?.summary
        ? [
            `- Privacy: ${
              (space as { privacy: { summary: string } }).privacy.summary
            }`,
          ]
        : []),
      ...(memberLine ? [memberLine] : []),
      ...(ecosystemLines ? [ecosystemLines] : []),
      `- The user switched to this space via navigation, the space picker, or recently visited. Answer ONLY about this space unless they explicitly ask about another.`,
      `- For "which space am I in" / "where am I" questions: answer with "${title}" and call get_space_by_slug with slug "${safe}". Never name a different space from chat history.`,
      `- Privacy/transparency changes on existing spaces require create_space_setup_proposal (proposal_type space_transparency) and member vote — never claim updates via update_space_settings.`,
      '- You already have this member, this space, and its ecosystem. Use tools for a person, a signal, a document, or a balance this brief does not name. Do not ask them to introduce the space.',
    ].join('\n');
  } catch {
    const fallback = [memberLine, ecosystemLines].filter(Boolean);
    return fallback.length > 0 ? fallback.join('\n') : null;
  }
}
