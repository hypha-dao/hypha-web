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
import { createMcpNavigationTool } from './mcp-navigation';
import { createOnboardingGuidanceTool } from './onboarding-guidance';
import { createSearchSpacesTool } from './search-spaces';
import { createGenerateSpaceVisualAssetsTool } from './generate-space-visual-assets';
import { createGeocodeSpaceLocationTool } from './geocode-space-location';

function withInjectedOnboardingContext<T extends Record<string, unknown>>(
  payload: T,
  context: {
    lastUserText?: string;
    recentUserTexts?: string[];
    setupPhase?: string;
  },
): T & {
  onboarding_last_user_text?: string;
  onboarding_recent_user_texts?: string[];
  onboarding_setup_phase?: string;
} {
  return {
    ...payload,
    ...(context.lastUserText
      ? { onboarding_last_user_text: context.lastUserText }
      : {}),
    ...(context.recentUserTexts?.length
      ? { onboarding_recent_user_texts: context.recentUserTexts }
      : {}),
    ...(context.setupPhase
      ? { onboarding_setup_phase: context.setupPhase }
      : {}),
  };
}

type OnboardingSpaceLocationContext = {
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  locationSource: 'geocode' | 'manual' | 'map_click' | null;
  skipped?: boolean;
};

function extractSpaceLocationFromContext(
  conversationContext?: unknown,
): OnboardingSpaceLocationContext | undefined {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return undefined;
  }
  const raw = (conversationContext as { spaceLocation?: unknown })
    .spaceLocation;
  if (!raw || typeof raw !== 'object') return undefined;

  const candidate = raw as Partial<OnboardingSpaceLocationContext>;
  return {
    latitude:
      typeof candidate.latitude === 'number' ? candidate.latitude : null,
    longitude:
      typeof candidate.longitude === 'number' ? candidate.longitude : null,
    locationLabel:
      typeof candidate.locationLabel === 'string'
        ? candidate.locationLabel
        : candidate.locationLabel === null
        ? null
        : null,
    locationSource:
      candidate.locationSource === 'geocode' ||
      candidate.locationSource === 'manual' ||
      candidate.locationSource === 'map_click'
        ? candidate.locationSource
        : candidate.locationSource === null
        ? null
        : null,
    skipped: candidate.skipped === true,
  };
}

function withInjectedOnboardingSpaceLocation<T extends Record<string, unknown>>(
  payload: T,
  spaceLocation?: OnboardingSpaceLocationContext,
): T {
  if (
    !spaceLocation ||
    spaceLocation.skipped ||
    spaceLocation.latitude == null ||
    spaceLocation.longitude == null
  ) {
    return payload;
  }
  if (
    payload.latitude !== undefined ||
    payload.longitude !== undefined ||
    (typeof payload.location_query === 'string' &&
      payload.location_query.trim().length > 0)
  ) {
    return payload;
  }

  return {
    ...payload,
    latitude: spaceLocation.latitude,
    longitude: spaceLocation.longitude,
    ...(spaceLocation.locationLabel
      ? { location_label: spaceLocation.locationLabel }
      : {}),
    ...(spaceLocation.locationSource
      ? { location_source: spaceLocation.locationSource }
      : {}),
  };
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
  lastUserTextFromRequest?: string | null,
  recentUserTextsFromRequest?: string[],
): Record<string, ChatRouteTool> {
  const contextLastUserText =
    conversationContext &&
    typeof conversationContext === 'object' &&
    'lastUserText' in conversationContext &&
    typeof (conversationContext as { lastUserText?: unknown }).lastUserText ===
      'string'
      ? (conversationContext as { lastUserText: string }).lastUserText
      : undefined;
  const contextSetupPhase =
    conversationContext &&
    typeof conversationContext === 'object' &&
    'setupPhase' in conversationContext &&
    typeof (conversationContext as { setupPhase?: unknown }).setupPhase ===
      'string'
      ? (conversationContext as { setupPhase: string }).setupPhase
      : undefined;
  const effectiveLastUserText =
    lastUserTextFromRequest?.trim() || contextLastUserText?.trim() || undefined;
  const onboardingInjectionContext = {
    lastUserText: effectiveLastUserText,
    recentUserTexts: recentUserTextsFromRequest,
    setupPhase: contextSetupPhase,
  };
  const contextSpaceLocation =
    extractSpaceLocationFromContext(conversationContext);

  const createSpaceFromOnboardingTool =
    createCreateSpaceFromOnboardingTool(authToken);
  const updateSpaceSettingsTool = createUpdateSpaceSettingsTool(
    authToken,
    effectiveLastUserText,
  );
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
    search_spaces: safeTool('search_spaces', createSearchSpacesTool()),
    onboarding_guidance: safeTool(
      'onboarding_guidance',
      createOnboardingGuidanceTool(),
    ),
    mcp_navigation: safeTool(
      'mcp_navigation',
      createMcpNavigationTool(authToken),
    ),
    generate_space_visual_assets: safeTool(
      'generate_space_visual_assets',
      createGenerateSpaceVisualAssetsTool(),
    ),
    geocode_space_location: safeTool(
      'geocode_space_location',
      createGeocodeSpaceLocationTool(),
    ),
  };
  if (featureGates?.onboardingWriteToolsEnabled !== false) {
    tools.create_space_from_onboarding = safeTool(
      'create_space_from_onboarding',
      {
        ...createSpaceFromOnboardingTool,
        execute: async (args) =>
          createSpaceFromOnboardingTool.execute(
            withInjectedOnboardingSpaceLocation(
              withInjectedOnboardingContext(args, onboardingInjectionContext),
              contextSpaceLocation,
            ),
          ),
      },
    );
    tools.update_space_settings = safeTool('update_space_settings', {
      ...updateSpaceSettingsTool,
      execute: async (args) =>
        updateSpaceSettingsTool.execute(
          withInjectedOnboardingContext(args, onboardingInjectionContext),
        ),
    });
    tools.create_space_setup_proposal = safeTool(
      'create_space_setup_proposal',
      {
        ...createSpaceSetupProposalTool,
        execute: async (args) =>
          createSpaceSetupProposalTool.execute(
            withInjectedOnboardingContext(args, onboardingInjectionContext),
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
          withInjectedOnboardingContext(args, onboardingInjectionContext),
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
export { createMcpNavigationTool } from './mcp-navigation';
export { createOnboardingGuidanceTool } from './onboarding-guidance';
export { createSearchSpacesTool } from './search-spaces';
export { webSearchTool } from './web-search';
export type { ChatRouteTool } from './types';
