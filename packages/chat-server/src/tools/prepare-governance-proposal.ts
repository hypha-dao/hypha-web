import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import { aiCreatableProposalTypeSchema } from './ai-proposal-types';
import { buildGuidanceResponse } from './proposal-guidance';
import {
  PARTIAL_PREPARE_DRAFT_DESCRIPTION,
  PARTIAL_PREPARE_DRAFT_TITLE,
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
      'Read-only: return the next discovery step for a governance proposal. Pass collected_fields as answers arrive. Reply using only next_question + interaction_hint — never list all fields. Call prepare_governance_proposal when form_sync.call_prepare_governance_proposal is true.',
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
      ...legacyFieldSchema,
    })
    .superRefine((value, ctx) => {
      if (value.partial) return;

      if (!value.title?.trim() || value.title.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['title'],
          message:
            'title is required (min 3 characters) unless partial is true.',
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
      'Write: open or update the typed Agreements form with collected fields. Use partial: true during discovery after each substantive answer — form pre-fills and scrolls to focus_field. Use partial: false when ready_to_publish. Never wallet-sign in chat. Never use for collective_agreement.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }

      const isPartial = parsed.data.partial === true;
      const data = mergeLegacyPrepareFields({
        ...(parsed.data as PrepareGovernanceProposalInput),
        title:
          parsed.data.title?.trim() ||
          (isPartial ? PARTIAL_PREPARE_DRAFT_TITLE : ''),
        description:
          parsed.data.description?.trim() ||
          (isPartial ? PARTIAL_PREPARE_DRAFT_DESCRIPTION : ''),
      });

      const safe = sanitizeSlug(data.space_slug);
      if (!safe) return { ok: false, error: 'Invalid space slug format.' };

      const entry = getProposalCatalogEntry(data.proposal_type);
      if (!entry || entry.prepareStrategy !== 'prepare_governance_proposal') {
        return {
          ok: false,
          error: `Proposal type "${data.proposal_type}" is not supported by prepare_governance_proposal.`,
        };
      }

      if (!isPartial) {
        const validationError = validatePrepareInput(entry, data);
        if (validationError) {
          return { ok: false, error: validationError };
        }
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
        partial: isPartial,
        proposal_type: data.proposal_type,
        document_label: entry.documentLabel,
        resubmit_payload: resubmitPayload,
        navigation,
        focus_field: navigation.focus_field,
        focus_section: navigation.focus_section,
        next_step: isPartial
          ? 'Form opened/updated — scroll the member to the active section. Reply with ONE intent-focused sentence only (no recap, no field labels). Continue discovery until ready_to_publish, then partial: false.'
          : 'Form is complete. Tell the user to review and click Publish — one short sentence, no field-by-field recap.',
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
