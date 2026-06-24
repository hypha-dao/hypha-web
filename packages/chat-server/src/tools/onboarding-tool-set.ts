import type { CreateSpaceFromOnboardingInput } from './create-space-from-onboarding';
import { createUpdateSpaceSettingsTool } from './update-space-settings';
import { createCreateSpaceSetupProposalTool } from './create-space-setup-proposal';
import { createCreateEcosystemSpaceTool } from './create-ecosystem-space';
import { createGenerateEcosystemBlueprintTool } from './generate-ecosystem-blueprint';
import { createGetNetworkEcosystemPatternsTool } from './get-network-ecosystem-patterns';
import { createProposeOrganisationBlueprintTool } from './propose-organisation-blueprint';
import { createMcpNavigationTool } from './mcp-navigation';
import { createOnboardingGuidanceTool } from './onboarding-guidance';
import { createSearchSpacesTool } from './search-spaces';
import { webSearchTool } from './web-search';
import { createGenerateSpaceVisualAssetsTool } from './generate-space-visual-assets';
import { createGeocodeSpaceLocationTool } from './geocode-space-location';
import { getSpaceBySlugTool } from './get-space-by-slug';
import type { ChatRouteTool } from './types';
import { createCreateSpaceFromOnboardingTool } from './create-space-from-onboarding';

export type OnboardingToolFeatureGates = {
  onboardingWriteToolsEnabled?: boolean;
  ecosystemAutomationEnabled?: boolean;
};

export type OnboardingToolConfig = {
  authToken: string;
  conversationContext?: unknown;
  featureGates?: OnboardingToolFeatureGates;
  lastUserTextFromRequest?: string | null;
  recentUserTextsFromRequest?: string[];
};

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

type OnboardingVisualAssetsContext = {
  logoUrl: string;
  leadImageUrl: string;
};

function extractVisualAssetsFromContext(
  conversationContext?: unknown,
): OnboardingVisualAssetsContext | undefined {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return undefined;
  }
  const raw = (conversationContext as { visualAssets?: unknown }).visualAssets;
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Partial<OnboardingVisualAssetsContext>;
  if (
    typeof candidate.logoUrl !== 'string' ||
    typeof candidate.leadImageUrl !== 'string' ||
    !/^https?:\/\//i.test(candidate.logoUrl.trim()) ||
    !/^https?:\/\//i.test(candidate.leadImageUrl.trim())
  ) {
    return undefined;
  }
  return {
    logoUrl: candidate.logoUrl.trim(),
    leadImageUrl: candidate.leadImageUrl.trim(),
  };
}

function withInjectedOnboardingVisualAssets<T extends Record<string, unknown>>(
  payload: T,
  visualAssets?: OnboardingVisualAssetsContext,
): T {
  if (!visualAssets) {
    return payload;
  }
  return {
    ...payload,
    ...(typeof payload.logo_url !== 'string' || !payload.logo_url.trim()
      ? { logo_url: visualAssets.logoUrl }
      : {}),
    ...(typeof payload.lead_image_url !== 'string' ||
    !payload.lead_image_url.trim()
      ? { lead_image_url: visualAssets.leadImageUrl }
      : {}),
  };
}

function extractPendingTransparencyDiscoverabilityFromContext(
  conversationContext?: unknown,
): number | undefined {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return undefined;
  }
  const raw = (
    conversationContext as { pendingTransparencyDiscoverability?: unknown }
  ).pendingTransparencyDiscoverability;
  if (typeof raw !== 'number' || raw < 0 || raw > 3) {
    return undefined;
  }
  return raw;
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

function extractEcosystemBlueprintFromContext(
  conversationContext?: unknown,
): unknown[] | undefined {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return undefined;
  }
  const setupPlan = (
    conversationContext as { setupPlan?: { ecosystemBlueprint?: unknown } }
  ).setupPlan;
  const blueprint = setupPlan?.ecosystemBlueprint;
  if (!Array.isArray(blueprint) || blueprint.length === 0) {
    return undefined;
  }
  return blueprint;
}

export function safeChatTool(
  toolName: string,
  tool: ChatRouteTool,
): ChatRouteTool {
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

function resolveOnboardingInjectionContext(
  conversationContext: unknown | undefined,
  lastUserTextFromRequest?: string | null,
  recentUserTextsFromRequest?: string[],
) {
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

  return {
    effectiveLastUserText,
    onboardingInjectionContext: {
      lastUserText: effectiveLastUserText,
      recentUserTexts: recentUserTextsFromRequest,
      setupPhase: contextSetupPhase,
    },
    contextSpaceLocation: extractSpaceLocationFromContext(conversationContext),
    contextActivationMethod:
      extractActivationMethodFromContext(conversationContext),
    contextTransparencyMatrix:
      extractTransparencyMatrixFromContext(conversationContext),
    contextPendingTransparencyDiscoverability:
      extractPendingTransparencyDiscoverabilityFromContext(conversationContext),
    contextSetupJourney: extractSetupJourneyFromContext(conversationContext),
    contextEntryMethod: extractEntryMethodFromContext(conversationContext),
    contextVisualAssets: extractVisualAssetsFromContext(conversationContext),
    contextEcosystemBlueprint:
      extractEcosystemBlueprintFromContext(conversationContext),
  };
}

/**
 * Onboarding + space-setup tools shared by `/api/chat` and voice Realtime.
 */
export function createOnboardingToolSet(
  config: OnboardingToolConfig,
): Record<string, ChatRouteTool> {
  const {
    authToken,
    conversationContext,
    featureGates,
    lastUserTextFromRequest,
    recentUserTextsFromRequest,
  } = config;

  const {
    effectiveLastUserText,
    onboardingInjectionContext,
    contextSpaceLocation,
    contextActivationMethod,
    contextTransparencyMatrix,
    contextPendingTransparencyDiscoverability,
    contextSetupJourney,
    contextEntryMethod,
    contextVisualAssets,
    contextEcosystemBlueprint,
  } = resolveOnboardingInjectionContext(
    conversationContext,
    lastUserTextFromRequest,
    recentUserTextsFromRequest,
  );

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
      if (contextTransparencyMatrix) {
        if (knownAnswers.transparency_discoverability == null) {
          knownAnswers.transparency_discoverability =
            contextTransparencyMatrix.discoverability;
        }
        if (knownAnswers.transparency_activity_access == null) {
          knownAnswers.transparency_activity_access =
            contextTransparencyMatrix.access;
        }
        if (knownAnswers.transparency_matrix == null) {
          knownAnswers.transparency_matrix = contextTransparencyMatrix;
        }
      } else if (
        contextPendingTransparencyDiscoverability != null &&
        knownAnswers.transparency_discoverability == null
      ) {
        knownAnswers.transparency_discoverability =
          contextPendingTransparencyDiscoverability;
      }
      if (contextSpaceLocation && knownAnswers.space_location == null) {
        knownAnswers.space_location = contextSpaceLocation;
      }
      if (contextEntryMethod && knownAnswers.entry_method == null) {
        knownAnswers.entry_method = contextEntryMethod;
      }
      if (contextEcosystemBlueprint?.length) {
        knownAnswers.ecosystem_blueprint_proposed = true;
        if (knownAnswers.ecosystem_blueprint == null) {
          knownAnswers.ecosystem_blueprint = contextEcosystemBlueprint;
        }
      }
      return onboardingGuidanceTool.execute({
        ...payload,
        known_answers: knownAnswers,
      } as Parameters<typeof onboardingGuidanceTool.execute>[0]);
    },
  };

  const tools: Record<string, ChatRouteTool> = {
    get_space_by_slug: safeChatTool('get_space_by_slug', getSpaceBySlugTool),
    search_spaces: safeChatTool('search_spaces', createSearchSpacesTool()),
    web_search: safeChatTool('web_search', webSearchTool),
    onboarding_guidance: safeChatTool(
      'onboarding_guidance',
      onboardingGuidanceWithContext,
    ),
    mcp_navigation: safeChatTool(
      'mcp_navigation',
      createMcpNavigationTool(authToken),
    ),
    generate_space_visual_assets: safeChatTool(
      'generate_space_visual_assets',
      createGenerateSpaceVisualAssetsTool(),
    ),
    geocode_space_location: safeChatTool(
      'geocode_space_location',
      createGeocodeSpaceLocationTool(),
    ),
    get_network_ecosystem_patterns: safeChatTool(
      'get_network_ecosystem_patterns',
      createGetNetworkEcosystemPatternsTool(),
    ),
  };

  if (featureGates?.onboardingWriteToolsEnabled !== false) {
    tools.create_space_from_onboarding = safeChatTool(
      'create_space_from_onboarding',
      {
        ...createSpaceFromOnboardingTool,
        execute: async (args) =>
          createSpaceFromOnboardingTool.execute(
            withInjectedOnboardingSpaceLocation(
              withInjectedOnboardingActivationMethod(
                withInjectedOnboardingTransparencyMatrix(
                  withInjectedOnboardingEntryMethod(
                    withInjectedOnboardingVisualAssets(
                      withInjectedOnboardingContext(
                        args as Record<string, unknown>,
                        onboardingInjectionContext,
                      ),
                      contextVisualAssets,
                    ),
                    contextEntryMethod,
                  ),
                  contextTransparencyMatrix,
                ),
                contextActivationMethod,
              ),
              contextSpaceLocation,
            ) as CreateSpaceFromOnboardingInput,
          ),
      },
    );
    tools.update_space_settings = safeChatTool('update_space_settings', {
      ...updateSpaceSettingsTool,
      execute: async (args) =>
        updateSpaceSettingsTool.execute(
          withInjectedOnboardingContext(args, onboardingInjectionContext),
        ),
    });
    tools.create_space_setup_proposal = safeChatTool(
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
    tools.propose_organisation_blueprint = safeChatTool(
      'propose_organisation_blueprint',
      createProposeOrganisationBlueprintTool(),
    );
    tools.generate_ecosystem_blueprint = safeChatTool(
      'generate_ecosystem_blueprint',
      generateEcosystemBlueprintTool,
    );
    tools.create_ecosystem_space = safeChatTool('create_ecosystem_space', {
      ...createEcosystemSpaceTool,
      execute: async (args) =>
        createEcosystemSpaceTool.execute(
          withInjectedOnboardingContext(args, onboardingInjectionContext),
        ),
    });
  }

  return tools;
}

export {
  ONBOARDING_REALTIME_TOOL_NAMES,
  pickOnboardingRealtimeTools,
} from './onboarding-realtime-tool-names';
export type { OnboardingRealtimeToolName } from './onboarding-realtime-tool-names';
