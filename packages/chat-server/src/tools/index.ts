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
import { createGetNetworkEcosystemPatternsTool } from './get-network-ecosystem-patterns';
import { createProposeOrganisationBlueprintTool } from './propose-organisation-blueprint';
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

type OnboardingActivationMethodContext = 'sandbox' | 'pilot' | 'deployment';

function extractActivationMethodFromContext(
  conversationContext?: unknown,
): OnboardingActivationMethodContext | undefined {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return undefined;
  }
  const raw = (conversationContext as { activationMethod?: unknown })
    .activationMethod;
  if (raw === 'sandbox' || raw === 'pilot' || raw === 'deployment') {
    return raw;
  }
  return undefined;
}

function activationMethodToFlags(
  method: OnboardingActivationMethodContext,
): Array<'sandbox' | 'demo' | 'archived'> {
  switch (method) {
    case 'sandbox':
      return ['sandbox'];
    case 'pilot':
      return ['demo'];
    case 'deployment':
      return [];
  }
}

function withInjectedOnboardingActivationMethod<
  T extends Record<string, unknown>,
>(payload: T, activationMethod?: OnboardingActivationMethodContext): T {
  if (!activationMethod) {
    return payload;
  }
  if (Array.isArray(payload.flags) && payload.flags.length > 0) {
    return payload;
  }
  return {
    ...payload,
    flags: activationMethodToFlags(activationMethod),
  };
}

type OnboardingTransparencyMatrixContext = {
  discoverability: number;
  access: number;
};

function extractTransparencyMatrixFromContext(
  conversationContext?: unknown,
): OnboardingTransparencyMatrixContext | undefined {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return undefined;
  }
  const raw = (conversationContext as { transparencyMatrix?: unknown })
    .transparencyMatrix;
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Partial<OnboardingTransparencyMatrixContext>;
  if (
    typeof candidate.discoverability !== 'number' ||
    candidate.discoverability < 0 ||
    candidate.discoverability > 3 ||
    typeof candidate.access !== 'number' ||
    candidate.access < 0 ||
    candidate.access > 3
  ) {
    return undefined;
  }
  return {
    discoverability: candidate.discoverability,
    access: candidate.access,
  };
}

function withInjectedOnboardingTransparencyMatrix<
  T extends Record<string, unknown>,
>(payload: T, transparencyMatrix?: OnboardingTransparencyMatrixContext): T {
  if (!transparencyMatrix) {
    return payload;
  }
  return {
    ...payload,
    ...(payload.discoverability === undefined
      ? { discoverability: transparencyMatrix.discoverability }
      : {}),
    ...(payload.access === undefined
      ? { access: transparencyMatrix.access }
      : {}),
  };
}

function withInjectedOnboardingEntryMethod<T extends Record<string, unknown>>(
  payload: T,
  entryMethod?: OnboardingEntryMethodContext,
): T {
  if (!entryMethod) {
    return payload;
  }
  if (payload.join_method !== undefined) {
    return payload;
  }
  const joinMethod =
    entryMethod === 'open_access' ? 0 : entryMethod === 'token_based' ? 1 : 2;
  return { ...payload, join_method: joinMethod };
}

type OnboardingEntryMethodContext =
  | 'open_access'
  | 'invite_only'
  | 'token_based';

function extractEntryMethodFromContext(
  conversationContext?: unknown,
): OnboardingEntryMethodContext | undefined {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return undefined;
  }
  const raw = (conversationContext as { entryMethod?: unknown }).entryMethod;
  if (raw === 'open_access' || raw === 'invite_only' || raw === 'token_based') {
    return raw;
  }
  return undefined;
}

function extractSetupJourneyFromContext(
  conversationContext?: unknown,
): 'single_space' | 'ecosystem' | undefined {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return undefined;
  }
  const raw = (conversationContext as { setupJourney?: unknown }).setupJourney;
  if (raw === 'single_space' || raw === 'ecosystem') {
    return raw;
  }
  return undefined;
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
  const contextActivationMethod =
    extractActivationMethodFromContext(conversationContext);
  const contextTransparencyMatrix =
    extractTransparencyMatrixFromContext(conversationContext);
  const contextSetupJourney =
    extractSetupJourneyFromContext(conversationContext);
  const contextEntryMethod = extractEntryMethodFromContext(conversationContext);

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
  const onboardingGuidanceTool = createOnboardingGuidanceTool();
  const onboardingGuidanceWithContext = {
    ...onboardingGuidanceTool,
    execute: async (args: unknown) => {
      const payload =
        args && typeof args === 'object'
          ? (args as Record<string, unknown>)
          : {};
      const knownAnswers = {
        ...((payload.known_answers as Record<string, unknown> | undefined) ??
          {}),
      };
      if (contextSetupJourney && knownAnswers.setup_journey == null) {
        knownAnswers.setup_journey = contextSetupJourney;
      }
      if (contextActivationMethod && knownAnswers.activation_method == null) {
        knownAnswers.activation_method = contextActivationMethod;
      }
      if (
        contextTransparencyMatrix &&
        knownAnswers.transparency_matrix == null
      ) {
        knownAnswers.transparency_matrix = contextTransparencyMatrix;
      }
      if (contextSpaceLocation && knownAnswers.space_location == null) {
        knownAnswers.space_location = contextSpaceLocation;
      }
      if (contextEntryMethod && knownAnswers.entry_method == null) {
        knownAnswers.entry_method = contextEntryMethod;
      }
      return onboardingGuidanceTool.execute({
        ...payload,
        known_answers: knownAnswers,
      } as Parameters<typeof onboardingGuidanceTool.execute>[0]);
    },
  };

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
      onboardingGuidanceWithContext,
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
    get_network_ecosystem_patterns: safeTool(
      'get_network_ecosystem_patterns',
      createGetNetworkEcosystemPatternsTool(),
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
              withInjectedOnboardingActivationMethod(
                withInjectedOnboardingTransparencyMatrix(
                  withInjectedOnboardingEntryMethod(
                    withInjectedOnboardingContext(
                      args,
                      onboardingInjectionContext,
                    ),
                    contextEntryMethod,
                  ),
                  contextTransparencyMatrix,
                ),
                contextActivationMethod,
              ),
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
    tools.propose_organisation_blueprint = safeTool(
      'propose_organisation_blueprint',
      createProposeOrganisationBlueprintTool(),
    );
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
export { createGetNetworkEcosystemPatternsTool } from './get-network-ecosystem-patterns';
export { createProposeOrganisationBlueprintTool } from './propose-organisation-blueprint';
export { createMcpNavigationTool } from './mcp-navigation';
export { createOnboardingGuidanceTool } from './onboarding-guidance';
export { createSearchSpacesTool } from './search-spaces';
export { webSearchTool } from './web-search';
export type { ChatRouteTool } from './types';
