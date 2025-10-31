import { z } from 'zod';

export const schemaCreateEventProps = {
  type: z.string().trim(),
  referenceId: z.number(),
  referenceEntity: z.enum(['person', 'space', 'document', 'token']),
  parameters: z.object({}),
};

export const schemaCreateEvent = z.object({
  ...schemaCreateEventProps,
});

export const schemaEvent = z.object({
  id: z.number(),
  createdAt: z.date(),
  ...schemaCreateEventProps,
});

export type EventSchema = z.infer<typeof schemaEvent>;
export type CreateEventSchema = z.infer<typeof schemaCreateEvent>;
