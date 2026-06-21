import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { createSearchSpacesTool } from './search-spaces';
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
    normalized === 'no' ||
    normalized === 'no assets'
  );
}

function hasOwnAssets(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized.includes('i have') ||
    normalized.includes('upload') ||
    normalized.includes('use mine') ||
    normalized === 'yes'
  );
}

function isAnsweredActivationMethod(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized === 'sandbox' ||
    normalized.includes('sandbox mode') ||
    normalized === 'pilot' ||
    normalized.includes('pilot mode') ||
    normalized === 'deployment' ||
    normalized.includes('live mode') ||
    normalized.includes('live') ||
    normalized.includes('deploy')
  );
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

function getCreateSpaceGuidance(
  answers: Record<string, unknown>,
): GuidanceDefinition {
  const ecosystem = isEcosystemJourney(answers);
  const nameStep: GuidanceStep = ecosystem
    ? {
        field: 'org_name',
        question:
          'What should we call your organisation or ecosystem (the root space)?',
      }
    : { field: 'space_name', question: 'What should we call your space?' };

  const purposeStep: GuidanceStep = ecosystem
    ? {
        field: 'org_purpose',
        question:
          'What is the purpose of this organisation? I can propose the spaces it needs once I understand your mission.',
      }
    : {
        field: 'space_purpose',
        question:
          'What is the purpose of this space? If helpful, I can suggest a few examples.',
      };

  const sharedSteps: GuidanceStep[] = [
    {
      field: 'setup_journey',
      question:
        'Are you setting up a single space, or a full organisation/ecosystem with multiple coordinated spaces?',
      isAnswered: (value) => isAnsweredSetupJourney(value),
    },
    nameStep,
    purposeStep,
    {
      field: 'activation_method',
      question:
        'Which activation mode fits: Sandbox (private testing), Pilot (demos and validation on the network), or Deployment (live and publicly discoverable)?',
      isAnswered: (value) => isAnsweredActivationMethod(value),
    },
    {
      field: 'transparency_matrix',
      question:
        'How transparent should this be? Set discoverability (who can find it) and space activity access (who can view activity). More openness helps you benefit from planetary cross-pollination across the Hypha network.',
      isAnswered: (value) => isAnsweredTransparencyMatrix(value),
    },
    {
      field: 'space_location',
      question:
        'Where is this based? Use the map below to search for an address or drop a pin—or say skip if you prefer not to add a location yet.',
      isAnswered: (value) => isAnsweredLocationStep(value),
    },
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
        {
          field: 'visual_assets_choice',
          question:
            'Do you already have an icon, logo, and banner image for the root space, or should I generate placeholders for you?',
        },
        {
          field: 'visual_assets_links',
          question:
            'Great. Please share the icon/logo/banner image links now, or upload the files here and I will use them.',
          requiredWhen: (stepAnswers) =>
            hasOwnAssets(stepAnswers.visual_assets_choice),
        },
        {
          field: 'visual_vibe',
          question:
            'Perfect. What emotion or vibe should the placeholders express? For example: bold, calm, playful, visionary.',
          requiredWhen: (stepAnswers) =>
            wantsGeneratedPlaceholders(stepAnswers.visual_assets_choice),
        },
      ],
      validation_steps: [
        'Call propose_organisation_blueprint (or get_network_ecosystem_patterns first) before asking for blueprint confirmation.',
        'Confirm the root space draft, create it with create_space_from_onboarding, then create each child with create_ecosystem_space.',
        'Sign with wallet when required for each space.',
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
      {
        field: 'visual_assets_choice',
        question:
          'Do you already have an icon, logo, and banner image, or should I generate placeholders for you?',
      },
      {
        field: 'visual_assets_links',
        question:
          'Great. Please share the icon/logo/banner image links now, or upload the files here and I will use them.',
        requiredWhen: (stepAnswers) =>
          hasOwnAssets(stepAnswers.visual_assets_choice),
      },
      {
        field: 'visual_vibe',
        question:
          'Perfect. What emotion or vibe should the placeholders express? For example: bold, calm, playful, visionary.',
        requiredWhen: (stepAnswers) =>
          wantsGeneratedPlaceholders(stepAnswers.visual_assets_choice),
      },
    ],
    validation_steps: [
      'Confirm the exact space draft payload before execution.',
      'Sign with wallet to create the space when required.',
    ],
    suggested_tools: [
      'geocode_space_location',
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
      const requiresSetupJourneyPicker = nextStep?.field === 'setup_journey';
      const setupJourneyAssistantInstruction = requiresSetupJourneyPicker
        ? 'Ask only the next_question in one short sentence. The user can choose Single space or Full ecosystem with the journey cards shown below the chat—do not list both options as a long checklist.'
        : null;
      const locationAssistantInstruction = requiresLocationPicker
        ? 'Ask only the next_question in one short sentence. The user can set location with the interactive map shown below the chat—do not ask them to type coordinates.'
        : null;
      const activationAssistantInstruction = requiresActivationPicker
        ? 'Ask only the next_question in one short sentence. The user can choose Sandbox, Pilot, or Deployment with the activation cards shown below the chat—do not list all options as a checklist.'
        : null;
      const transparencyAssistantInstruction = requiresTransparencyPicker
        ? 'Ask only the next_question in one short sentence. Mention that openness supports planetary cross-pollination across knowledge, value, and impact flows. The user can set discoverability and space activity access with the transparency matrix shown below the chat—do not list every level as a checklist.'
        : null;
      return {
        ok: true,
        process,
        user_goal: user_goal ?? null,
        space_slug: space_slug ?? null,
        question_mode: 'single_step',
        assistant_instruction: exploreReady
          ? 'Return concrete space matches now in this same reply. If search_results has entries, list the best 3-5 with clear names and short reasons. If none are found, say that clearly and suggest the next best step. Do not ask another discovery question first.'
          : locationAssistantInstruction ??
            activationAssistantInstruction ??
            transparencyAssistantInstruction ??
            setupJourneyAssistantInstruction ??
            'Ask only the next_question as a single natural-language question. Do not provide a checklist, field list, or form labels.',
        progress: {
          answered: collected,
          total,
          remaining: Math.max(total - collected, 0),
        },
        next_question: nextStep?.question ?? null,
        next_field: nextStep?.field ?? null,
        requires_location_picker: requiresLocationPicker,
        requires_activation_picker: requiresActivationPicker,
        requires_transparency_picker: requiresTransparencyPicker,
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
