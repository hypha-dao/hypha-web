import { isPlainConfirmationReply } from './confirmation-replies';

export type InferredVotingMethod = '1m1v' | '1v1v' | '1t1v';

export { isPlainConfirmationReply };

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
    'CRITICAL — user accepted a voting method choice during post-create setup.',
    `Call proposal_guidance(proposal_type: change_voting_method, collected_fields: { voting_method: "${inferredMethod}" }) first — title/description come first in form order.`,
    `Offer a drafted title silently (next_question). On acceptance call prepare_governance_proposal with partial: true, space_slug "${args.spaceSlug.trim()}", merge all collected fields plus on-chain defaults for quorum/unity/voting period.`,
    'Do NOT ask "shall I proceed" or tell the user to Publish until ready_to_publish.',
    'Never claim the space has no proposals — you are opening the draft form now.',
  ].join(' ');
}
