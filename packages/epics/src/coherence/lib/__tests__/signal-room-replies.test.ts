import { describe, expect, it } from 'vitest';
import {
  signalLastReplierLabel,
  summarizeSignalReplies,
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
