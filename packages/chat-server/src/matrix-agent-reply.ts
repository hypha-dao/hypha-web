import 'server-only';

import { generateText, stepCountIs } from 'ai';
import { contentMentionsMatrixUser } from '@hypha-platform/core/client';
import {
  getMatrixBotAsToken,
  getMatrixBotUserId,
  getMatrixHomeserverUrl,
  matrixJoinRoom,
  matrixListRoomMessages,
  matrixSendTextMessage,
} from '@hypha-platform/core/server';
import { mentionAwaitingAgent, type AgentRoomLine } from './matrix-agent-turn';
import { createChatTools } from './tools';
import { getHyphaChatModel } from './stream-chat';

function readTextEvents(
  chunk: unknown[],
  agentUserId: string,
): AgentRoomLine[] {
  const lines: AgentRoomLine[] = [];
  for (const event of chunk) {
    if (!event || typeof event !== 'object') continue;
    const row = event as Record<string, unknown>;
    if (row.type !== 'm.room.message') continue;
    const content = row.content;
    if (!content || typeof content !== 'object') continue;
    const bodyContent = content as Record<string, unknown>;
    if (bodyContent.msgtype !== 'm.text') continue;
    const relates = bodyContent['m.relates_to'];
    if (
      relates &&
      typeof relates === 'object' &&
      (relates as { rel_type?: string }).rel_type === 'm.replace'
    ) {
      continue;
    }
    const sender = typeof row.sender === 'string' ? row.sender : '';
    const body =
      typeof bodyContent.body === 'string' ? bodyContent.body.trim() : '';
    if (!sender || !body) continue;
    lines.push({
      sender,
      body,
      mentionsAgent: contentMentionsMatrixUser(content, agentUserId),
    });
  }
  return lines;
}

const AGENT_PROMPT = `You are Hypha, speaking in a Matrix room only because someone just @mentioned you. You were not in the conversation before that, and you do not stay in it.

Be useful and brief. High integrity, at the right distance. Never intrusive. Never curious. Do not greet. Do not say that you were mentioned. Do not open with Sure.

Help with the work in the message: name a tension if one is there, nail an opportunity if one is there, phrase a need so the room can act on it, or estimate the resources the work seems to need. Use common sense and, when the world outside the room matters, web_search. When a space slug is given, you may read that space only: its signals, people, documents, ecosystem, memory, and discussion summary. Do not invent a slug, a person, a vote, a token, an amount, or a decision. You are not in the decision.

Do not create a signal, a proposal, or another message. If they want wording, give them the words in this reply.

Reply in the language of the message that mentioned you. One to four sentences, or a short list when they asked for an estimate. Plain text.`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * If the latest text in the room @mentions the agent and it has not already replied, post one
 * helpful answer as the agent. Quiet when the mention is absent.
 */
export async function replyToMatrixAgentMention({
  roomId,
  authToken,
  spaceSlug,
  requestUrl,
}: {
  roomId: string;
  authToken: string;
  spaceSlug?: string | null;
  requestUrl?: string;
}): Promise<{ replied: boolean }> {
  const homeserver = getMatrixHomeserverUrl();
  const botToken = getMatrixBotAsToken();
  const agentUserId = getMatrixBotUserId();
  const trimmedRoom = roomId.trim();
  if (!homeserver || !botToken || !agentUserId || !trimmedRoom) {
    return { replied: false };
  }
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return { replied: false };
  }

  let turn: { question: string; earlier: string } | null = null;
  for (let attempt = 0; attempt < 4 && !turn; attempt += 1) {
    if (attempt > 0) await sleep(400);
    try {
      const history = await matrixListRoomMessages(
        trimmedRoom,
        botToken,
        homeserver,
        { limit: 30 },
      );
      turn = mentionAwaitingAgent(
        readTextEvents(history.chunk, agentUserId),
        agentUserId,
      );
    } catch (error) {
      console.warn(
        '[MatrixAgent] Failed to read the room:',
        trimmedRoom,
        error instanceof Error ? error.message : error,
      );
      return { replied: false };
    }
  }
  if (!turn) return { replied: false };

  const slug = spaceSlug?.trim() || '';
  const tools = createChatTools(
    authToken,
    requestUrl,
    undefined,
    undefined,
    turn.question,
    [turn.question],
    null,
    null,
  );
  const readTools = slug
    ? {
        get_signals_by_space_slug: tools.get_signals_by_space_slug,
        get_people_by_space_slug: tools.get_people_by_space_slug,
        get_documents_by_space_slug: tools.get_documents_by_space_slug,
        get_ecosystem_by_space_slug: tools.get_ecosystem_by_space_slug,
        get_org_memory_by_space_slug: tools.get_org_memory_by_space_slug,
        summarize_space_discussion_by_slug:
          tools.summarize_space_discussion_by_slug,
        web_search: tools.web_search,
      }
    : { web_search: tools.web_search };

  let text = '';
  try {
    const result = await generateText({
      model: getHyphaChatModel(),
      system: AGENT_PROMPT,
      prompt: [
        slug
          ? `Space slug: ${slug}`
          : 'Space slug: none. Do not look up a space.',
        turn.earlier
          ? `Earlier in the room:\n${turn.earlier}`
          : 'No earlier messages.',
        `The message that mentioned you:\n${turn.question}`,
      ].join('\n\n'),
      tools: readTools as unknown as Parameters<
        typeof generateText
      >[0]['tools'],
      stopWhen: stepCountIs(4),
    });
    text = result.text.trim().slice(0, 2000);
  } catch (error) {
    console.warn(
      '[MatrixAgent] Failed to write a reply:',
      trimmedRoom,
      error instanceof Error ? error.message : error,
    );
    return { replied: false };
  }
  if (!text) return { replied: false };

  try {
    await matrixJoinRoom(trimmedRoom, botToken, homeserver);
  } catch {
    // The agent is already in the room, or the room is one it created.
  }

  try {
    await matrixSendTextMessage(trimmedRoom, text, botToken, homeserver);
  } catch (error) {
    console.warn(
      '[MatrixAgent] Failed to post the reply:',
      trimmedRoom,
      error instanceof Error ? error.message : error,
    );
    return { replied: false };
  }
  return { replied: true };
}
