import { z } from 'zod';

export const setupPhaseSchema = z.enum([
  'discover',
  'draft',
  'confirm',
  'execute',
  'verify',
]);

const proposalQueueItemSchema = z.object({
  title: z.string().min(1),
  status: z.enum(['drafted', 'submitted', 'onVoting', 'accepted', 'rejected']),
});

const ecosystemBlueprintItemSchema = z.object({
  key: z.string().min(1),
  role: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['planned', 'confirmed', 'created']).default('planned'),
});

function sanitizeSetupPlanInput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const plan = { ...(raw as Record<string, unknown>) };
  if (Array.isArray(plan.proposalQueue)) {
    plan.proposalQueue = plan.proposalQueue.filter(
      (item) => proposalQueueItemSchema.safeParse(item).success,
    );
  }
  if (Array.isArray(plan.ecosystemBlueprint)) {
    plan.ecosystemBlueprint = plan.ecosystemBlueprint.filter(
      (item) => ecosystemBlueprintItemSchema.safeParse(item).success,
    );
  }
  return plan;
}

export const setupPlanSchema = z.preprocess(
  sanitizeSetupPlanInput,
  z.object({
    spaceIntent: z
      .object({
        title: z.string().optional(),
        purpose: z.string().optional(),
        audience: z.string().optional(),
      })
      .optional(),
    governance: z
      .object({
        transparency: z.string().optional(),
        entryMethod: z.string().optional(),
        votingModel: z.string().optional(),
      })
      .optional(),
    tokenSetup: z
      .object({
        needsToken: z.boolean().optional(),
        treasuryIntent: z.string().optional(),
      })
      .optional(),
    proposalQueue: z.array(proposalQueueItemSchema).optional(),
    ecosystemBlueprint: z.array(ecosystemBlueprintItemSchema).optional(),
  }),
);

export type SetupPhase = z.infer<typeof setupPhaseSchema>;
export type SetupPlan = z.infer<typeof setupPlanSchema>;
