import { z } from 'zod';
import {
  PREPARE_GOVERNANCE_PROPOSAL_TYPES,
  PROPOSAL_CATALOG_KEYS,
} from '@hypha-platform/chat-server/proposal-catalog';

export const proposalGuidanceInputSchema = z.object({
  proposal_type: z.enum(PROPOSAL_CATALOG_KEYS as [string, ...string[]]),
  collected_fields: z.record(z.unknown()).optional(),
});

export const proposalGuidanceOutputSchema = z
  .object({
    ok: z.boolean(),
    error: z.string().optional(),
    proposal_type: z.string().optional(),
    document_label: z.string().optional(),
    suggested_tool: z.string().optional(),
    next_question_field: z.string().nullable().optional(),
    next_question: z.string().nullable().optional(),
    interaction_hint: z.string().nullable().optional(),
    ready_to_publish: z.boolean().optional(),
    walkthrough_hint: z.string().optional(),
    form_sync: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const prepareGovernanceProposalInputSchema = z
  .object({
    space_slug: z.string().trim().min(1),
    proposal_type: z.enum(
      PREPARE_GOVERNANCE_PROPOSAL_TYPES as [string, ...string[]],
    ),
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(4000).optional(),
    lang: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
    proposal_fields: z.record(z.unknown()).optional(),
    focus_field: z.string().trim().optional(),
    partial: z.boolean().optional(),
    voting_method: z.enum(['1m1v', '1v1v', '1t1v']).optional(),
    quorum_percent: z.number().min(0).max(100).optional(),
    unity_percent: z.number().min(0).max(100).optional(),
    auto_execution: z.boolean().optional(),
    voting_duration_seconds: z.number().int().positive().optional(),
    entry_method: z
      .enum(['open_access', 'invite_only', 'token_based'])
      .optional(),
    token_address: z.string().trim().optional(),
    space_discoverability: z.number().int().min(0).max(3).optional(),
    space_activity_access: z.number().int().min(0).max(3).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.partial) return;

    if (!value.title?.trim() || value.title.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['title'],
        message: 'title is required (min 3 characters) unless partial is true.',
      });
    }
    if (!value.description?.trim() || value.description.trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['description'],
        message:
          'description is required (min 20 characters) unless partial is true.',
      });
    }
  });

export const prepareGovernanceProposalOutputSchema = z
  .object({
    ok: z.boolean(),
    error: z.string().optional(),
    partial: z.boolean().optional(),
    proposal_type: z.string().optional(),
    document_label: z.string().optional(),
    resubmit_payload: z.record(z.unknown()).optional(),
    navigation: z.record(z.unknown()).optional(),
    focus_field: z.string().optional(),
    focus_section: z.string().optional(),
    next_step: z.string().optional(),
  })
  .passthrough();
