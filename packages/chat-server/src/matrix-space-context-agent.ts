import 'server-only';

import { generateText, stepCountIs, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  authorizeSpacePanelInteraction,
  buildSpaceContextAgentPrompt,
  detectSpaceContextAgentIntent,
  extractSharedSourceUrls,
  findSpaceBySlug,
  getSpaceContextSection,
  saveSpaceContextSectionDraft,
  specialistForSectionKey,
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
      'Save Markdown as the working draft of this Context section, because the member asked to save it (or to propose it). The draft is not official: the ratified text changes only when an Agreements proposal passes. Send the whole section, not a fragment.',
    inputSchema: z.object({
      markdown: z.string().trim().min(1).max(80_000),
    }),
    execute: async ({ markdown }) => {
      const auth = await authorizeSpacePanelInteraction({
        spaceSlug,
        authToken,
      });
      if (!auth.authorized) return { ok: false, error: auth.message };
      const result = await saveSpaceContextSectionDraft(
        { spaceSlug, sectionKey, markdown, personId: auth.person.id },
        { db },
      );
      if (!result.ok) {
        return {
          ok: false,
          error:
            result.error === 'on_voting'
              ? 'The section is on voting. Drafts can be saved after the vote.'
              : 'The section cannot be saved now.',
        };
      }
      onSaved();
      return {
        ok: true,
        status: result.section.status,
        version: result.section.version,
        official: false,
      };
    },
  });
}

/** Locale-free path; the i18n middleware sends members to their own locale. */
export function spaceContextProposeUrl(
  requestUrl: string | undefined,
  spaceSlug: string,
  sectionKey: SpaceContextSectionKey,
): string | null {
  if (!requestUrl) return null;
  try {
    const url = new URL(
      `/dho/${encodeURIComponent(spaceSlug)}/context/create`,
      requestUrl,
    );
    url.searchParams.set('sections', sectionKey);
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Answer one @mention in a Context section room as that section's agent.
 * The draft changes only when the member explicitly asks to save or to
 * propose; otherwise the agent answers in the chat and nothing is written.
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
  requestUrl,
}: {
  roomId: string;
  authToken: string;
  spaceSlug: string;
  sectionKey: SpaceContextSectionKey;
  agentUserId: string;
  newestFirst: AgentRoomLine[];
  requestUrl?: string;
}): Promise<string | null> {
  const specialist = specialistForSectionKey(sectionKey);
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

  const intent = detectSpaceContextAgentIntent(turn.question);
  const canWrite = intent !== 'answer' && detail.section.status !== 'proposed';
  const proposeUrl =
    intent === 'propose'
      ? spaceContextProposeUrl(requestUrl, spaceSlug, sectionKey)
      : null;

  const memberTexts = newestFirst
    .filter((line) => line.sender !== agentUserId)
    .map((line) => line.body);
  let draftSaved = false;
  const tools: ToolSet = {
    read_space_context_source: createReadSpaceContextSourceTool(
      authToken,
      spaceSlug,
      extractSharedSourceUrls(memberTexts),
    ),
  };
  if (canWrite) {
    tools.save_section_draft = createSaveSectionDraftTool({
      authToken,
      spaceSlug,
      sectionKey,
      onSaved: () => {
        draftSaved = true;
      },
    });
  }

  const system = buildSpaceContextAgentPrompt({
    sectionKey,
    sectionTitle: detail.section.title,
    spaceTitle: space.title?.trim() || spaceSlug,
    spaceSlug,
    draftMarkdown: detail.section.markdown,
    ratifiedMarkdown: detail.section.ratifiedMarkdown,
    status: detail.section.status,
    pendingChange: detail.section.pendingChange,
    specialistMemory: detail.specialistMemory?.memoryMarkdown ?? '',
    intent,
    proposeUrl,
  });
  const prompt = [
    turn.earlier
      ? `Earlier in the room (oldest first):\n${turn.earlier}`
      : 'No earlier messages.',
    `The message that mentioned you:\n${turn.question}`,
  ].join('\n\n');

  const savedLine = `Saved as the ${detail.section.title} draft. It becomes official only after a proposal passes.`;
  const withProposeLink = (text: string) =>
    proposeUrl && !text.includes(proposeUrl)
      ? `${text}\n\n${proposeUrl}`
      : text;

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
    if (text) return withProposeLink(text);
    return draftSaved ? withProposeLink(savedLine) : null;
  } catch (error) {
    if (!draftSaved) throw error;
    return withProposeLink(savedLine);
  } finally {
    clearTimeout(timer);
  }
}
