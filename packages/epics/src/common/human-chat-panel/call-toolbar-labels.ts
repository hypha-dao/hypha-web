export type CallToolbarLabelScope = 'room' | 'signal';

const ROOM_LABELS = {
  start: { audio: 'callAudio', video: 'callVideo' },
  join: { audio: 'callJoinWithAudio', video: 'callJoinWithVideo' },
} as const;

const SIGNAL_LABELS = {
  start: { audio: 'signalCallAudio', video: 'signalCallVideo' },
  join: { audio: 'signalCallJoinWithAudio', video: 'signalCallJoinWithVideo' },
} as const;

export type CallToolbarMessageKey =
  | (typeof ROOM_LABELS)['start']['audio']
  | (typeof ROOM_LABELS)['start']['video']
  | (typeof ROOM_LABELS)['join']['audio']
  | (typeof ROOM_LABELS)['join']['video']
  | (typeof SIGNAL_LABELS)['start']['audio']
  | (typeof SIGNAL_LABELS)['start']['video']
  | (typeof SIGNAL_LABELS)['join']['audio']
  | (typeof SIGNAL_LABELS)['join']['video'];

/**
 * Accessible names for the shared voice/video buttons. Signal threads use
 * their own copy. The default stays the room strings so space, DM, and group
 * chats keep the labels they already have.
 */
export function callToolbarButtonMessageKeys(
  scope: CallToolbarLabelScope = 'room',
  joining = false,
): { audio: CallToolbarMessageKey; video: CallToolbarMessageKey } {
  const labels = scope === 'signal' ? SIGNAL_LABELS : ROOM_LABELS;
  return joining ? labels.join : labels.start;
}
