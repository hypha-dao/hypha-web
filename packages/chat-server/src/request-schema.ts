import { z } from 'zod';

export const chatRequestSchema = z.object({
  messages: z.array(z.record(z.unknown())),
  spaceSlug: z.string().nullish(),
});
