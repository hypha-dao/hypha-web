import { z } from 'zod';
import {
  CATEGORY_GROUPS,
  expandCategoryGroups,
  inferCategoryGroupsFromText,
  type CategoryGroupId,
} from '@hypha-platform/core/server';
import type { ChatRouteTool } from './types';
import { createSearchSpacesTool } from './search-spaces';
import { isAnsweredActivationMethod } from './onboarding-activation-method';
import { isAnsweredLocationStep } from './onboarding-location';

const processSchema = z.enum([
  'create_space',
  'join_space',
  'configure_space',
  'deposit_funds',
  'navigate',
  'explore_network',
]);

const inputSchema = z.object({
  process: processSchema,
  user_goal: z.string().trim().min(1).max(500).optional(),
  space_slug: z.string().trim().min(1).max(128).optional(),
  known_answers: z.record(z.string(), z.unknown()).optional(),
});

type GuidanceStep = {
  field: string;
  question: string;
  requiredWhen?: (answers: Record<string, unknown>) => boolean;
  isAnswered?: (value: unknown, answers: Record<string, unknown>) => boolean;
};

type GuidanceDefinition = {
  steps: GuidanceStep[];
  validation_steps: string[];
  suggested_tools: string[];
};

function normalizeChoice(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function wantsGeneratedPlaceholders(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized.includes('placeholder') ||
    normalized.includes('generate') ||
    normalized.includes('create for me') ||
    normalized.includes('create them') ||
    normalized.includes("don't have") ||
    normalized.includes('do not have') ||
    normalized.includes('not yet') ||
    normalized.includes('no logo') ||
    normalized.includes('no banner') ||
    normalized === 'no' ||
    normalized === 'no assets' ||
    normalized === 'nope'
  );
}

function hasOwnAssets(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized.includes('i have') ||
    normalized.includes('upload') ||
    normalized.includes('use mine') ||
    normalized.includes('already have') ||
    normalized === 'yes' ||
    normalized === 'yep'
  );
}

function isAnsweredVisualAssetsChoice(value: unknown): boolean {
  return hasOwnAssets(value) || wantsGeneratedPlaceholders(value);
}

function isAnsweredVisualAssetsConfirmed(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized === 'yes' ||
    normalized.includes('looks good') ||
    normalized.includes('love it') ||
    normalized.includes('perfect') ||
    normalized.includes('confirm') ||
    normalized.includes('proceed') ||
    normalized.includes('use these')
  );
}

function buildVisualAssetsSteps(): GuidanceStep[] {
  return [
    {
      field: 'visual_assets_choice',
      question:
        'Do you have a logo and hero banner for this space? You can upload image files here in the chat if you do—or say no and we will take it from there.',
      isAnswered: (value) => isAnsweredVisualAssetsChoice(value),
    },
    {
      field: 'visual_assets_links',
      question:
        'Perfect — please upload your logo and hero banner here, or paste links to them.',
      requiredWhen: (stepAnswers) =>
        hasOwnAssets(stepAnswers.visual_assets_choice),
      isAnswered: (value) => isAnsweredText(value, 3),
    },
    {
      field: 'visual_vibe',
      question:
        'No problem — I can generate a logo and hero banner that fit your space. What feeling should they convey? For example: bold, calm, playful, visionary.',
      requiredWhen: (stepAnswers) =>
        wantsGeneratedPlaceholders(stepAnswers.visual_assets_choice),
      isAnswered: (value) => isAnsweredText(value, 3),
    },
    {
      field: 'visual_assets_confirmed',
      question:
        'Do these logo and banner work for you before we create the space on-chain?',
      requiredWhen: (stepAnswers) =>
        wantsGeneratedPlaceholders(stepAnswers.visual_assets_choice) &&
        isAnsweredText(stepAnswers.visual_vibe, 3),
      isAnswered: (value) => isAnsweredVisualAssetsConfirmed(value),
    },
  ];
}

function isAnsweredTransparencyMatrix(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    discoverability?: unknown;
    access?: unknown;
  };
  return (
    typeof candidate.discoverability === 'number' &&
    candidate.discoverability >= 0 &&
    candidate.discoverability <= 3 &&
    typeof candidate.access === 'number' &&
    candidate.access >= 0 &&
    candidate.access <= 3
  );
}

function isAnsweredSetupJourney(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized === 'single_space' ||
    normalized.includes('single space') ||
    normalized === 'single' ||
    normalized === 'ecosystem' ||
    normalized.includes('full organisation') ||
    normalized.includes('full organization') ||
    normalized.includes('multiple spaces')
  );
}

function isEcosystemJourney(answers: Record<string, unknown>): boolean {
  const normalized = normalizeChoice(answers.setup_journey);
  return (
    normalized === 'ecosystem' ||
    normalized.includes('full organisation') ||
    normalized.includes('full organization') ||
    normalized.includes('multiple spaces')
  );
}

function isAnsweredEcosystemBlueprint(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized === 'yes' ||
    normalized.includes('confirm') ||
    normalized.includes('looks good') ||
    normalized.includes('proceed')
  );
}

function isAnsweredEntryMethod(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized === 'open_access' ||
    normalized.includes('open access') ||
    normalized === 'invite_only' ||
    normalized.includes('invite') ||
    normalized === 'token_based' ||
    normalized.includes('token')
  );
}

function isAnsweredText(value: unknown, minLength: number): boolean {
  return typeof value === 'string' && value.trim().length >= minLength;
}

const HYPHA_CATEGORY_GROUP_LABELS = CATEGORY_GROUPS.map((group) => group.label);

function buildDiscoveryText(answers: Record<string, unknown>): string {
  return [
    answers.space_name,
    answers.org_name,
    answers.space_purpose,
    answers.org_purpose,
    answers.org_discovery,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function isAnsweredCategoryGroups(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  );
}

function applyInferredCategoryGroups(answers: Record<string, unknown>): void {
  if (isAnsweredCategoryGroups(answers.category_groups)) {
    return;
  }
  if (!isAnsweredText(answers.org_discovery, 8)) {
    return;
  }
  const inferred = inferCategoryGroupsFromText(buildDiscoveryText(answers));
  answers.category_groups = inferred;
}

function getCreateSpaceGuidance(
  answers: Record<string, unknown>,
): GuidanceDefinition {
  const ecosystem = isEcosystemJourney(answers);
  const nameStep: GuidanceStep = ecosystem
    ? {
        field: 'org_name',
        question:
          'What should we call your organisation or ecosystem (the root space)?',
        isAnswered: (value) => isAnsweredText(value, 2),
      }
    : {
        field: 'space_name',
        question: 'What should we call your space?',
        isAnswered: (value) => isAnsweredText(value, 2),
      };

  const purposeStep: GuidanceStep = ecosystem
    ? {
        field: 'org_purpose',
        question:
          'What is the purpose of this organisation? Describe the mission in your own words—I can help refine it.',
        isAnswered: (value) => isAnsweredText(value, 10),
      }
    : {
        field: 'space_purpose',
        question:
          'What is the purpose of this space? Describe it in your own words—I can suggest wording if helpful.',
        isAnswered: (value) => isAnsweredText(value, 10),
      };

  const discoverySteps: GuidanceStep[] = [
    {
      field: 'principles_reaction',
      question:
        'I shared guiding principles above—does this direction feel right, or what would you change?',
      isAnswered: (value) => isAnsweredText(value, 3),
    },
    {
      field: 'org_discovery',
      question:
        'Help me understand the organisation better: what industry or domain are you in, roughly how many people are involved, and who makes up the core team?',
      isAnswered: (value) => isAnsweredText(value, 8),
    },
    {
      field: 'category_groups',
      question: '',
      isAnswered: (value) => isAnsweredCategoryGroups(value),
    },
  ];

  const ecosystemStructureSteps: GuidanceStep[] = ecosystem
    ? [
        {
          field: 'ecosystem_root_role',
          question:
            'As the root space that holds the others, what role should it play—public face, coordination hub, governance layer, or something else?',
          isAnswered: (value) => isAnsweredText(value, 5),
        },
        {
          field: 'ecosystem_structure',
          question:
            'How should the child spaces relate to each other and to the root? Who owns what, and how will members move between spaces?',
          isAnswered: (value) => isAnsweredText(value, 8),
        },
      ]
    : [];

  const sharedSteps: GuidanceStep[] = [
    {
      field: 'setup_journey',
      question:
        'Are you setting up a single space, or a full organisation/ecosystem with multiple coordinated spaces?',
      isAnswered: (value) => isAnsweredSetupJourney(value),
    },
    nameStep,
    purposeStep,
    ...discoverySteps,
    ...ecosystemStructureSteps,
    {
      field: 'activation_method',
      question:
        'Which activation mode fits: Sandbox Mode (private testing), Pilot Mode (demos on the network), or Live Mode (fully operational)?',
      isAnswered: (value) => isAnsweredActivationMethod(value),
    },
    {
      field: 'transparency_matrix',
      question:
        'Set discoverability (who can find this space) and space activity access (who can view activity) using the transparency matrix below—each dimension has four levels with descriptions.',
      isAnswered: (value) => isAnsweredTransparencyMatrix(value),
    },
    {
      field: 'entry_method',
      question:
        'How should people join this space? Choose open access, invite/request, or token-based entry (token-based also requires setting up a membership token).',
      isAnswered: (value) => isAnsweredEntryMethod(value),
    },
    {
      field: 'space_location',
      question:
        'Where is this based? Use the map below to search for an address or drop a pin—or say skip if you prefer not to add a location yet.',
      isAnswered: (value) => isAnsweredLocationStep(value),
    },
    ...buildVisualAssetsSteps(),
  ];

  if (ecosystem) {
    return {
      steps: [
        ...sharedSteps,
        {
          field: 'functional_domains',
          question:
            'Which functional domains matter most (e.g. Finance, Operations, Growth)? Share a few—or say "propose for me" and I will draft spaces from network patterns.',
        },
        {
          field: 'ecosystem_blueprint_confirmed',
          question:
            'Review the proposed spaces above. Ready to create the root space and child spaces? (yes/no)',
          isAnswered: (value) => isAnsweredEcosystemBlueprint(value),
        },
      ],
      validation_steps: [
        'Call get_network_ecosystem_patterns first (public, non-sandbox examples) then propose_organisation_blueprint before asking for blueprint confirmation.',
        'Complete logo and hero banner (upload or generate_space_visual_assets with user confirmation) before create_space_from_onboarding or wallet signing.',
        'Create ONLY the root space first with create_space_from_onboarding and wallet signing.',
        'After the root space exists, continue child spaces with create_ecosystem_space from the left AI panel—propose 3-4 child spaces and keep conversation memory.',
      ],
      suggested_tools: [
        'get_network_ecosystem_patterns',
        'propose_organisation_blueprint',
        'generate_space_visual_assets',
        'create_space_from_onboarding',
        'create_ecosystem_space',
        'mcp_navigation',
      ],
    };
  }

  return {
    steps: [
      ...sharedSteps,
      {
        field: 'link_parent_ecosystem',
        question: 'Should this be linked to a parent ecosystem space? (yes/no)',
      },
      {
        field: 'parent_space_name',
        question:
          'What is the parent space name? If you are unsure, share what you remember and I will help identify it.',
        requiredWhen: (stepAnswers) =>
          String(stepAnswers.link_parent_ecosystem ?? '')
            .toLowerCase()
            .trim() === 'yes',
      },
    ],
    validation_steps: [
      'Complete logo and hero banner (upload or generate_space_visual_assets with user confirmation) before create_space_from_onboarding or wallet signing.',
      'Confirm the exact space draft payload before execution.',
      'Sign with wallet to create the space when required.',
    ],
    suggested_tools: [
      'generate_space_visual_assets',
      'create_space_from_onboarding',
      'mcp_navigation',
    ],
  };
}

function getGuidanceDefinition(
  process: z.infer<typeof processSchema>,
  answers: Record<string, unknown> = {},
): GuidanceDefinition {
  if (process === 'create_space') {
    return getCreateSpaceGuidance(answers);
  }
  if (process === 'configure_space') {
    return {
      steps: [
        { field: 'target_space', question: 'Which space should be updated?' },
        {
          field: 'first_change',
          question: 'What should we change first in that space?',
        },
        {
          field: 'desired_result',
          question: 'How would you like it to look after this change?',
        },
      ],
      validation_steps: ['Confirm the exact diff before updates.'],
      suggested_tools: ['update_space_settings', 'mcp_navigation'],
    };
  }
  if (process === 'join_space') {
    return {
      steps: [
        {
          field: 'target_space',
          question: 'Which space do you want to join/open?',
        },
        {
          field: 'target_screen',
          question: 'Which screen should I open there?',
        },
      ],
      validation_steps: ['Confirm destination once before redirecting.'],
      suggested_tools: ['mcp_navigation'],
    };
  }
  if (process === 'deposit_funds') {
    return {
      steps: [
        {
          field: 'target_space',
          question: 'Which space treasury should receive funds?',
        },
        {
          field: 'network_and_token',
          question: 'Which network and token will you use?',
        },
      ],
      validation_steps: [
        'Confirm destination treasury details before navigation.',
      ],
      suggested_tools: ['mcp_navigation'],
    };
  }
  if (process === 'navigate') {
    return {
      steps: [
        {
          field: 'destination',
          question:
            'Where do you want to go (space, screen, app section, or website)?',
        },
      ],
      validation_steps: ['Confirm destination once before redirecting.'],
      suggested_tools: ['mcp_navigation'],
    };
  }
  return {
    steps: [
      {
        field: 'explore_scope',
        question:
          'What topic should I search for in the network? For example: bioregions, ocean, education, or governance.',
      },
    ],
    validation_steps: ['Run space search and return the best matches now.'],
    suggested_tools: ['search_spaces', 'mcp_navigation'],
  };
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  return value != null;
}

export function createOnboardingGuidanceTool() {
  const searchSpacesTool = createSearchSpacesTool();
  return {
    description:
      'Guided onboarding helper. Returns one next question at a time plus progress and validation steps.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };

      const { process, user_goal, space_slug, known_answers } = parsed.data;
      const answers = { ...(known_answers ?? {}) } as Record<string, unknown>;
      applyInferredCategoryGroups(answers);
      if (
        process === 'explore_network' &&
        !isFilled(answers.explore_scope) &&
        typeof user_goal === 'string' &&
        user_goal.trim().length > 0
      ) {
        answers.explore_scope = user_goal.trim();
      }
      const guidance = getGuidanceDefinition(process, answers);
      const activeSteps = guidance.steps.filter((step) =>
        step.requiredWhen ? step.requiredWhen(answers) : true,
      );
      const nextStep = activeSteps.find((step) => {
        const value = answers[step.field];
        if (step.isAnswered) {
          return !step.isAnswered(value, answers);
        }
        return !isFilled(value);
      });
      const collected = activeSteps.filter((step) => {
        const value = answers[step.field];
        if (step.isAnswered) {
          return step.isAnswered(value, answers);
        }
        return isFilled(value);
      }).length;
      const total = activeSteps.length;
      const readyForValidation = !nextStep;

      const exploreReady =
        process === 'explore_network' && isFilled(answers.explore_scope);
      const exploreScope =
        typeof answers.explore_scope === 'string'
          ? answers.explore_scope.trim()
          : '';
      const searchResults =
        exploreReady && exploreScope
          ? await searchSpacesTool.execute({
              query: exploreScope,
              limit: 8,
            })
          : null;
      const requiresLocationPicker = nextStep?.field === 'space_location';
      const requiresActivationPicker = nextStep?.field === 'activation_method';
      const requiresTransparencyPicker =
        nextStep?.field === 'transparency_matrix';
      const requiresEntryMethodPicker = nextStep?.field === 'entry_method';
      const requiresSetupJourneyPicker = nextStep?.field === 'setup_journey';
      const setupJourneyAssistantInstruction = requiresSetupJourneyPicker
        ? 'Ask only the next_question in one short sentence. The user can choose Single space or Full ecosystem with the journey cards shown below the chat—do not list both options as a long checklist.'
        : null;
      const locationAssistantInstruction = requiresLocationPicker
        ? 'Ask only the next_question in one short sentence. Direct the user to the location card below: search by address or place name, pick a result, or drop a pin on the map—or skip. Never read latitude/longitude or ask the user to confirm raw coordinates. If they already named a place in chat, tell them to search for it in the address field below.'
        : null;
      const activationAssistantInstruction = requiresActivationPicker
        ? 'Ask only the next_question in one short sentence. This step is activation mode only (Sandbox Mode, Pilot Mode, or Live Mode)—not entry method. The user picks with the activation cards below; do not ask about open access, invites, or tokens here.'
        : null;
      const transparencyAssistantInstruction = requiresTransparencyPicker
        ? 'Ask only the next_question in one short sentence. Do NOT list combined transparency options or numbered shortcuts—the user must use the transparency matrix card below, which shows discoverability and activity access separately with four levels each and descriptions.'
        : null;
      const entryMethodAssistantInstruction = requiresEntryMethodPicker
        ? 'Ask only the next_question in one short sentence. The user can choose open access, invite/request, or token-based entry with the entry method cards below—do not list all options as a checklist. Mention that token-based entry requires creating a membership token.'
        : null;
      const principlesAssistantInstruction =
        nextStep?.field === 'principles_reaction'
          ? 'Before this question, propose 2-4 concise guiding principles for this organisation based on name and purpose. Then ask only the next_question and wait for the user reaction.'
          : null;
      const orgDiscoveryInstruction =
        nextStep?.field === 'org_discovery'
          ? `Ask only the next_question. Do NOT invent custom tags (Collaboration, Creativity, Entrepreneurship, etc.) or ask the user to pick tags. Hypha uses exactly these ten fixed category groups: ${HYPHA_CATEGORY_GROUP_LABELS.join(
              ', ',
            )}. Tags are assigned automatically after this answer.`
          : null;
      const assignedCategoryGroups = isAnsweredCategoryGroups(
        answers.category_groups,
      )
        ? (answers.category_groups as CategoryGroupId[])
        : [];
      const assignedCategoryInstruction =
        assignedCategoryGroups.length > 0 &&
        nextStep?.field !== 'org_discovery' &&
        nextStep?.field !== 'category_groups'
          ? `Briefly state the Hypha category tag(s) you assigned (${assignedCategoryGroups
              .map(
                (groupId) =>
                  CATEGORY_GROUPS.find((group) => group.id === groupId)?.label,
              )
              .filter(Boolean)
              .join(
                ', ',
              )}) in one short phrase—not as a question. Pass suggested_categories into create_space_from_onboarding. Never invent tags outside the fixed ten groups.`
          : null;
      const requiresVisualAssetsPicker =
        nextStep?.field === 'visual_assets_choice' ||
        nextStep?.field === 'visual_assets_links';
      const visualAssetsAssistantInstruction = requiresVisualAssetsPicker
        ? 'Ask only the next_question in one warm sentence. First ask whether they have a logo and hero banner to upload—if not, reassure them you can generate both. Never trigger wallet signing or create_space_from_onboarding until logo_url and lead_image_url are set.'
        : nextStep?.field === 'visual_vibe'
        ? 'Ask only the next_question. After they share the vibe, call generate_space_visual_assets in the same or next turn and show thumbnail previews before asking for confirmation.'
        : nextStep?.field === 'visual_assets_confirmed'
        ? 'Show the generated logo and banner previews if not already visible, then ask only the next_question. Do not proceed to create_space_from_onboarding until they confirm.'
        : null;
      return {
        ok: true,
        process,
        user_goal: user_goal ?? null,
        space_slug: space_slug ?? null,
        question_mode: 'single_step',
        assistant_instruction: exploreReady
          ? 'Return concrete space matches now in this same reply. If search_results has entries, list the best 3-5 with clear names and short reasons. If none are found, say that clearly and suggest the next best step. Do not ask another discovery question first.'
          : principlesAssistantInstruction ??
            orgDiscoveryInstruction ??
            assignedCategoryInstruction ??
            visualAssetsAssistantInstruction ??
            locationAssistantInstruction ??
            activationAssistantInstruction ??
            transparencyAssistantInstruction ??
            entryMethodAssistantInstruction ??
            setupJourneyAssistantInstruction ??
            'Ask only the next_question as a single natural-language question. Do not provide a checklist, field list, or form labels.',
        progress: {
          answered: collected,
          total,
          remaining: Math.max(total - collected, 0),
        },
        next_question: nextStep?.question?.trim() ? nextStep.question : null,
        next_field: nextStep?.field ?? null,
        allowed_category_groups: HYPHA_CATEGORY_GROUP_LABELS,
        assigned_category_groups: assignedCategoryGroups.map((groupId) => ({
          id: groupId,
          label:
            CATEGORY_GROUPS.find((group) => group.id === groupId)?.label ??
            groupId,
        })),
        suggested_categories: expandCategoryGroups(assignedCategoryGroups),
        requires_location_picker: requiresLocationPicker,
        requires_activation_picker: requiresActivationPicker,
        requires_transparency_picker: requiresTransparencyPicker,
        requires_entry_method_picker: requiresEntryMethodPicker,
        requires_setup_journey_picker: requiresSetupJourneyPicker,
        setup_journey: isAnsweredSetupJourney(answers.setup_journey)
          ? isEcosystemJourney(answers)
            ? 'ecosystem'
            : 'single_space'
          : null,
        ready_for_search: exploreReady,
        search_results: searchResults,
        ready_for_validation: readyForValidation,
        validation_steps: readyForValidation ? guidance.validation_steps : [],
        suggested_tools: guidance.suggested_tools,
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
