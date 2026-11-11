import { EventType } from 'matrix-js-sdk';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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
  it('does not count the seeded description as a comment or a person', () => {
    const summary = summarizeSignalReplies(
      [
        message(ALEX, 1, 'Fix the bridge before winter'),
        message(SAM, 2, 'I can help on Saturday'),
      ],
      'Fix the bridge before winter',
      { isBot },
    );
    expect(summary).toEqual({
      comments: 1,
      people: 1,
      lastReplyAt: 2,
      lastReplySenderId: SAM,
    });
  });

  it('excludes a description copy even when the timeline starts mid-room', () => {
    const summary = summarizeSignalReplies(
      [message(SAM, 5, 'Agreed'), message(ALEX, 6, '<p>Fix the bridge</p>')],
      'Fix the bridge',
      { isBot },
    );
    expect(summary.comments).toBe(1);
    expect(summary.lastReplySenderId).toBe(SAM);
  });

  it('excludes a seed that was edited to the current description', () => {
    const summary = summarizeSignalReplies(
      [message(ALEX, 1, 'Old text', 'New text')],
      'New text',
      { isBot },
    );
    expect(summary.comments).toBe(0);
    expect(summary.people).toBe(0);
    expect(summary.lastReplyAt).toBeNull();
  });

  it('counts a seed once the current edit is no longer the description', () => {
    const summary = summarizeSignalReplies(
      [message(ALEX, 1, 'Fix the bridge', 'I can bring tools')],
      'Fix the bridge',
      { isBot },
    );
    expect(summary.comments).toBe(1);
    expect(summary.lastReplySenderId).toBe(ALEX);
  });

  it('excludes an edit that matches the description even when the original body does not', () => {
    const summary = summarizeSignalReplies(
      [message(ALEX, 1, 'I can bring tools', 'Fix the bridge')],
      'Fix the bridge',
      { isBot },
    );
    expect(summary.comments).toBe(0);
  });

  it('skips bot posts', () => {
    const summary = summarizeSignalReplies(
      [message(BOT, 1, 'Fix the bridge'), message(ALEX, 2, 'On it')],
      'Fix the bridge',
      { isBot },
    );
    expect(summary).toMatchObject({ comments: 1, people: 1 });
  });

  it('counts every message when the signal has no description', () => {
    const summary = summarizeSignalReplies(
      [message(ALEX, 1, 'First'), message(ALEX, 2, 'Second')],
      '',
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
      null,
      { isBot },
    );
    expect(summary.comments).toBe(1);
    expect(summary.people).toBe(1);
    expect(summary.lastReplySenderId).toBe(SAM);
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

  it('saves the human count when scrollback reaches the start, not when the tail length changes', () => {
    for (const source of [panelSource, chatRoomSource]) {
      expect(source).toContain('readSignalRoomDiscussionCount');
      expect(source).toContain('RoomEvent.Timeline');
      expect(source).toContain('reachesRoomStart');
    }
    expect(chatRoomSource).not.toContain('messages.length,\n    slug');
    expect(panelSource).toContain('pageSize: 50, maxBatches: 4');
    expect(panelSource).toContain("chatModeRef.current === 'coherence'");
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
