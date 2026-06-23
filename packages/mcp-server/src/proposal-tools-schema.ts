import { z } from 'zod';
import {
  PREPARE_GOVERNANCE_PROPOSAL_TYPES,
  PROPOSAL_CATALOG_KEYS,
} from '@hypha-platform/chat-server/proposal-catalog';

export const proposalGuidanceInputSchema = z.object({
  proposal_type: z.enum(PROPOSAL_CATALOG_KEYS as [string, ...string[]]),
  collected_fields: z.record(z.unknown()).optional(),
});

export const proposalGuidanceOutputSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  playbook: z.record(z.unknown()).optional(),
  suggested_tool: z.string().optional(),
  remaining_required_fields: z.array(z.record(z.unknown())).optional(),
  optional_fields_to_ask: z.array(z.record(z.unknown())).optional(),
  walkthrough_hint: z.string().optional(),
});

export const prepareGovernanceProposalInputSchema = z.object({
  space_slug: z.string().trim().min(1),
  proposal_type: z.enum(
    PREPARE_GOVERNANCE_PROPOSAL_TYPES as [string, ...string[]],
  ),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(4000),
  lang: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
    .optional(),
  proposal_fields: z.record(z.unknown()).optional(),
  focus_field: z.string().trim().optional(),
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
});

export const prepareGovernanceProposalOutputSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  proposal_type: z.string().optional(),
  document_label: z.string().optional(),
  resubmit_payload: z.record(z.unknown()).optional(),
  navigation: z.record(z.unknown()).optional(),
  focus_field: z.string().optional(),
  focus_section: z.string().optional(),
  next_step: z.string().optional(),
});
