import 'server-only';

import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import {
  authorizeSpacePanelInteraction,
  buildSpaceContextAgentPrompt,
  extractSharedSourceUrls,
  findSpaceBySlug,
  getSpaceContextSection,
  headingForSectionKey,
  patchSpaceContextSection,
  SPACE_CONTEXT_SPECIALISTS,
  type SpaceContextSectionKey,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getHyphaChatModel } from './stream-chat';
import { mentionAwaitingAgent, type AgentRoomLine } from './matrix-agent-turn';
import { createReadSpaceContextSourceTool } from './tools/read-space-context-source';

/** Reading a document and saving a draft takes several model steps. */
const CONTEXT_AGENT_WRITE_MS = 45_000;
const CONTEXT_AGENT_MAX_STEPS = 5;
const CONTEXT_AGENT_REPLY_MAX = 4000;

/** Members paste whole sections, so keep far more of the room than other agents do. */
export const CONTEXT_AGENT_TURN_LIMITS = {
  earlierLines: 30,
  earlierChars: 6000,
  questionChars: 12000,
};

function createSaveSectionDraftTool({
  authToken,
  spaceSlug,
  sectionKey,
  onSaved,
}: {
  authToken: string;
  spaceSlug: string;
  sectionKey: SpaceContextSectionKey;
  onSaved: () => void;
}) {
  return tool({
    description:
      'Save Markdown as the shared draft of this Context section. Members see it in the draft field and ratify it later through Agreements. Send the whole section, not a fragment.',
    inputSchema: z.object({
      markdown: z.string().trim().min(1).max(80_000),
    }),
    execute: async ({ markdown }) => {
      const auth = await authorizeSpacePanelInteraction({
        spaceSlug,
        authToken,
      });
      if (!auth.authorized) return { ok: false, error: auth.message };
      const current = await getSpaceContextSection(
        { spaceSlug, sectionKey },
        { db },
      );
      if (!current) return { ok: false, error: 'Section not found' };
      if (current.section.status === 'proposed') {
        return {
          ok: false,
          error:
            'The section is on voting. Drafts can be saved after the vote.',
        };
      }
      const saved = await patchSpaceContextSection(
        { spaceSlug, sectionKey, markdown, personId: auth.person.id },
        { db },
      );
      if (!saved) return { ok: false, error: 'Section not found' };
      onSaved();
      return { ok: true, status: saved.status, version: saved.version };
    },
  });
}

/**
 * Answer one @mention in a Context section room as that section's agent.
 * Returns null when the caller cannot use the section or the room is not the
 * section's discussion room.
 */
export async function writeSpaceContextAgentReply({
  roomId,
  authToken,
  spaceSlug,
  sectionKey,
  agentUserId,
  newestFirst,
}: {
  roomId: string;
  authToken: string;
  spaceSlug: string;
  sectionKey: SpaceContextSectionKey;
  agentUserId: string;
  newestFirst: AgentRoomLine[];
}): Promise<string | null> {
  const specialist = SPACE_CONTEXT_SPECIALISTS[sectionKey];
  const turn = mentionAwaitingAgent(newestFirst, agentUserId, {
    ...CONTEXT_AGENT_TURN_LIMITS,
    agentLabel: specialist.agentName,
  });
  if (!turn) return null;

  const auth = await authorizeSpacePanelInteraction({ spaceSlug, authToken });
  if (!auth.authorized) return null;

  const [space, detail] = await Promise.all([
    findSpaceBySlug({ slug: spaceSlug }, { db }),
    getSpaceContextSection({ spaceSlug, sectionKey }, { db }),
  ]);
  if (!space || !detail) return null;
  if (detail.section.chatRoomId !== roomId) return null;

  const memberTexts = newestFirst
    .filter((line) => line.sender !== agentUserId)
    .map((line) => line.body);
  let draftSaved = false;
  const tools = {
    save_section_draft: createSaveSectionDraftTool({
      authToken,
      spaceSlug,
      sectionKey,
      onSaved: () => {
        draftSaved = true;
      },
    }),
    read_space_context_source: createReadSpaceContextSourceTool(
      authToken,
      spaceSlug,
      extractSharedSourceUrls(memberTexts),
    ),
  };

  const system = buildSpaceContextAgentPrompt({
    sectionKey,
    spaceTitle: space.title?.trim() || spaceSlug,
    spaceSlug,
    currentMarkdown: detail.section.markdown,
    status: detail.section.status,
    specialistMemory: detail.specialistMemory?.memoryMarkdown ?? '',
  });
  const prompt = [
    turn.earlier
      ? `Earlier in the room (oldest first):\n${turn.earlier}`
      : 'No earlier messages.',
    `The message that mentioned you:\n${turn.question}`,
  ].join('\n\n');

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), CONTEXT_AGENT_WRITE_MS);
  try {
    const result = await generateText({
      model: getHyphaChatModel(),
      system,
      prompt,
      tools,
      stopWhen: stepCountIs(CONTEXT_AGENT_MAX_STEPS),
      abortSignal: abort.signal,
    });
    const text = result.text.trim().slice(0, CONTEXT_AGENT_REPLY_MAX);
    if (text) return text;
    return draftSaved
      ? `Draft saved to ${headingForSectionKey(sectionKey)}.`
      : null;
  } catch (error) {
    if (!draftSaved) throw error;
    return `Draft saved to ${headingForSectionKey(sectionKey)}.`;
  } finally {
    clearTimeout(timer);
  }
}
