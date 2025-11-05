import { z } from 'zod';
import { EVENT_ENTITY_TYPES } from './types';

export const schemaCreateEventProps = {
  type: z.string().trim(),
  referenceId: z.number(),
  referenceEntity: z.enum(EVENT_ENTITY_TYPES),
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
