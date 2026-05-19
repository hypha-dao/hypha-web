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
});

function getGuidance(process: z.infer<typeof processSchema>) {
  if (process === 'create_space') {
    return {
      required_questions: [
        'What is the space name?',
        'What is the purpose/description?',
        'Should this be linked to a parent ecosystem space?',
      ],
      validation_steps: [
        'Confirm the exact space draft payload before execution.',
        'Sign with wallet to create the space on-chain when required.',
      ],
      suggested_tools: ['create_space_from_onboarding', 'mcp_navigation'],
    };
  }
  if (process === 'configure_space') {
    return {
      required_questions: [
        'Which space should be updated?',
        'Which fields should be changed (title, description, links, flags)?',
        'What exact new values should be applied?',
      ],
      validation_steps: [
        'Confirm the exact diff before updates.',
        'Apply update and verify user lands on the requested screen.',
      ],
      suggested_tools: ['update_space_settings', 'mcp_navigation'],
    };
  }
  if (process === 'join_space') {
    return {
      required_questions: [
        'Which space do you want to join/open?',
        'Should I route you to agreements, members, treasury, or another screen?',
      ],
      validation_steps: ['Confirm the destination before navigation.'],
      suggested_tools: ['mcp_navigation'],
    };
  }
  if (process === 'deposit_funds') {
    return {
      required_questions: [
        'Which space treasury should receive funds?',
        'Which network and token will you use?',
      ],
      validation_steps: [
        'Confirm destination space and treasury details before navigation.',
      ],
      suggested_tools: ['mcp_navigation'],
    };
  }
  if (process === 'navigate') {
    return {
      required_questions: [
        'Where do you want to go (space, screen, app section, or website)?',
      ],
      validation_steps: ['Confirm destination once before redirecting.'],
      suggested_tools: ['mcp_navigation'],
    };
  }
  return {
    required_questions: [
      'What do you want to explore in the network?',
      'Do you want discovery only, or to open a specific destination after?',
    ],
    validation_steps: ['Confirm scope before navigation.'],
    suggested_tools: ['mcp_navigation'],
  };
}

export function createOnboardingGuidanceTool() {
  return {
    description:
      'Guided onboarding helper. Returns required discovery questions, validation steps, and suggested tools for a given process.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };

      const { process, user_goal, space_slug } = parsed.data;
      const guidance = getGuidance(process);
      return {
        ok: true,
        process,
        user_goal: user_goal ?? null,
        space_slug: space_slug ?? null,
        ...guidance,
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
