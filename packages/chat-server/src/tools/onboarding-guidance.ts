import { z } from 'zod';
import type { ChatRouteTool } from './types';

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
};

type GuidanceDefinition = {
  steps: GuidanceStep[];
  validation_steps: string[];
  suggested_tools: string[];
};

function getGuidanceDefinition(
  process: z.infer<typeof processSchema>,
): GuidanceDefinition {
  if (process === 'create_space') {
    return {
      steps: [
        { field: 'space_name', question: 'What should we call your space?' },
        {
          field: 'space_purpose',
          question:
            'What is the purpose of this space? If helpful, I can suggest a few examples.',
        },
        {
          field: 'link_parent_ecosystem',
          question:
            'Should this be linked to a parent ecosystem space? (yes/no)',
        },
        {
          field: 'parent_space_slug',
          question:
            'What is the parent space name? If you are unsure, share what you remember and I will help identify it.',
          requiredWhen: (answers) =>
            String(answers.link_parent_ecosystem ?? '')
              .toLowerCase()
              .trim() === 'yes',
        },
      ],
      validation_steps: [
        'Confirm the exact space draft payload before execution.',
        'Sign with wallet to create the space when required.',
      ],
      suggested_tools: ['create_space_from_onboarding', 'mcp_navigation'],
    };
  }
  if (process === 'configure_space') {
    return {
      steps: [
        { field: 'target_space', question: 'Which space should be updated?' },
        {
          field: 'fields_to_change',
          question: 'Which fields should be changed?',
        },
        {
          field: 'new_values',
          question: 'What exact new values should be applied?',
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
        question: 'What do you want to explore in the network?',
      },
      {
        field: 'redirect_after_discovery',
        question:
          'After discovery, should I route you to a specific destination? (yes/no)',
      },
    ],
    validation_steps: ['Confirm destination scope before navigation.'],
    suggested_tools: ['mcp_navigation'],
  };
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  return value != null;
}

export function createOnboardingGuidanceTool() {
  return {
    description:
      'Guided onboarding helper. Returns one next question at a time plus progress and validation steps.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };

      const { process, user_goal, space_slug, known_answers } = parsed.data;
      const answers = known_answers ?? {};
      const guidance = getGuidanceDefinition(process);
      const activeSteps = guidance.steps.filter((step) =>
        step.requiredWhen ? step.requiredWhen(answers) : true,
      );
      const nextStep = activeSteps.find(
        (step) => !isFilled(answers[step.field]),
      );
      const collected = activeSteps.filter((step) =>
        isFilled(answers[step.field]),
      ).length;
      const total = activeSteps.length;
      const readyForValidation = !nextStep;

      return {
        ok: true,
        process,
        user_goal: user_goal ?? null,
        space_slug: space_slug ?? null,
        question_mode: 'single_step',
        progress: {
          answered: collected,
          total,
          remaining: Math.max(total - collected, 0),
        },
        next_question: nextStep?.question ?? null,
        next_field: nextStep?.field ?? null,
        ready_for_validation: readyForValidation,
        validation_steps: readyForValidation ? guidance.validation_steps : [],
        suggested_tools: guidance.suggested_tools,
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
