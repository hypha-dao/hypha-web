import type { ChatRouteTool } from './types';
import { getSpaceBySlugTool } from './get-space-by-slug';
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
import { webSearchTool } from './web-search';
import { createCreateSpaceFromOnboardingTool } from './create-space-from-onboarding';
import { createUpdateSpaceSettingsTool } from './update-space-settings';
import { createCreateSpaceSetupProposalTool } from './create-space-setup-proposal';
import { createCreateEcosystemSpaceTool } from './create-ecosystem-space';
import { createGenerateEcosystemBlueprintTool } from './generate-ecosystem-blueprint';

type SetupPhase = 'discover' | 'draft' | 'confirm' | 'execute' | 'verify';

function inferSetupPhase(context: unknown): SetupPhase {
  if (!context || typeof context !== 'object') return 'discover';
  const phase = (context as { setupPhase?: unknown }).setupPhase;
  return phase === 'discover' ||
    phase === 'draft' ||
    phase === 'confirm' ||
    phase === 'execute' ||
    phase === 'verify'
    ? phase
    : 'discover';
}

function withInjectedOnboardingLastUserText<T extends Record<string, unknown>>(
  payload: T,
  setupPhase: SetupPhase,
  onboardingLastUserText?: string,
): T & { onboarding_last_user_text?: string } {
  if (setupPhase === 'confirm' || setupPhase === 'execute') {
    return {
      ...payload,
      onboarding_last_user_text: onboardingLastUserText,
    };
  }
  return payload;
}

function safeTool(toolName: string, tool: ChatRouteTool): ChatRouteTool {
  const originalExecute = tool.execute as (
    ...args: unknown[]
  ) => Promise<unknown>;
  return {
    ...tool,
    execute: async (...args: unknown[]) => {
      try {
        return await originalExecute(...args);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unexpected tool error';
        return {
          ok: false,
          error: `Tool "${toolName}" failed: ${message}`,
        };
      }
    },
  };
}

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
): Record<string, ChatRouteTool> {
  const setupPhase = inferSetupPhase(conversationContext);
  const onboardingLastUserText =
    conversationContext &&
    typeof conversationContext === 'object' &&
    'lastUserText' in conversationContext &&
    typeof (conversationContext as { lastUserText?: unknown }).lastUserText ===
      'string'
      ? (conversationContext as { lastUserText: string }).lastUserText
      : undefined;

  const createSpaceFromOnboardingTool =
    createCreateSpaceFromOnboardingTool(authToken);
  const updateSpaceSettingsTool = createUpdateSpaceSettingsTool(authToken);
  const createSpaceSetupProposalTool =
    createCreateSpaceSetupProposalTool(authToken);
  const createEcosystemSpaceTool = createCreateEcosystemSpaceTool(authToken);
  const generateEcosystemBlueprintTool = createGenerateEcosystemBlueprintTool();

  const tools: Record<string, ChatRouteTool> = {
    get_space_by_slug: safeTool('get_space_by_slug', getSpaceBySlugTool),
    get_ecosystem_by_space_slug: safeTool(
      'get_ecosystem_by_space_slug',
      createGetEcosystemBySpaceSlugTool(authToken),
    ),
    get_people_by_space_slug: safeTool(
      'get_people_by_space_slug',
      createGetPeopleBySpaceSlugTool(authToken),
    ),
    get_signals_by_space_slug: safeTool(
      'get_signals_by_space_slug',
      createGetSignalsBySpaceSlugTool(authToken),
    ),
    create_space_signal_by_slug: safeTool(
      'create_space_signal_by_slug',
      createCreateSpaceSignalBySlugTool(authToken),
    ),
    relay_ecosystem_signal: safeTool(
      'relay_ecosystem_signal',
      createRelayEcosystemSignalTool(authToken),
    ),
    get_org_memory_by_space_slug: safeTool(
      'get_org_memory_by_space_slug',
      createGetOrgMemoryBySpaceSlugTool(authToken, requestUrlForSessionMatrix),
    ),
    fetch_org_memory_asset: safeTool(
      'fetch_org_memory_asset',
      createFetchOrgMemoryAssetTool(
        authToken,
        requestUrlForSessionMatrix,
      ) as unknown as ChatRouteTool,
    ),
    get_documents_by_space_slug: safeTool(
      'get_documents_by_space_slug',
      createGetDocumentsBySpaceSlugTool(authToken),
    ),
    get_token_holdings_by_space_slug: safeTool(
      'get_token_holdings_by_space_slug',
      createGetTokenHoldingsBySpaceSlugTool(authToken),
    ),
    summarize_space_discussion_by_slug: safeTool(
      'summarize_space_discussion_by_slug',
      createSummarizeSpaceDiscussionTool(authToken, requestUrlForSessionMatrix),
    ),
    ingest_space_call_artifacts: safeTool(
      'ingest_space_call_artifacts',
      createIngestSpaceCallArtifactsTool(authToken),
    ),
    web_search: safeTool('web_search', webSearchTool),
  };
  if (featureGates?.onboardingWriteToolsEnabled !== false) {
    tools.create_space_from_onboarding = safeTool(
      'create_space_from_onboarding',
      {
        ...createSpaceFromOnboardingTool,
        execute: async (args) =>
          createSpaceFromOnboardingTool.execute(
            withInjectedOnboardingLastUserText(
              args,
              setupPhase,
              onboardingLastUserText,
            ),
          ),
      },
    );
    tools.update_space_settings = safeTool('update_space_settings', {
      ...updateSpaceSettingsTool,
      execute: async (args) =>
        updateSpaceSettingsTool.execute(
          withInjectedOnboardingLastUserText(
            args,
            setupPhase,
            onboardingLastUserText,
          ),
        ),
    });
    tools.create_space_setup_proposal = safeTool(
      'create_space_setup_proposal',
      {
        ...createSpaceSetupProposalTool,
        execute: async (args) =>
          createSpaceSetupProposalTool.execute(
            withInjectedOnboardingLastUserText(
              args,
              setupPhase,
              onboardingLastUserText,
            ),
          ),
      },
    );
  }
  if (featureGates?.ecosystemAutomationEnabled !== false) {
    tools.generate_ecosystem_blueprint = safeTool(
      'generate_ecosystem_blueprint',
      generateEcosystemBlueprintTool,
    );
    tools.create_ecosystem_space = safeTool('create_ecosystem_space', {
      ...createEcosystemSpaceTool,
      execute: async (args) =>
        createEcosystemSpaceTool.execute(
          withInjectedOnboardingLastUserText(
            args,
            setupPhase,
            onboardingLastUserText,
          ),
        ),
    });
  }
  return tools;
}

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
export { createCreateSpaceFromOnboardingTool } from './create-space-from-onboarding';
export { createUpdateSpaceSettingsTool } from './update-space-settings';
export { createCreateSpaceSetupProposalTool } from './create-space-setup-proposal';
export { createCreateEcosystemSpaceTool } from './create-ecosystem-space';
export { createGenerateEcosystemBlueprintTool } from './generate-ecosystem-blueprint';
export { webSearchTool } from './web-search';
export type { ChatRouteTool } from './types';
