/** Zoom-style in-call reaction catalog (WCUX-REACT-4). */

/** “Send with effect” — larger floating animation on tiles. */
export const CALL_SEND_WITH_EFFECT_EMOJIS = [
  '🎈',
  '🚀',
  '👍',
  '😂',
  '🎉',
] as const;

/** Standard reaction row (same set as legacy quick reactions). */
export const CALL_STANDARD_REACTION_EMOJIS = [
  '👏',
  '👍',
  '❤️',
  '😂',
  '😮',
] as const;

export type CallFeedbackReactionId =
  | 'yes'
  | 'no'
  | 'slower'
  | 'faster'
  | 'away';

export type CallFeedbackReaction = {
  id: CallFeedbackReactionId;
  emoji: string;
};

/** Meeting feedback — sent as `m.reaction` keys (valid Unicode emoji). */
export const CALL_FEEDBACK_REACTIONS: readonly CallFeedbackReaction[] = [
  { id: 'yes', emoji: '✅' },
  { id: 'no', emoji: '❌' },
  { id: 'slower', emoji: '⏪' },
  { id: 'faster', emoji: '⏩' },
  { id: 'away', emoji: '☕' },
] as const;

/** “Be right back” — floating status-style reaction. */
export const CALL_BE_RIGHT_BACK_EMOJI = '⏳';

export type CallFloatingReactionStyle = 'default' | 'effect';
