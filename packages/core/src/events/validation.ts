import { z } from 'zod';

export const schemaEvent = z.object({
  id: z.number(),
  type: z.string().trim(),
  createdAt: z.date(),
  referenceId: z.number(),
  referenceEntity: z.enum(['person', 'space', 'document', 'token']),
  parameters: z.object({}),
});

export type EventSchema = z.infer<typeof schemaEvent>;
