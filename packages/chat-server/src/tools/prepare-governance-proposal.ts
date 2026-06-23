import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';
import {
  aiCreatableProposalTypeSchema,
  resolveAiProposalTypeConfig,
} from './ai-proposal-types';
import { getProposalGuidancePlaybook } from './proposal-guidance';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

const votingMethodSchema = z.enum(['1m1v', '1v1v', '1t1v']);
const entryMethodSchema = z.enum(['open_access', 'invite_only', 'token_based']);
const transparencyLevelSchema = z.number().int().min(0).max(3);

const PREPARE_PROPOSAL_TYPES = [
  'change_voting_method',
  'change_entry_method',
  'space_transparency',
] as const;

type PrepareProposalType = (typeof PREPARE_PROPOSAL_TYPES)[number];

function isPrepareProposalType(value: string): value is PrepareProposalType {
  return (PREPARE_PROPOSAL_TYPES as readonly string[]).includes(value);
}

function templateSegmentFromCreatePath(createPath: string): string {
  const marker = 'agreements/create/';
  const idx = createPath.indexOf(marker);
  if (idx === -1) return '';
  return createPath.slice(idx + marker.length);
}

function buildProposalFormHref(
  lang: string,
  spaceSlug: string,
  createPath: string,
): string {
  const segment = templateSegmentFromCreatePath(createPath);
  return segment
    ? `/${lang}/dho/${spaceSlug}/agreements/create/${segment}`
    : `/${lang}/dho/${spaceSlug}/agreements/create`;
}

function mapEntryMethodToNumeric(
  method: z.infer<typeof entryMethodSchema>,
): number {
  switch (method) {
    case 'open_access':
      return 0;
    case 'token_based':
      return 1;
    case 'invite_only':
    default:
      return 2;
  }
}

function documentLabelForProposalType(type: PrepareProposalType): string {
  return resolveAiProposalTypeConfig(type).documentLabel;
}

export function createProposalGuidanceTool() {
  const inputSchema = z.object({
    proposal_type: z.enum(aiCreatableProposalTypeSchema),
  });

  return {
    description:
      'Read-only: return the discovery playbook for a governance proposal type — required questions, fields, and whether to use prepare_governance_proposal or navigation. Call this before collecting proposal details.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const playbook = getProposalGuidancePlaybook(parsed.data.proposal_type);
      return {
        ok: true,
        playbook,
        suggested_tool: isPrepareProposalType(parsed.data.proposal_type)
          ? 'prepare_governance_proposal'
          : parsed.data.proposal_type === 'collective_agreement'
          ? 'create_space_setup_proposal'
          : 'mcp_navigation',
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}

export function createPrepareGovernanceProposalTool(authToken: string) {
  const inputSchema = z
    .object({
      space_slug: z.string().trim().min(1),
      proposal_type: z.enum(PREPARE_PROPOSAL_TYPES),
      title: z.string().trim().min(3).max(120),
      description: z.string().trim().min(20).max(4000),
      lang: z
        .string()
        .trim()
        .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
        .optional(),
      voting_method: votingMethodSchema.optional(),
      quorum_percent: z.number().min(0).max(100).optional(),
      unity_percent: z.number().min(0).max(100).optional(),
      auto_execution: z.boolean().optional().default(true),
      voting_duration_seconds: z.number().int().positive().optional(),
      entry_method: entryMethodSchema.optional(),
      token_address: z.string().trim().optional(),
      space_discoverability: transparencyLevelSchema.optional(),
      space_activity_access: transparencyLevelSchema.optional(),
    })
    .superRefine((value, ctx) => {
      if (
        value.proposal_type === 'change_voting_method' &&
        !value.voting_method
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['voting_method'],
          message:
            'voting_method is required for change_voting_method (1m1v, 1v1v, or 1t1v). Call proposal_guidance first if unsure.',
        });
      }
      if (
        value.proposal_type === 'change_entry_method' &&
        !value.entry_method
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entry_method'],
          message:
            'entry_method is required for change_entry_method (open_access, invite_only, token_based).',
        });
      }
      if (value.proposal_type === 'space_transparency') {
        if (value.space_discoverability === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['space_discoverability'],
            message: 'space_discoverability is required (0–3).',
          });
        }
        if (value.space_activity_access === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['space_activity_access'],
            message: 'space_activity_access is required (0–3).',
          });
        }
      }
      if (
        value.auto_execution === false &&
        (value.voting_duration_seconds === undefined ||
          value.voting_duration_seconds <= 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['voting_duration_seconds'],
          message:
            'voting_duration_seconds is required when auto_execution is false.',
        });
      }
    });

  return {
    description:
      'Write: prepare a typed governance proposal form in Agreements with all required fields pre-filled. Use after proposal_guidance discovery. Never wallet-sign in chat — the member clicks Publish in the opened form. Supports change_voting_method, change_entry_method, and space_transparency.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      const data = parsed.data;
      const safe = sanitizeSlug(data.space_slug);
      if (!safe) return { ok: false, error: 'Invalid space slug format.' };

      const host = await findSpaceBySlug({ slug: safe }, { db });
      if (!host) return { ok: false, error: `Space "${safe}" was not found.` };

      const access = await checkSpaceAccessForSpace(host, authToken);
      if (!access.hasAccess) return { ok: false, error: access.message };

      const config = resolveAiProposalTypeConfig(data.proposal_type);
      const lang = data.lang?.trim() || 'en';
      const templateSegment = templateSegmentFromCreatePath(config.createPath);

      const resubmitPayload: Record<string, unknown> = {
        resubmitTemplateSegment: templateSegment,
        title: data.title,
        description: data.description,
        label: documentLabelForProposalType(data.proposal_type),
        autoExecution: data.auto_execution,
      };

      if (data.proposal_type === 'change_voting_method') {
        resubmitPayload.votingMethod = data.voting_method;
        if (
          data.quorum_percent !== undefined ||
          data.unity_percent !== undefined
        ) {
          resubmitPayload.quorumAndUnity = {
            ...(data.quorum_percent !== undefined
              ? { quorum: data.quorum_percent }
              : {}),
            ...(data.unity_percent !== undefined
              ? { unity: data.unity_percent }
              : {}),
          };
        }
        if (data.voting_duration_seconds !== undefined) {
          resubmitPayload.votingDuration = data.voting_duration_seconds;
        }
      }

      if (data.proposal_type === 'change_entry_method' && data.entry_method) {
        resubmitPayload.entryMethod = mapEntryMethodToNumeric(
          data.entry_method,
        );
        if (data.token_address?.trim()) {
          resubmitPayload.tokenBase = data.token_address.trim();
        }
      }

      if (data.proposal_type === 'space_transparency') {
        resubmitPayload.spaceDiscoverability = data.space_discoverability;
        resubmitPayload.spaceActivityAccess = data.space_activity_access;
      }

      const href = buildProposalFormHref(lang, safe, config.createPath);

      return {
        ok: true,
        proposal_type: data.proposal_type,
        document_label: config.documentLabel,
        resubmit_payload: resubmitPayload,
        navigation: {
          kind: 'internal' as const,
          href,
          open_agreements_form: true,
          label: config.documentLabel,
        },
        next_step:
          'Tell the user the form is ready with their choices pre-filled. They should review it and click Publish — do not ask for wallet signing in chat.',
      };
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
