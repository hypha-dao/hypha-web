import { z } from 'zod';

const createSpaceWeb2 = {
  title: z.string().min(1).max(50),
  description: z.string().min(1).max(300),
  slug: z.string().optional(),
};

export const schemaCreateSpaceWeb2 = z.object(createSpaceWeb2);

const createSpaceWeb3 = {
  quorum: z.number().min(1).max(100),
  unity: z.number().min(1).max(100),
  votingPowerSource: z.number().min(0).max(100),
  joinMethod: z.number().min(0).max(100),
  exitMethod: z.number().min(0).max(100),
};
export const schemaCreateSpaceWeb3 = z.object(createSpaceWeb3);

export const schemaCreateSpace = z.object({
  ...createSpaceWeb2,
  ...createSpaceWeb3,
});
