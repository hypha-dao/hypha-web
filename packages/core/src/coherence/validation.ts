import { z } from 'zod';
import { COHERENCE_STATUSES } from './coherence-statuses';
import { COHERENCE_TYPES } from './coherence-types';
import { COHERENCE_TAGS } from './coherence-tags';

export const createCoherenceWeb2Props = {
  status: z.enum(COHERENCE_STATUSES),
  type: z.enum(COHERENCE_TYPES),
  title: z
    .string()
    .trim()
    .min(1, { message: 'Please add a title for your coherence' })
    .max(50),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Please add content to your coherence' })
    .max(4000),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    )
    .optional(),
  roomId: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Room ID must contain only lowercase letters, numbers, and hyphens',
    )
    .optional(),
  creatorId: z.number().min(1),
  spaceId: z.number().min(1),
  archived: z.boolean(),
  tags: z.array(z.enum(COHERENCE_TAGS)).default([]),
};
export const schemaCreateCoherenceWeb2 = z.object(createCoherenceWeb2Props);

export const schemaCreateCoherence = z.object({
  ...createCoherenceWeb2Props,
});

export const schemaCreateCoherenceForm = z.object({
  ...createCoherenceWeb2Props,
});
