import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { aiCreatableProposalTypeSchema } from './ai-proposal-types';
import {
  buildProposalFormStateResponse,
  type ActiveProposalFormSnapshot,
} from './proposal-form-state';

export function createGetProposalFormStateTool(
  snapshotFromRequest?: ActiveProposalFormSnapshot | null,
) {
  const inputSchema = z.object({
    proposal_type: z.enum(aiCreatableProposalTypeSchema).optional(),
    collected_fields: z.record(z.string(), z.unknown()).optional(),
  });

  return {
    description:
      'Read-only: return what is ACTUALLY filled on the open Agreements proposal form (from the member screen). Call before saying ready or moving to the next field. Compare collected_fields vs fields_on_screen — if form_synced is false, call prepare_governance_proposal again; never tell the user to publish.',
    inputSchema,
    execute: async (args: z.infer<typeof inputSchema>) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.message };
      }
      return buildProposalFormStateResponse({
        snapshot: snapshotFromRequest,
        proposalType: parsed.data.proposal_type,
        collectedFields: parsed.data.collected_fields,
      });
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
