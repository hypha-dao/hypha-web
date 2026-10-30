import 'server-only';

import { createHash } from 'node:crypto';
import { generateText, stepCountIs } from 'ai';
import {
  contentMentionsMatrixUser,
  HYPHA_AGENT_SPECIALIST_FIELD,
  isSpaceContextSectionKey,
  selectSpecialistForQuestion,
  specialistById,
} from '@hypha-platform/core/client';
import {
  getMatrixBotAsToken,
  getMatrixBotUserId,
  getMatrixHomeserverUrl,
  matrixInviteUser,
  matrixJoinRoom,
  matrixListRoomMessages,
  matrixSendTextMessage,
  resolveUserMatrixAccessTokenForSend,
} from '@hypha-platform/core/server';
import { mentionAwaitingAgent, type AgentRoomLine } from './matrix-agent-turn';
import { writeSpaceContextAgentReply } from './matrix-space-context-agent';
import { createChatTools } from './tools';
import { getHyphaChatModel } from './stream-chat';

/**
 * Invite-only DMs and private rooms block the bot from listing history until it is a
 * member. Invite with the mentioner's session token, then accept as the bot — soft-fail so
 * open-join rooms and rooms the bot already sits in still work.
 */
async function ensureAgentJoinedRoom({
  roomId,
  agentUserId,
  botToken,
  homeserver,
  authToken,
  requestUrl,
}: {
  roomId: string;
  agentUserId: string;
  botToken: string;
  homeserver: string;
  authToken: string;
  requestUrl?: string;
}): Promise<void> {
  try {
    await matrixJoinRoom(roomId, botToken, homeserver);
    return;
  } catch {
    // Not invited yet, or already joined under a different code path.
  }

  const userToken = await resolveUserMatrixAccessTokenForSend(
    authToken,
    requestUrl,
  );
  if (userToken) {
    try {
      await matrixInviteUser(roomId, agentUserId, userToken, homeserver);
    } catch (error) {
      console.warn(
        '[MatrixAgent] Failed to invite the agent into the room:',
        roomId,
        error instanceof Error ? error.message : error,
      );
    }
  }

  try {
    await matrixJoinRoom(roomId, botToken, homeserver);
  } catch (error) {
    console.warn(
      '[MatrixAgent] Failed to join the room after invite:',
      roomId,
      error instanceof Error ? error.message : error,
    );
  }
}

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

function agentPrompt(role: string) {
  return `You are ${role}, one specialist among AI Agents, speaking in a Matrix room only because someone just @mentioned AI Agents. You were not in the conversation before that, and you do not stay in it.

Answer only the question they asked. Do not answer a skill they did not ask. Speak as ${role}.`;
}

const AGENT_PROMPT_REST = `

Be useful and brief. High integrity, at the right distance. Never intrusive. Never curious. Do not greet. Do not say that you were mentioned. Do not open with Sure.

Help with the work in the message: name a tension if one is there, nail an opportunity if one is there, phrase a need so the room can act on it, or estimate the resources the work seems to need. Answer from the message and the earlier lines first. Use at most one tool, and only when those lines do not contain the fact. When no space slug is given, this is a private person-to-person room (a DM or small group) — answer only from the room history and the question; do not invent a space, a member list, or pretend this is a space channel. Speak as someone accompanying the room. The power is the collective, people already helping each other. No open question. End on the one next step the room can take. Do not invent a slug, a person, a vote, a token, an amount, or a decision. You are not in the decision.

Do not create a signal, a proposal, or another message. If they want wording, give them the words in this reply.

Reply in the language of the message that mentioned you. Two or three sentences, or a short list when they asked for an estimate. Plain text.`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Same question in the same room posts once, even when two requests overlap. */
function agentReplyTxnId(roomId: string, question: string): string {
  const digest = createHash('sha256')
    .update(`${roomId}\n${question.trim().slice(0, 500)}`)
    .digest('hex')
    .slice(0, 32);
  return `hypha.agent.${digest}`;
}

const AGENT_WRITE_MS = 22_000;

async function writeAgentText(input: {
  system: string;
  prompt: string;
  tools?: Parameters<typeof generateText>[0]['tools'];
}): Promise<string> {
  const run = (tools?: Parameters<typeof generateText>[0]['tools']) => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), AGENT_WRITE_MS);
    return generateText({
      model: getHyphaChatModel(),
      system: input.system,
      prompt: input.prompt,
      abortSignal: abort.signal,
      ...(tools
        ? { tools, stopWhen: stepCountIs(2) }
        : { stopWhen: stepCountIs(1) }),
    }).finally(() => clearTimeout(timer));
  };

  if (input.tools) {
    try {
      const lookedUp = await run(input.tools);
      const text = lookedUp.text.trim().slice(0, 2000);
      if (text) return text;
    } catch (error) {
      console.warn(
        '[MatrixAgent] Lookup did not finish, answering from the room:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  const plain = await run();
  return plain.text.trim().slice(0, 2000);
}

/**
 * If the latest text in the room @mentions the agent and it has not already replied, post one
 * helpful answer as the agent. Quiet when the mention is absent.
 */
export type MatrixAgentRoomContext = {
  kind:
    | 'proposal'
    | 'signal'
    | 'space'
    | 'space_context'
    | 'ecosystem'
    | 'public'
    | 'network'
    | 'dm';
  spaceSlug?: string | null;
  documentSlug?: string | null;
  documentTitle?: string | null;
  signalSlug?: string | null;
  signalTitle?: string | null;
  /** Context section whose agent was mentioned (`space_context` rooms). */
  sectionKey?: string | null;
};

function describeRoomContext(
  context: MatrixAgentRoomContext | null | undefined,
  spaceSlug: string,
): string {
  const kind = context?.kind;
  if (kind === 'proposal') {
    const title = context?.documentTitle?.trim();
    const slug = context?.documentSlug?.trim();
    return [
      'You are in a proposal discussion thread.',
      title ? `Proposal title: ${title}` : null,
      slug ? `Proposal document slug: ${slug}` : null,
      spaceSlug
        ? `Space slug: ${spaceSlug}. Answer from the message. Look the proposal up only when the room text does not already say it.`
        : 'Space slug is unknown — answer from the room and the proposal title only.',
    ]
      .filter(Boolean)
      .join(' ');
  }
  if (kind === 'signal') {
    const title = context?.signalTitle?.trim();
    const slug = context?.signalSlug?.trim();
    return [
      'You are in a signal chat thread.',
      title ? `Signal title: ${title}` : null,
      slug ? `Signal slug: ${slug}` : null,
      spaceSlug
        ? `Space slug: ${spaceSlug}. Answer from the message. Look the signal up only when the room text does not already say it.`
        : 'Space slug is unknown — answer from the room and the signal title only.',
    ]
      .filter(Boolean)
      .join(' ');
  }
  if (kind === 'ecosystem') {
    return spaceSlug
      ? `You are in the ecosystem room for space slug ${spaceSlug}. This is shared by every space in that ecosystem — not the root space’s private member room. Answer from the message.`
      : 'You are in an ecosystem room. Answer from the room history; look up ecosystem tools when a space slug appears.';
  }
  if (kind === 'public') {
    return spaceSlug
      ? `You are in the public channel for space slug ${spaceSlug}. Anyone on the network can write here; the members-only space room is separate. Answer from the message, and keep the tone open to visitors.`
      : 'You are in a public space channel open to network visitors. Answer from the room history; look up the space when a slug appears.';
  }
  if (kind === 'network') {
    return 'You are in the network room. Answer from the room history and network-wide tools; do not invent a single home space.';
  }
  if (kind === 'dm') {
    return 'Space slug: none. This is a private person-to-person room. Do not look up a space or quote a space member list.';
  }
  if (spaceSlug) {
    return `You are in a space room. Space slug: ${spaceSlug}. Answer from the message. Look the space up only when the room text does not already say it.`;
  }
  return 'Space slug: none. This is a private person-to-person room. Do not look up a space or quote a space member list.';
}

export async function replyToMatrixAgentMention({
  roomId,
  authToken,
  spaceSlug,
  context,
  requestUrl,
}: {
  roomId: string;
  authToken: string;
  spaceSlug?: string | null;
  context?: MatrixAgentRoomContext | null;
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

  await ensureAgentJoinedRoom({
    roomId: trimmedRoom,
    agentUserId,
    botToken,
    homeserver,
    authToken,
    requestUrl,
  });

  const slug = context?.spaceSlug?.trim() || spaceSlug?.trim() || '';
  const contextSectionKey =
    context?.kind === 'space_context' &&
    slug &&
    context.sectionKey &&
    isSpaceContextSectionKey(context.sectionKey)
      ? context.sectionKey
      : null;
  if (context?.kind === 'space_context' && !contextSectionKey) {
    return { replied: false };
  }

  let turn: { question: string; earlier: string } | null = null;
  let lines: AgentRoomLine[] = [];
  for (let attempt = 0; attempt < 8 && !turn; attempt += 1) {
    if (attempt > 0) await sleep(350);
    try {
      const history = await matrixListRoomMessages(
        trimmedRoom,
        botToken,
        homeserver,
        { limit: contextSectionKey ? 50 : 30 },
      );
      lines = readTextEvents(history.chunk, agentUserId);
      turn = mentionAwaitingAgent(lines, agentUserId);
    } catch (error) {
      console.warn(
        '[MatrixAgent] Failed to read the room:',
        trimmedRoom,
        error instanceof Error ? error.message : error,
      );
      // Retry — invite/join or the mention event may not be visible yet.
    }
  }
  if (!turn) return { replied: false };

  if (contextSectionKey) {
    let contextText: string | null = null;
    try {
      contextText = await writeSpaceContextAgentReply({
        roomId: trimmedRoom,
        authToken,
        spaceSlug: slug,
        sectionKey: contextSectionKey,
        agentUserId,
        newestFirst: lines,
      });
    } catch (error) {
      console.warn(
        '[MatrixAgent] Failed to write a Context section reply:',
        trimmedRoom,
        error instanceof Error ? error.message : error,
      );
      return { replied: false };
    }
    if (!contextText) return { replied: false };
    return postAgentReply({
      roomId: trimmedRoom,
      text: contextText,
      botToken,
      homeserver,
      question: turn.question,
    });
  }

  const specialist =
    selectSpecialistForQuestion(turn.question) ?? specialistById('purpose');
  const roomKind = context?.kind ?? (slug ? 'space' : 'dm');
  const allowSpaceTools =
    Boolean(slug) && roomKind !== 'dm' && roomKind !== 'network';
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
  const readTools = allowSpaceTools
    ? {
        summarize_space_discussion_by_slug:
          tools.summarize_space_discussion_by_slug,
        web_search: tools.web_search,
      }
    : { web_search: tools.web_search };

  const prompt = [
    describeRoomContext(context ?? { kind: roomKind, spaceSlug: slug }, slug),
    turn.earlier
      ? `Earlier in the room:\n${turn.earlier}`
      : 'No earlier messages.',
    `The message that mentioned you:\n${turn.question}`,
  ].join('\n\n');
  const system = `${agentPrompt(
    specialist?.role ?? 'AI Agents',
  )}\n\n${AGENT_PROMPT_REST}`;

  let text = '';
  try {
    text = await writeAgentText({
      system,
      prompt,
      tools: readTools as unknown as Parameters<
        typeof generateText
      >[0]['tools'],
    });
  } catch (error) {
    console.warn(
      '[MatrixAgent] Failed to write a reply:',
      trimmedRoom,
      error instanceof Error ? error.message : error,
    );
    return { replied: false };
  }
  if (!text) return { replied: false };

  return postAgentReply({
    roomId: trimmedRoom,
    text,
    botToken,
    homeserver,
    question: turn.question,
    extraContent: specialist
      ? { [HYPHA_AGENT_SPECIALIST_FIELD]: specialist.id }
      : undefined,
  });
}

async function postAgentReply({
  roomId,
  text,
  botToken,
  homeserver,
  question,
  extraContent,
}: {
  roomId: string;
  text: string;
  botToken: string;
  homeserver: string;
  question: string;
  extraContent?: Record<string, string>;
}): Promise<{ replied: boolean }> {
  try {
    await matrixJoinRoom(roomId, botToken, homeserver);
  } catch {
    // The agent is already in the room, or the room is one it created.
  }

  try {
    await matrixSendTextMessage(
      roomId,
      text,
      botToken,
      homeserver,
      extraContent,
      agentReplyTxnId(roomId, question),
    );
  } catch (error) {
    console.warn(
      '[MatrixAgent] Failed to post the reply:',
      roomId,
      error instanceof Error ? error.message : error,
    );
    return { replied: false };
  }
  return { replied: true };
}
