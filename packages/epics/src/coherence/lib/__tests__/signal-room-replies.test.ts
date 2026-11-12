import { EventType } from 'matrix-js-sdk';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALL_CAPTURE_NOTICE_TYPE } from '../../../../../core/src/matrix/client/hooks/call-capture-consent';
import {
  collectDiscussionTimeline,
  isHumanChatBubbleEvent,
  summarizeHumanDiscussionTimeline,
  type HumanDiscussionTimelineEvent,
} from '../../../../../core/src/matrix/human-discussion-count';
import { isSignalDescriptionCopy } from '../../../../../core/src/coherence/signal-creator';
import {
  signalDiscussionCount,
  signalLastReplierLabel,
  summarizeSignalReplies,
  timelineReachesRoomStart,
  type SignalRoomMessage,
} from '../../utils/signal-room-replies';

const BOT = '@hypha_bot_prod:matrix.hypha.earth';
const ALEX = '@prod_privy_did_privy_alex:matrix.hypha.earth';
const SAM = '@prod_privy_did_privy_sam:matrix.hypha.earth';
const isBot = (sender: string) => sender === BOT;

function message(
  sender: string,
  ts: number,
  body: string,
  editedBody?: string,
): SignalRoomMessage {
  return { sender, ts, body, editedBody: editedBody ?? null };
}

describe('summarizeSignalReplies', () => {
  it('counts a human message whose text matches the description', () => {
    const summary = summarizeSignalReplies(
      [
        message(ALEX, 1, 'Fix the bridge before winter'),
        message(SAM, 2, 'I can help on Saturday'),
      ],
      { isBot },
    );
    expect(summary).toEqual({
      comments: 2,
      people: 2,
      lastReplyAt: 2,
      lastReplySenderId: SAM,
    });
  });

  it('counts a formatted description copy from a person', () => {
    const summary = summarizeSignalReplies(
      [message(SAM, 5, 'Agreed'), message(ALEX, 6, '<p>Fix the bridge</p>')],
      { isBot },
    );
    expect(summary.comments).toBe(2);
    expect(summary.lastReplySenderId).toBe(ALEX);
  });

  it('counts a human edit even when the new text is the description', () => {
    const summary = summarizeSignalReplies(
      [message(ALEX, 1, 'Old text', 'New text')],
      { isBot },
    );
    expect(summary.comments).toBe(1);
    expect(summary.people).toBe(1);
    expect(summary.lastReplySenderId).toBe(ALEX);
  });

  it('skips bot posts', () => {
    const summary = summarizeSignalReplies(
      [message(BOT, 1, 'Fix the bridge'), message(ALEX, 2, 'On it')],
      { isBot },
    );
    expect(summary).toMatchObject({ comments: 1, people: 1 });
  });

  it('counts every human message when the signal has no description', () => {
    const summary = summarizeSignalReplies(
      [message(ALEX, 1, 'First'), message(ALEX, 2, 'Second')],
      { isBot },
    );
    expect(summary).toMatchObject({ comments: 2, people: 1 });
  });

  it('does not count events the chat hides', () => {
    const summary = summarizeSignalReplies(
      [
        { ...message(ALEX, 1, 'Added Sam to the signal team'), hidden: true },
        message(SAM, 2, 'I can help on Saturday'),
      ],
      { isBot },
    );
    expect(summary.comments).toBe(1);
    expect(summary.people).toBe(1);
    expect(summary.lastReplySenderId).toBe(SAM);
  });
});

describe('signal room fixture', () => {
  const DESCRIPTION = 'Fix the bridge before the freeze';

  function wire(
    sender: string,
    ts: number,
    content: Record<string, unknown>,
    type = 'm.room.message',
  ): HumanDiscussionTimelineEvent {
    return {
      type,
      sender,
      ts,
      content,
      relatesTo: content['m.relates_to'],
    };
  }

  it('counts the two human bubbles and not the bot seed, bots or notices', () => {
    const authorBody = DESCRIPTION;
    // The live filter used to drop this bubble: the plaintext body is the
    // seeded description, while the chat renders formatted_body.
    expect(
      isSignalDescriptionCopy({
        messageContent: authorBody,
        signalDescription: DESCRIPTION,
      }),
    ).toBe(true);

    const authorMessage = wire(ALEX, 5, {
      msgtype: 'm.text',
      body: authorBody,
      format: 'org.matrix.custom.html',
      formatted_body: '<p>Assign an owner before Friday.</p>',
    });
    expect(isHumanChatBubbleEvent(authorMessage, isBot)).toBe(true);

    const timeline: HumanDiscussionTimelineEvent[] = [
      wire(ALEX, 1, {}, 'm.room.create'),
      wire(BOT, 2, { msgtype: 'm.text', body: 'Pulling the latest notes' }),
      wire(BOT, 3, { msgtype: 'm.text', body: DESCRIPTION }),
      wire(BOT, 4, {
        msgtype: 'm.notice',
        body: '[hypha:signal-team]',
        memberMatrixUserIds: [SAM],
      }),
      wire(ALEX, 4, {
        msgtype: 'm.text',
        body: 'capture started',
        [CALL_CAPTURE_NOTICE_TYPE]: true,
      }),
      authorMessage,
      wire(SAM, 6, { msgtype: 'm.text', body: 'I can take the east span.' }),
      wire(SAM, 7, {
        msgtype: 'm.text',
        body: '* I can take the east span tomorrow.',
        'm.new_content': {
          msgtype: 'm.text',
          body: 'I can take the east span tomorrow.',
        },
        'm.relates_to': { rel_type: 'm.replace', event_id: '$sam' },
      }),
    ];

    expect(summarizeHumanDiscussionTimeline(timeline, { isBot })).toEqual({
      comments: 2,
      people: 2,
      lastReplyAt: 6,
      lastReplySenderId: SAM,
    });
  });
});

describe('collectDiscussionTimeline', () => {
  it('reaches the start only when the homeserver omits the next token', async () => {
    const full = await collectDiscussionTimeline(async (from) =>
      from
        ? { chunk: [{ type: 'm.room.create', sender: ALEX }] }
        : {
            chunk: [{ type: 'm.room.message', sender: SAM }],
            end: 'older',
          },
    );
    expect(full.reachedStart).toBe(true);
    expect(full.events).toHaveLength(2);

    const repeated = await collectDiscussionTimeline(async () => ({
      chunk: [{ type: 'm.room.message', sender: SAM }],
      end: 'same',
    }));
    expect(repeated.reachedStart).toBe(false);

    const emptyWithToken = await collectDiscussionTimeline(async () => ({
      chunk: [],
      end: 'older',
    }));
    expect(emptyWithToken.reachedStart).toBe(false);
  });
});

describe('signalLastReplierLabel', () => {
  it('prefers the Hypha profile name', () => {
    expect(
      signalLastReplierLabel({
        senderId: ALEX,
        personName: 'Alex Rivera',
        matrixName: 'alex',
      }),
    ).toBe('Alex Rivera');
  });

  it('uses the viewer name for the viewer', () => {
    expect(
      signalLastReplierLabel({
        senderId: SAM,
        viewerMatrixId: SAM,
        viewerName: 'Sam Lee',
      }),
    ).toBe('Sam Lee');
  });

  it('returns null rather than a bridged id when no name is known', () => {
    expect(signalLastReplierLabel({ senderId: ALEX })).toBeNull();
  });
});

describe('timelineReachesRoomStart', () => {
  function room(types: string[], token: string | null) {
    return {
      oldState: { paginationToken: token },
      getLiveTimeline: () => ({
        getEvents: () => types.map((type) => ({ getType: () => type })),
      }),
    };
  }

  it('stays incomplete while older pages remain, even if create is loaded', () => {
    expect(
      timelineReachesRoomStart(
        room([EventType.RoomCreate, EventType.RoomMessage], 'prev'),
      ),
    ).toBe(false);
  });

  it('is complete only when the backwards token is clear and create is loaded', () => {
    expect(
      timelineReachesRoomStart(
        room([EventType.RoomMessage, EventType.RoomCreate], null),
      ),
    ).toBe(true);
    expect(timelineReachesRoomStart(room([EventType.RoomMessage], null))).toBe(
      false,
    );
    expect(timelineReachesRoomStart(room([], null))).toBe(false);
  });
});

describe('signal discussion count persistence', () => {
  const panelSource = readFileSync(
    resolve(__dirname, '../../../common/human-right-panel.tsx'),
    'utf8',
  );
  const chatRoomSource = readFileSync(
    resolve(__dirname, '../../components/chat-room.tsx'),
    'utf8',
  );
  const ingestSource = readFileSync(
    resolve(
      __dirname,
      '../../../../../notifications/src/ingest/matrix-as/ingest-message.ts',
    ),
    'utf8',
  );
  const routeSource = readFileSync(
    resolve(
      __dirname,
      '../../../../../../apps/web/src/app/api/matrix/appservice/transactions/[txnId]/route.ts',
    ),
    'utf8',
  );

  it('stores the human count from the server message path, not from the open chat', () => {
    expect(panelSource).not.toContain('readSignalRoomDiscussionCount');
    expect(chatRoomSource).not.toContain('readSignalRoomDiscussionCount');
    expect(panelSource).not.toContain('messages: discussion.comments');
    expect(chatRoomSource).not.toContain('messages: discussion.comments');
    expect(panelSource).toContain('pageSize: 50, maxBatches: 4');
    expect(panelSource).toContain("chatModeRef.current === 'coherence'");
    expect(ingestSource).toContain('onSignalDiscussion');
    expect(ingestSource).toContain("context.kind === 'signal'");
    expect(routeSource).toContain('recountSignalDiscussionByRoomId');
  });
});

describe('signalDiscussionCount', () => {
  it('keeps the stored total until the timeline reaches the room start', () => {
    expect(signalDiscussionCount(15, null)).toBe(15);
    expect(
      signalDiscussionCount(15, { comments: 2, reachesRoomStart: false }),
    ).toBe(15);
  });

  it('uses the filtered reply count once the whole room is loaded', () => {
    expect(
      signalDiscussionCount(15, { comments: 2, reachesRoomStart: true }),
    ).toBe(2);
  });
});
