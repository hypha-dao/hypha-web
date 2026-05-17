import { z } from 'zod';

export const setupPhaseSchema = z.enum([
  'discover',
  'draft',
  'confirm',
  'execute',
  'verify',
]);

export const setupPlanSchema = z.object({
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
  proposalQueue: z
    .array(
      z.object({
        title: z.string().min(1),
        status: z.enum([
          'drafted',
          'submitted',
          'onVoting',
          'accepted',
          'rejected',
        ]),
      }),
    )
    .optional(),
  ecosystemBlueprint: z
    .array(
      z.object({
        key: z.string().min(1),
        role: z.string().min(1),
        title: z.string().min(1),
        status: z.enum(['planned', 'confirmed', 'created']).default('planned'),
      }),
    )
    .optional(),
});

export type SetupPhase = z.infer<typeof setupPhaseSchema>;
export type SetupPlan = z.infer<typeof setupPlanSchema>;
