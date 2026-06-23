import type { ChatRouteTool } from './types';
import { createGetPeopleBySpaceSlugTool } from './get-people-by-space-slug';
import { createGetEcosystemBySpaceSlugTool } from './get-ecosystem-by-space-slug';
import { createGetSignalsBySpaceSlugTool } from './get-signals-by-space-slug';
import { createCreateSpaceSignalBySlugTool } from './create-space-signal-by-slug';
import { createRelayEcosystemSignalTool } from './relay-ecosystem-signal';
import { createGetOrgMemoryBySpaceSlugTool } from './get-org-memory-by-space-slug';
import { createFetchOrgMemoryAssetTool } from './fetch-org-memory-asset';
import { createGetDocumentsBySpaceSlugTool } from './get-documents-by-space-slug';
import { createGetTokenHoldingsBySpaceSlugTool } from './get-token-holdings-by-space-slug';
import { createSummarizeSpaceDiscussionTool } from './summarize-space-discussion';
import { createIngestSpaceCallArtifactsTool } from './ingest-space-call-artifacts';
import { createHumanChatMessageTool } from './create-human-chat-message';
import { webSearchTool } from './web-search';
import { createOnboardingToolSet, safeChatTool } from './onboarding-tool-set';

/**
 * All AI SDK tools exposed by the chat route. Add new tools here and in the
 * system prompt so the model stays aligned with available capabilities.
 */
export function createChatTools(
  authToken: string,
  requestUrlForSessionMatrix?: string,
  conversationContext?: unknown,
  featureGates?: {
    onboardingWriteToolsEnabled?: boolean;
    ecosystemAutomationEnabled?: boolean;
  },
  lastUserTextFromRequest?: string | null,
  recentUserTextsFromRequest?: string[],
): Record<string, ChatRouteTool> {
  const onboardingTools = createOnboardingToolSet({
    authToken,
    conversationContext,
    featureGates,
    lastUserTextFromRequest,
    recentUserTextsFromRequest,
  });

  return {
    get_ecosystem_by_space_slug: safeChatTool(
      'get_ecosystem_by_space_slug',
      createGetEcosystemBySpaceSlugTool(authToken),
    ),
    get_people_by_space_slug: safeChatTool(
      'get_people_by_space_slug',
      createGetPeopleBySpaceSlugTool(authToken),
    ),
    get_signals_by_space_slug: safeChatTool(
      'get_signals_by_space_slug',
      createGetSignalsBySpaceSlugTool(authToken),
    ),
    create_space_signal_by_slug: safeChatTool(
      'create_space_signal_by_slug',
      createCreateSpaceSignalBySlugTool(authToken),
    ),
    relay_ecosystem_signal: safeChatTool(
      'relay_ecosystem_signal',
      createRelayEcosystemSignalTool(authToken),
    ),
    get_org_memory_by_space_slug: safeChatTool(
      'get_org_memory_by_space_slug',
      createGetOrgMemoryBySpaceSlugTool(authToken, requestUrlForSessionMatrix),
    ),
    fetch_org_memory_asset: safeChatTool(
      'fetch_org_memory_asset',
      createFetchOrgMemoryAssetTool(
        authToken,
        requestUrlForSessionMatrix,
      ) as unknown as ChatRouteTool,
    ),
    get_documents_by_space_slug: safeChatTool(
      'get_documents_by_space_slug',
      createGetDocumentsBySpaceSlugTool(authToken),
    ),
    get_token_holdings_by_space_slug: safeChatTool(
      'get_token_holdings_by_space_slug',
      createGetTokenHoldingsBySpaceSlugTool(authToken),
    ),
    summarize_space_discussion_by_slug: safeChatTool(
      'summarize_space_discussion_by_slug',
      createSummarizeSpaceDiscussionTool(authToken, requestUrlForSessionMatrix),
    ),
    ingest_space_call_artifacts: safeChatTool(
      'ingest_space_call_artifacts',
      createIngestSpaceCallArtifactsTool(authToken),
    ),
    create_human_chat_message: safeChatTool(
      'create_human_chat_message',
      createHumanChatMessageTool(authToken, requestUrlForSessionMatrix),
    ),
    web_search: safeChatTool('web_search', webSearchTool),
    ...onboardingTools,
  };
}

export {
  createOnboardingToolSet,
  ONBOARDING_REALTIME_TOOL_NAMES,
  safeChatTool,
} from './onboarding-tool-set';
export type { OnboardingToolConfig } from './onboarding-tool-set';
export { getSpaceBySlugTool } from './get-space-by-slug';
export { createGetEcosystemBySpaceSlugTool } from './get-ecosystem-by-space-slug';
export { createGetPeopleBySpaceSlugTool } from './get-people-by-space-slug';
export { createGetSignalsBySpaceSlugTool } from './get-signals-by-space-slug';
export { createCreateSpaceSignalBySlugTool } from './create-space-signal-by-slug';
export { createRelayEcosystemSignalTool } from './relay-ecosystem-signal';
export { createGetOrgMemoryBySpaceSlugTool } from './get-org-memory-by-space-slug';
export { createGetDocumentsBySpaceSlugTool } from './get-documents-by-space-slug';
export { createGetTokenHoldingsBySpaceSlugTool } from './get-token-holdings-by-space-slug';
export { createFetchOrgMemoryAssetTool } from './fetch-org-memory-asset';
export { createSummarizeSpaceDiscussionTool } from './summarize-space-discussion';
export { createIngestSpaceCallArtifactsTool } from './ingest-space-call-artifacts';
export { createHumanChatMessageTool } from './create-human-chat-message';
export { createCreateSpaceFromOnboardingTool } from './create-space-from-onboarding';
export { createUpdateSpaceSettingsTool } from './update-space-settings';
export { createCreateSpaceSetupProposalTool } from './create-space-setup-proposal';
export { createCreateEcosystemSpaceTool } from './create-ecosystem-space';
export { createGenerateEcosystemBlueprintTool } from './generate-ecosystem-blueprint';
export { createGetNetworkEcosystemPatternsTool } from './get-network-ecosystem-patterns';
export { createProposeOrganisationBlueprintTool } from './propose-organisation-blueprint';
export { createMcpNavigationTool } from './mcp-navigation';
export { createOnboardingGuidanceTool } from './onboarding-guidance';
export { createSearchSpacesTool } from './search-spaces';
export { webSearchTool } from './web-search';
export type { ChatRouteTool } from './types';
