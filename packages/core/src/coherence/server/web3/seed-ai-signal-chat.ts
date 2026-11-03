'use server';

import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccessForSpace, findSpaceById } from '../../../space/server';
import { findCoherenceBySlug } from '../queries';
import {
  isAiAuthoredSignal,
  normalizeSignalSignatureText,
  planAiSignalChatSignature,
  type AiSignalTimelineEvent,
} from '../../ai-signal-signature';
import {
  getMatrixBotAsToken,
  getMatrixHomeserverUrl,
  matrixJoinRoom,
  matrixListRoomMessages,
  matrixRedactEvent,
  matrixSendTextMessage,
  matrixWhoAmI,
} from '../../../matrix/server/matrix-http-client';

export type SeedAiSignalChatResult =
  | { ok: true; signed: true; unredactedEventId: string | null }
  | { ok: true; signed: false; reason: 'not-ai' }
  | {
      ok: false;
      reason: 'forbidden' | 'unavailable' | 'room-mismatch' | 'not-found';
    };

function readTimelineEvent(value: unknown): AiSignalTimelineEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Record<string, unknown>;
  if (event.type !== 'm.room.message') return null;
  const eventId =
    typeof event.event_id === 'string' ? event.event_id.trim() : '';
  const sender = typeof event.sender === 'string' ? event.sender.trim() : '';
  if (!eventId || !sender) return null;
  const unsigned = event.unsigned as { redacted_because?: unknown } | undefined;
  const content =
    contentRecord(event.content) ?? ({} as Record<string, unknown>);
  const relates = contentRecord(content['m.relates_to']);
  const body = typeof content.body === 'string' ? content.body : '';
  const msgtype =
    typeof content.msgtype === 'string' ? content.msgtype : undefined;
  return {
    eventId,
    sender,
    body,
    timestamp:
      typeof event.origin_server_ts === 'number' ? event.origin_server_ts : 0,
    msgtype,
    redacted: Boolean(unsigned?.redacted_because),
    replacement: relates?.rel_type === 'm.replace',
  };
}

function contentRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

/**
 * Post an AI-written signal's description as the AI Agents account.
 * A copy already sent from the member who opened the thread is removed.
 */
export async function seedAiSignalDescriptionAsAgent({
  slug,
  roomId,
  authToken,
}: {
  slug: string;
  roomId: string;
  authToken?: string;
}): Promise<SeedAiSignalChatResult> {
  const signalSlug = slug.trim();
  const targetRoomId = roomId.trim();
  if (!signalSlug || !targetRoomId) {
    return { ok: false, reason: 'forbidden' };
  }

  const signal = await findCoherenceBySlug({ slug: signalSlug }, { db });
  if (!signal) return { ok: false, reason: 'not-found' };

  const tags = Array.isArray(signal.tags) ? signal.tags.map(String) : [];
  if (
    !isAiAuthoredSignal({
      tags,
      title: signal.title,
      description: signal.description,
    })
  ) {
    return { ok: true, signed: false, reason: 'not-ai' };
  }

  const description = normalizeSignalSignatureText(signal.description ?? '');
  if (!description) return { ok: true, signed: false, reason: 'not-ai' };
  if (!authToken?.trim()) return { ok: false, reason: 'forbidden' };

  if (!signal.spaceId) return { ok: false, reason: 'forbidden' };
  const host = await findSpaceById({ id: signal.spaceId }, { db });
  if (!host) return { ok: false, reason: 'not-found' };
  const access = await checkSpaceAccessForSpace(host, authToken);
  if (!access.hasAccess) return { ok: false, reason: 'forbidden' };

  const storedRoomId = signal.roomId?.trim() ?? '';
  if (!storedRoomId || storedRoomId !== targetRoomId) {
    return { ok: false, reason: 'room-mismatch' };
  }

  const homeserver = getMatrixHomeserverUrl();
  const botToken = getMatrixBotAsToken();
  if (!homeserver || !botToken) {
    return { ok: false, reason: 'unavailable' };
  }

  let botUserId = '';
  try {
    await matrixJoinRoom(targetRoomId, botToken, homeserver);
    botUserId = await matrixWhoAmI(botToken, homeserver);
  } catch (error) {
    console.warn(
      '[AiSignalSignature] Agent could not join the signal room:',
      signalSlug,
      error instanceof Error ? error.message : error,
    );
    return { ok: false, reason: 'unavailable' };
  }

  let events: AiSignalTimelineEvent[] = [];
  try {
    const page = await matrixListRoomMessages(
      targetRoomId,
      botToken,
      homeserver,
      { limit: 50 },
    );
    events = page.chunk
      .map(readTimelineEvent)
      .filter((event): event is AiSignalTimelineEvent => event != null);
  } catch (error) {
    console.warn(
      '[AiSignalSignature] Agent could not read the signal room:',
      signalSlug,
      error instanceof Error ? error.message : error,
    );
    return { ok: false, reason: 'unavailable' };
  }

  const plan = planAiSignalChatSignature({
    description,
    botUserId,
    events,
  });
  const txnKey = signalSlug.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);

  if (plan.send) {
    try {
      await matrixSendTextMessage(
        targetRoomId,
        description,
        botToken,
        homeserver,
        undefined,
        `hypha.ai-signal.${txnKey}`,
      );
    } catch (error) {
      console.warn(
        '[AiSignalSignature] Agent could not sign the signal:',
        signalSlug,
        error instanceof Error ? error.message : error,
      );
      return { ok: false, reason: 'unavailable' };
    }
  }

  if (!plan.redactEventId) {
    return { ok: true, signed: true, unredactedEventId: null };
  }

  try {
    await matrixRedactEvent(
      targetRoomId,
      plan.redactEventId,
      botToken,
      homeserver,
      `hypha.ai-signal.redact.${txnKey}`,
    );
    return { ok: true, signed: true, unredactedEventId: null };
  } catch (error) {
    console.warn(
      '[AiSignalSignature] Agent could not remove the member copy:',
      signalSlug,
      error instanceof Error ? error.message : error,
    );
    return {
      ok: true,
      signed: true,
      unredactedEventId: plan.redactEventId,
    };
  }
}
