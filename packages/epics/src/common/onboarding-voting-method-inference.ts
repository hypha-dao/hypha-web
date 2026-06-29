'use client';

import type { OnboardingVotingMethod } from './onboarding-voting-method-ui';
import { isPlainOnboardingConfirmationReply } from './ai-onboarding-context';

const ONE_MEMBER_PATTERN =
  /\b(?:1m1v|one member(?:\s+one vote|\s+1 vote)?|one person one vote|1 member 1 vote|member.{0,12}one vote)\b/i;
const ONE_VOICE_PATTERN =
  /\b(?:1v1v|one voice(?:\s+one vote|\s+token)?|voice.{0,12}weighted|voice token)\b/i;
const ONE_TOKEN_PATTERN =
  /\b(?:1t1v|one token(?:\s+one vote)?|token.{0,12}weighted)\b/i;

const VOTING_METHOD_DISCUSSION_PATTERN =
  /\b(?:one member|one person one vote|one voice|one token|voice.?weighted|token.?weighted|how (?:this|your|the) space makes decisions|decision.?making|voting model|governance proposal for (?:this|the) voting)\b/i;

export function inferOnboardingVotingMethodFromText(
  text: string | null | undefined,
): OnboardingVotingMethod | undefined {
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

export function inferOnboardingVotingMethodFromConversation(args: {
  userText: string;
  assistantText?: string | null;
}): OnboardingVotingMethod | undefined {
  const fromUser = inferOnboardingVotingMethodFromText(args.userText);
  if (fromUser) return fromUser;

  if (!isPlainOnboardingConfirmationReply(args.userText)) return undefined;
  return inferOnboardingVotingMethodFromText(args.assistantText);
}

export function shouldOpenOnboardingVotingMethodProposal(args: {
  userText: string;
  assistantText?: string | null;
  votingMethodAlreadySet?: boolean;
}): boolean {
  if (args.votingMethodAlreadySet) return false;
  const inferred = inferOnboardingVotingMethodFromConversation(args);
  if (!inferred) return false;
  if (inferOnboardingVotingMethodFromText(args.userText)) return true;
  if (!isPlainOnboardingConfirmationReply(args.userText)) return false;
  return isVotingMethodDiscussionText(args.assistantText);
}
