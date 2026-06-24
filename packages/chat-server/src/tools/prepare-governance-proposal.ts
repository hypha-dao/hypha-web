import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import { aiCreatableProposalTypeSchema } from './ai-proposal-types';
import { buildGuidanceResponse } from './proposal-guidance';
import type { ActiveProposalFormSnapshot } from './proposal-form-state';
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

export function createProposalGuidanceTool(
  formSnapshot?: ActiveProposalFormSnapshot | null,
) {
  const inputSchema = z.object({
    proposal_type: z.enum(aiCreatableProposalTypeSchema),
    collected_fields: z.record(z.unknown()).optional(),
  });

  return {
    description:
      'Read-only: return the ONE next field to collect (hand-holding, form order). Pass collected_fields as answers arrive. After title is accepted, call prepare_governance_proposal to open the form, then one field per turn. Call get_proposal_form_state before saying ready. Reply using only next_question + interaction_hint.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      return buildGuidanceResponse({
        proposalType: parsed.data.proposal_type,
        collectedFields: parsed.data.collected_fields,
        formSnapshot,
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
      'Write: open or update the typed Agreements form. Follow proposal_guidance remaining_field_order — fill LIVE with partial:true after EVERY accepted field so the form shows values before the next question. Merge ALL collected fields plus on-chain defaults for quorum/unity/voting period. Title/description first (top of form), drafted silently. For choice fields list all options before recommending. On yes/named option: call SAME turn — never ask "shall I proceed". Stay on same open form; partial updates merge. partial:false only when ready_to_publish. NEVER tell user to publish if form fields are still empty. Never wallet-sign in chat.',
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
          ? 'Form opened/updated — call get_proposal_form_state, then proposal_guidance with updated collected_fields. Ask ONLY the single next field. On acceptance call prepare_governance_proposal partial:true with that one field merged — verify on screen before moving on.'
          : 'Call get_proposal_form_state — only if form_synced and ready_to_publish tell the user to click Publish (one sentence).',
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
