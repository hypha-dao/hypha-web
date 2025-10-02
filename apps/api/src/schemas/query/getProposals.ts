import z from 'zod';

export const getProposalsQuery = z.object({
  dao_id: z.string().optional().min(1).max(300).catch(undefined),
  status: z.enum(['active', 'past']).catch('active'),
  limit: z.coerce.number().int().min(0).max(100).catch(20),
  offset: z.coerce.number().int().min(0).catch(0),
});
