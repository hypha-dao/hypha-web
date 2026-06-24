export type InferredVotingMethod = '1m1v' | '1v1v' | '1t1v';

const ONE_MEMBER_PATTERN =
  /\b(?:1m1v|one member(?:\s+one vote|\s+1 vote)?|one person one vote|1 member 1 vote|member.{0,12}one vote)\b/i;
const ONE_VOICE_PATTERN =
  /\b(?:1v1v|one voice(?:\s+one vote|\s+token)?|voice.{0,12}weighted|voice token)\b/i;
const ONE_TOKEN_PATTERN =
  /\b(?:1t1v|one token(?:\s+one vote)?|token.{0,12}weighted)\b/i;

const VOTING_METHOD_DISCUSSION_PATTERN =
  /\b(?:one member|one person one vote|one voice|one token|voice.?weighted|token.?weighted|how (?:this|your|the) space makes decisions|decision.?making|voting model|governance proposal for (?:this|the) voting)\b/i;

export function inferVotingMethodFromText(
  text: string | null | undefined,
): InferredVotingMethod | undefined {
  if (!text?.trim()) return undefined;
  if (ONE_TOKEN_PATTERN.test(text)) return '1t1v';
  if (ONE_VOICE_PATTERN.test(text)) return '1v1v';
  if (ONE_MEMBER_PATTERN.test(text)) return '1m1v';
  return undefined;
}

export function isVotingMethodDiscussionText(
  text: string | null | undefined,
): boolean {
  if (!text?.trim()) return false;
  return VOTING_METHOD_DISCUSSION_PATTERN.test(text);
}

export function isPlainConfirmationReply(
  text: string | null | undefined,
): boolean {
  if (!text?.trim()) return false;
  const normalized = text.trim().toLowerCase();
  const normalizedCompact = normalized
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^confirm\b/.test(normalizedCompact)) return true;
  if (
    /^(yes|yep|yeah|sure|ok|okay|sounds good|go ahead|proceed|do it)\b/.test(
      normalizedCompact,
    )
  ) {
    return true;
  }
  return false;
}

export function inferVotingMethodFromConversation(args: {
  userText: string | null | undefined;
  assistantText?: string | null | undefined;
}): InferredVotingMethod | undefined {
  const fromUser = inferVotingMethodFromText(args.userText);
  if (fromUser) return fromUser;

  if (!isPlainConfirmationReply(args.userText)) return undefined;
  return inferVotingMethodFromText(args.assistantText);
}

export function shouldOpenVotingMethodProposalFromConversation(args: {
  userText: string | null | undefined;
  assistantText?: string | null | undefined;
  votingMethodAlreadySet?: boolean;
}): boolean {
  if (args.votingMethodAlreadySet) return false;
  const inferredMethod = inferVotingMethodFromConversation(args);
  if (!inferredMethod) return false;

  if (inferVotingMethodFromText(args.userText)) return true;
  if (!isPlainConfirmationReply(args.userText)) return false;
  return isVotingMethodDiscussionText(args.assistantText);
}

export function buildPostCreateVotingMethodDirective(args: {
  userText: string | null | undefined;
  assistantText?: string | null | undefined;
  spaceSlug?: string | null;
  votingMethodAlreadySet?: boolean;
}): string | null {
  if (args.votingMethodAlreadySet || !args.spaceSlug?.trim()) return null;

  const inferredMethod = inferVotingMethodFromConversation(args);
  if (!inferredMethod) return null;

  const explicitChoice = inferVotingMethodFromText(args.userText);
  const confirmedAfterDiscussion =
    isPlainConfirmationReply(args.userText) &&
    isVotingMethodDiscussionText(args.assistantText);

  if (!explicitChoice && !confirmedAfterDiscussion) return null;

  return [
    'CRITICAL — user accepted a voting method choice.',
    `Call prepare_governance_proposal in this turn with proposal_type change_voting_method, space_slug "${args.spaceSlug.trim()}", partial: true, voting_method: "${inferredMethod}", focus_field: voting_method, and draft title/description from context.`,
    'Do NOT ask "shall I proceed", "does this sound good", or any further confirmation.',
    'Tell them briefly the Agreements form is open — they can review and click Publish.',
  ].join(' ');
}
