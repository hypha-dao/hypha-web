import 'server-only';

import {
  findCoherenceBySlug,
  updateCoherenceBySlug,
} from '../../coherence/server';
import {
  getMatrixHomeserverUrl,
  matrixSendTextMessage,
  resolveUserMatrixIdentityForSend,
} from '../../matrix/server/matrix-http-client';
import {
  createBotOwnedRoomAction,
  ensureMemberJoinedRoomAction,
} from '../../matrix/server/actions';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  updateSpaceBySlug,
} from '../../space/server';
import type { DatabaseInstance } from '../../server';

export type HumanChatMessageTarget = 'space_chat' | 'signal_chat';

export type HumanChatNavigationPayload = {
  kind: 'internal';
  href: string;
  open_human_chat: true;
  chat_target: HumanChatMessageTarget;
  room_id: string;
  message_event_id: string;
  signal_slug?: string;
  signal_title?: string;
  label: string;
};

export type SendHumanChatMessageInput = {
  spaceSlug: string;
  message: string;
  target: HumanChatMessageTarget;
  signalSlug?: string;
  roomId?: string;
  lang?: string;
  authToken?: string;
  requestUrlForSessionMatrix?: string;
};

export type SendHumanChatMessageResult =
  | {
      ok: true;
      room_id: string;
      message_event_id: string;
      navigation: HumanChatNavigationPayload;
    }
  | { ok: false; error: string };

function buildHumanChatNavigation(args: {
  lang: string;
  spaceSlug: string;
  target: HumanChatMessageTarget;
  roomId: string;
  messageEventId: string;
  signalSlug?: string;
  signalTitle?: string;
}): HumanChatNavigationPayload {
  const params = new URLSearchParams();
  if (args.target === 'signal_chat' && args.signalSlug?.trim()) {
    params.set('signal', args.signalSlug.trim());
  }
  params.set('msg', args.messageEventId);
  const qs = params.toString();
  const href = `/${args.lang}/dho/${args.spaceSlug}${qs ? `?${qs}` : ''}`;
  const label =
    args.target === 'signal_chat'
      ? args.signalTitle?.trim() || 'Signal conversation'
      : 'Space chat';

  return {
    kind: 'internal',
    href,
    open_human_chat: true,
    chat_target: args.target,
    room_id: args.roomId,
    message_event_id: args.messageEventId,
    ...(args.signalSlug?.trim() ? { signal_slug: args.signalSlug.trim() } : {}),
    ...(args.signalTitle?.trim()
      ? { signal_title: args.signalTitle.trim() }
      : {}),
    label,
  };
}

export async function sendHumanChatMessageForSpace(
  input: SendHumanChatMessageInput,
  { db }: { db: DatabaseInstance },
): Promise<SendHumanChatMessageResult> {
  const spaceSlug = input.spaceSlug.trim();
  const message = input.message.trim();
  const lang = input.lang?.trim() || 'en';

  if (!spaceSlug || !message) {
    return { ok: false, error: 'space slug and message are required.' };
  }

  const homeserver = getMatrixHomeserverUrl();
  if (!homeserver) {
    return {
      ok: false,
      error: 'Human Chat is not configured on this environment.',
    };
  }

  const identity = await resolveUserMatrixIdentityForSend(
    input.authToken,
    input.requestUrlForSessionMatrix,
  );
  if (!identity) {
    return {
      ok: false,
      error:
        'Human Chat is not linked for this account yet. Ask the member to open Human Chat once so their Matrix session is connected, then retry.',
    };
  }
  const { accessToken, matrixUserId } = identity;

  const host = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!host) {
    return { ok: false, error: `Space "${spaceSlug}" was not found.` };
  }

  const access = await checkSpaceAccessForSpace(host, input.authToken);
  if (!access.hasAccess) {
    return { ok: false, error: access.message };
  }

  let targetRoomId = input.roomId?.trim() || '';
  let signalSlug: string | undefined;
  let signalTitle: string | undefined;

  if (input.target === 'signal_chat') {
    signalSlug = input.signalSlug?.trim();
    if (!signalSlug && !targetRoomId) {
      return {
        ok: false,
        error: 'signal_slug or room_id is required when target is signal_chat.',
      };
    }

    if (signalSlug) {
      const signal = await findCoherenceBySlug({ slug: signalSlug }, { db });
      if (!signal || signal.spaceId !== host.id) {
        return {
          ok: false,
          error: `Signal "${signalSlug}" was not found in this space.`,
        };
      }
      signalTitle = signal.title?.trim() || signalSlug;
      targetRoomId = signal.roomId?.trim() || targetRoomId;
      if (!targetRoomId) {
        const created = await createBotOwnedRoomAction({
          title: signalTitle,
          grantPl100ToMatrixUserId: matrixUserId,
        });
        if (!created) {
          return {
            ok: false,
            error: 'Failed to create signal chat room.',
          };
        }
        targetRoomId = created.roomId;
        await updateCoherenceBySlug(
          { slug: signalSlug, roomId: targetRoomId },
          { db },
        );
      }
    }
  } else {
    targetRoomId = host.chatRoomId?.trim() || targetRoomId;
    if (!targetRoomId) {
      const created = await createBotOwnedRoomAction({
        title: `space-${spaceSlug}`,
      });
      if (!created) {
        return {
          ok: false,
          error: 'Failed to create space chat room.',
        };
      }
      targetRoomId = created.roomId;
      await updateSpaceBySlug(
        { slug: spaceSlug, chatRoomId: targetRoomId },
        { db },
      );
    }
  }

  try {
    await ensureMemberJoinedRoomAction({
      roomId: targetRoomId,
      matrixUserId,
    });
    const joinedRoomId = targetRoomId;
    const messageEventId = await matrixSendTextMessage(
      joinedRoomId,
      message,
      accessToken,
      homeserver,
    );

    return {
      ok: true,
      room_id: joinedRoomId,
      message_event_id: messageEventId,
      navigation: buildHumanChatNavigation({
        lang,
        spaceSlug,
        target: input.target,
        roomId: joinedRoomId,
        messageEventId,
        signalSlug,
        signalTitle,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to send the Human Chat message.',
    };
  }
}
