// server-only: reached only from API route handlers (#2485 POC).

import type { ToolSet } from 'ai';
import {
  loggingDispatch,
  type ChatNotificationEvent,
  type NotificationDispatch,
} from '@hypha-platform/notifications/ingest';
import { getAiBotPocConfig } from './config';
import { buildPinnedContextBlock, createReadFileTool } from './context-source';
import { answer, LlmCallError, LlmConfigError } from './llm';
import { ensurePersonaInRoom, postAs } from './matrix-out';
import { isPocBotSender, resolvePersona, type Persona } from './personas';
import { createSignalStubTool } from './signal-tool';

/**
 * #2485 — AI-bot-in-Matrix POC entry point.
 *
 * Wraps #2483's `loggingDispatch` (Callout 1: wrap, don't replace). The #2470 stub path always
 * runs first and unchanged; POC handling is fully guarded — any throw is logged, never bubbles
 * into the AS route's 200 path. Teardown = delete this folder + revert the two call sites.
 *
 * Every decision point logs a `[ai-bot-poc]` line (this is a POC — verbose on purpose). Grep the
 * `pnpm dev:web` console for `[ai-bot-poc]` to trace one message end to end.
 */

const LOG = '[ai-bot-poc]';

export const pocDispatch: NotificationDispatch = async (
  event: ChatNotificationEvent,
) => {
  await loggingDispatch(event);
  try {
    await handlePocEvent(event);
  } catch (error) {
    console.error(`${LOG} handler error (swallowed)`, {
      matrixEventId: event.source.matrixEventId,
      error,
    });
  }
};

async function handlePocEvent(event: ChatNotificationEvent): Promise<void> {
  const trace = {
    matrixEventId: event.source.matrixEventId,
    type: event.type,
    actor: event.actor.matrixUserId,
    roomId: event.roomId,
    contextKind: event.context.kind,
    mentioned: event.payload.mentionedMatrixUserIds,
    bodyPreview: event.payload.body.slice(0, 80),
  };
  console.info(`${LOG} pocDispatch received event`, trace);

  // Trigger = a known @hyphabot_* persona named either in m.mentions OR as plain text in the body
  // (some clients don't pill mentions). We deliberately do NOT gate on event.type === 'chat.mention'
  // because the #2483 receiver only sets that when m.mentions is populated.
  if (isPocBotSender(event.actor.matrixUserId)) {
    console.info(`${LOG} SKIP: sender is a POC bot (loop guard)`, {
      actor: event.actor.matrixUserId,
    });
    return;
  }

  const persona = resolvePersona(
    event.payload.mentionedMatrixUserIds,
    event.payload.body,
  );
  if (!persona) {
    console.info(
      `${LOG} SKIP: no @hyphabot_* persona named (checked m.mentions and body text)`,
      {
        mentioned: event.payload.mentionedMatrixUserIds,
        bodyPreview: event.payload.body.slice(0, 80),
      },
    );
    return;
  }

  const cfg = getAiBotPocConfig();
  if (!cfg) {
    console.warn(
      `${LOG} SKIP: config not ready (see the earlier "[ai-bot-poc] disabled — missing env" line). ` +
        'Did you restart `pnpm dev:web` after editing apps/web/.env?',
    );
    return;
  }

  if (event.context.kind !== 'space') {
    console.info(`${LOG} SKIP: context is not a space`, {
      contextKind: event.context.kind,
    });
    return;
  }
  const spaceSlug = event.context.spaceSlug;
  const roomId = event.roomId;

  console.info(`${LOG} MATCH — handling mention`, {
    persona: persona.localpart,
    spaceSlug,
    roomId,
  });

  await ensurePersonaInRoom(persona, roomId, cfg);

  let replyText: string;
  try {
    const pinned = await buildPinnedContextBlock(cfg.contextRepoPath);
    console.info(`${LOG} pinned context loaded`, {
      chars: pinned.length,
      repoPath: cfg.contextRepoPath,
    });
    const system = [
      persona.systemPrompt,
      '',
      'CONTEXT FILES (from the hypha-context repository):',
      pinned || '(no pinned files could be read)',
    ].join('\n');

    const tools = buildTools(persona, cfg.contextRepoPath, spaceSlug);
    const question = stripMentions(event.payload.body);
    console.info(`${LOG} calling LLM`, {
      persona: persona.localpart,
      model: cfg.modelOverride ?? '(default)',
      tools: Object.keys(tools),
      question,
    });

    const { text, providerLabel } = await answer({
      system,
      question,
      tools,
      modelOverride: cfg.modelOverride,
    });
    console.info(`${LOG} LLM answered`, {
      persona: persona.localpart,
      providerLabel,
      chars: text.length,
    });
    replyText = text;
  } catch (error) {
    if (error instanceof LlmConfigError) {
      replyText =
        '⚠️ I’m not fully configured right now, so I can’t answer that.';
    } else if (error instanceof LlmCallError) {
      replyText =
        '⚠️ I couldn’t answer that right now — please try again in a moment.';
    } else {
      throw error;
    }
    console.warn(`${LOG} LLM failed — posting in-room error notice instead`, {
      persona: persona.localpart,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const eventId = await postAs(persona, roomId, replyText, cfg);
    console.info(`${LOG} reply posted`, {
      persona: persona.localpart,
      roomId,
      eventId,
    });
  } catch (error) {
    console.error(`${LOG} FAILED to post reply into the room`, {
      persona: persona.localpart,
      roomId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildTools(
  persona: Persona,
  contextRepoPath: string,
  spaceSlug: string,
): ToolSet {
  const tools: ToolSet = {};
  if (persona.tools.includes('read_file')) {
    tools.read_file = createReadFileTool(contextRepoPath);
  }
  if (persona.tools.includes('create_signal')) {
    tools.create_signal = createSignalStubTool(spaceSlug);
  }
  return tools;
}

/** Drop leading `@hyphabot_… :` pill text and matrix.to markdown so the model sees a clean question. */
function stripMentions(body: string): string {
  return body
    .replace(/\[([^\]]*)\]\(https?:\/\/matrix\.to\/[^)]*\)/g, '$1')
    .replace(/@hyphabot_[a-z0-9_]+(:[\w.-]+)?/gi, '')
    .replace(/^\s*[:,\-–]\s*/, '')
    .trim();
}
