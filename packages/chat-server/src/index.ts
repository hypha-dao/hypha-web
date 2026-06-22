import 'server-only';

export {
  chatRequestSchema,
  onboardingConversationContextSchema,
} from './request-schema';
export type { ChatRequestPayload } from './request-schema';
export { verifyPrivyAuthToken } from './privy-auth';
export {
  createChatStreamResult,
  isAbortLikeError,
  MISSING_OPENROUTER_KEY_MESSAGE,
  OPENROUTER_DEBUG,
} from './stream-chat';
export {
  buildSystemPrompt,
  buildOnboardingRealtimeInstructions,
  sanitizeSlug,
} from './system-prompt';
export type { OnboardingRealtimeInstructionsInput } from './system-prompt';
export {
  createChatTools,
  getSpaceBySlugTool,
  createGetEcosystemBySpaceSlugTool,
  createGetPeopleBySpaceSlugTool,
  createGetSignalsBySpaceSlugTool,
  createCreateSpaceSignalBySlugTool,
  createRelayEcosystemSignalTool,
  createGetOrgMemoryBySpaceSlugTool,
  createSummarizeSpaceDiscussionTool,
  createIngestSpaceCallArtifactsTool,
} from './tools/index';
export type { ChatRouteTool } from './tools/types';
export {
  realtimeVoiceSessionRequestSchema,
  assertVoiceDiscoverySessionContext,
  RealtimeVoiceSessionContextError,
} from './voice-realtime/request-schema';
export type { RealtimeVoiceSessionRequest } from './voice-realtime/request-schema';
export {
  createRealtimeVoiceSession,
  MISSING_OPENAI_KEY_MESSAGE,
  RealtimeVoiceSessionError,
} from './voice-realtime/session';
export type {
  RealtimeVoiceSessionResult,
  RealtimeVoiceSessionErrorCode,
} from './voice-realtime/session';
