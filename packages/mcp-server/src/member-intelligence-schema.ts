import { z } from 'zod';

const orientationSchema = z.enum(['member', 'builder', 'investor']).nullable();

const attentionSchema = z.object({
  id: z.string(),
  kind: z.enum(['proposal', 'signal']),
  title: z.string(),
  detail: z.string(),
  spaceSlug: z.string(),
  spaceTitle: z.string(),
  targetSlug: z.string(),
});

export const memberToolInputSchema = z.object({
  limit: z.number().int().min(1).max(24).optional().default(6),
});

export const getMemberIntelligenceOutputSchema = z.object({
  person: z.object({
    id: z.number(),
    slug: z.string(),
    name: z.string().nullable(),
    surname: z.string().nullable(),
    nickname: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    description: z.string().nullable(),
    address: z.string().nullable(),
    preferredCurrency: z.string().nullable(),
    primaryOrientation: orientationSchema,
  }),
  counts: z.object({
    spaces: z.number(),
    openProposals: z.number(),
    signals: z.number(),
    connections: z.number(),
    notifications: z.number(),
    capitalAsks: z.number(),
  }),
  guidance: z.object({
    narrative: z.string(),
  }),
  attention: z.array(attentionSchema),
  spaces: z.array(
    z.object({
      id: z.number(),
      slug: z.string(),
      title: z.string(),
      description: z.string(),
      logoUrl: z.string().nullable(),
    }),
  ),
  proposals: z.array(
    z.object({
      id: z.number(),
      slug: z.string().nullable(),
      title: z.string(),
      state: z.string().nullable(),
      label: z.string().nullable(),
      spaceSlug: z.string(),
      spaceTitle: z.string(),
      createdAt: z.string(),
      authoredByMember: z.boolean(),
      web3ProposalId: z.number().nullable(),
    }),
  ),
  signals: z.array(
    z.object({
      id: z.number(),
      slug: z.string().nullable(),
      title: z.string(),
      type: z.string(),
      priority: z.string().nullable(),
      spaceSlug: z.string(),
      spaceTitle: z.string(),
      assignedToMember: z.boolean(),
    }),
  ),
  notifications: z.array(attentionSchema),
  connections: z.array(
    z.object({
      id: z.number(),
      slug: z.string().nullable(),
      name: z.string().nullable(),
      surname: z.string().nullable(),
      nickname: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      sharedSpaceCount: z.number(),
    }),
  ),
  wallet: z.object({
    address: z.string().nullable(),
    preferredCurrency: z.string().nullable(),
  }),
  chatSpaceSlug: z.string().nullable(),
});

export const getMemberSpacesOutputSchema = z.object({
  spaces: getMemberIntelligenceOutputSchema.shape.spaces,
  count: z.number(),
});

export const getMemberProposalsOutputSchema = z.object({
  proposals: getMemberIntelligenceOutputSchema.shape.proposals,
  openProposals: z.number(),
});

export const getMemberSignalsOutputSchema = z.object({
  signals: getMemberIntelligenceOutputSchema.shape.signals,
  count: z.number(),
});

export const getMemberNotificationsOutputSchema = z.object({
  notifications: z.array(attentionSchema),
  attention: z.array(attentionSchema),
  guidance: z.object({ narrative: z.string() }),
});

export const getMemberConnectionsOutputSchema = z.object({
  connections: getMemberIntelligenceOutputSchema.shape.connections,
  count: z.number(),
  chatSpaceSlug: z.string().nullable(),
});

export const getMemberWalletOutputSchema = z.object({
  wallet: getMemberIntelligenceOutputSchema.shape.wallet,
});
