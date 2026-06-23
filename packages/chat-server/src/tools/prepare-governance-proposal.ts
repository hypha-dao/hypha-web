import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import { aiCreatableProposalTypeSchema } from './ai-proposal-types';
import { buildGuidanceResponse } from './proposal-guidance';
import {
  PREPARE_GOVERNANCE_PROPOSAL_TYPES,
  buildPrepareNavigation,
  buildResubmitPayload,
  getProposalCatalogEntry,
  mergeLegacyPrepareFields,
  validatePrepareInput,
  type PrepareGovernanceProposalInput,
} from './proposal-catalog';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

const votingMethodSchema = z.enum(['1m1v', '1v1v', '1t1v']);
const entryMethodSchema = z.enum(['open_access', 'invite_only', 'token_based']);

const prepareProposalTypeSchema = z.enum(
  PREPARE_GOVERNANCE_PROPOSAL_TYPES as [
    (typeof PREPARE_GOVERNANCE_PROPOSAL_TYPES)[number],
    ...(typeof PREPARE_GOVERNANCE_PROPOSAL_TYPES)[number][],
  ],
);

const legacyFieldSchema = {
  voting_method: votingMethodSchema.optional(),
  quorum_percent: z.number().min(0).max(100).optional(),
  unity_percent: z.number().min(0).max(100).optional(),
  auto_execution: z.boolean().optional(),
  voting_duration_seconds: z.number().int().positive().optional(),
  entry_method: entryMethodSchema.optional(),
  token_address: z.string().trim().optional(),
  space_discoverability: z.number().int().min(0).max(3).optional(),
  space_activity_access: z.number().int().min(0).max(3).optional(),
};

export function createProposalGuidanceTool() {
  const inputSchema = z.object({
    proposal_type: z.enum(aiCreatableProposalTypeSchema),
    collected_fields: z.record(z.unknown()).optional(),
  });

  return {
    description:
      'Read-only: return the discovery playbook for a governance proposal type — required questions, optional fields, and whether to use prepare_governance_proposal or create_space_setup_proposal. Call before collecting proposal details. Pass collected_fields as you gather answers to get remaining required and optional prompts.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      return buildGuidanceResponse({
        proposalType: parsed.data.proposal_type,
        collectedFields: parsed.data.collected_fields,
      });
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createPrepareGovernanceProposalTool(authToken: string) {
  const inputSchema = z
    .object({
      space_slug: z.string().trim().min(1),
      proposal_type: prepareProposalTypeSchema,
      title: z.string().trim().min(3).max(120),
      description: z.string().trim().min(20).max(4000),
      lang: z
        .string()
        .trim()
        .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
        .optional(),
      proposal_fields: z.record(z.unknown()).optional(),
      focus_field: z.string().trim().optional(),
      ...legacyFieldSchema,
    })
    .superRefine((value, ctx) => {
      const merged = mergeLegacyPrepareFields(
        value as PrepareGovernanceProposalInput,
      );
      const entry = getProposalCatalogEntry(value.proposal_type);
      if (!entry) return;

      const validationError = validatePrepareInput(entry, merged);
      if (validationError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposal_fields'],
          message: validationError,
        });
      }
    });

  return {
    description:
      'Write: prepare a typed governance proposal form in Agreements with all collected fields pre-filled. Use after proposal_guidance discovery. Never wallet-sign in chat — the member clicks Publish in the opened form. Supports all on-chain proposal types from Create proposal and Space settings (except space configuration).',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      const data = mergeLegacyPrepareFields(
        parsed.data as PrepareGovernanceProposalInput,
      );
      const safe = sanitizeSlug(data.space_slug);
      if (!safe) return { ok: false, error: 'Invalid space slug format.' };

      const entry = getProposalCatalogEntry(data.proposal_type);
      if (!entry || entry.prepareStrategy !== 'prepare_governance_proposal') {
        return {
          ok: false,
          error: `Proposal type "${data.proposal_type}" is not supported by prepare_governance_proposal.`,
        };
      }

      const host = await findSpaceBySlug({ slug: safe }, { db });
      if (!host) return { ok: false, error: `Space "${safe}" was not found.` };

      const access = await checkSpaceAccessForSpace(host, authToken);
      if (!access.hasAccess) return { ok: false, error: access.message };

      const lang = data.lang?.trim() || 'en';
      const resubmitPayload = buildResubmitPayload(entry, data);
      const navigation = buildPrepareNavigation({
        entry,
        lang,
        spaceSlug: safe,
        focusField: parsed.data.focus_field,
      });

      return {
        ok: true,
        proposal_type: data.proposal_type,
        document_label: entry.documentLabel,
        resubmit_payload: resubmitPayload,
        navigation,
        focus_field: navigation.focus_field,
        focus_section: navigation.focus_section,
        next_step:
          'Tell the user the form is ready with their choices pre-filled. Keep the AI panel open to walk through sections if needed. They should review and click Publish — do not ask for wallet signing in chat.',
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
