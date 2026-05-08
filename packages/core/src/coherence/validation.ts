import { z } from 'zod';
import { COHERENCE_SIGNAL_TYPES } from './coherence-types';
import { COHERENCE_PRIORITIES } from './coherence-priorities';

const coherenceTagsSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(50)
  .transform((tags) => {
    const seen = new Set<string>();
    const uniqueTags: string[] = [];
    for (const tag of tags) {
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      uniqueTags.push(tag);
    }
    return uniqueTags;
  })
  .default([]);

const coherenceSignalFields = {
  type: z.enum(COHERENCE_SIGNAL_TYPES),
  priority: z.enum(COHERENCE_PRIORITIES),
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
  tags: coherenceTagsSchema,
};

const coherenceSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(
    /^[a-z0-9-]+$/,
    'Slug must contain only lowercase letters, numbers, and hyphens',
  );

export const createCoherenceWeb2Props = {
  ...coherenceSignalFields,
  slug: coherenceSlugSchema.optional(),
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
};
export const schemaCreateCoherenceWeb2 = z.object(createCoherenceWeb2Props);

export const schemaCreateCoherence = schemaCreateCoherenceWeb2;
export const schemaCreateCoherenceForm = schemaCreateCoherenceWeb2;

export const schemaUpdateCoherenceSignalBySlug = z.object({
  slug: coherenceSlugSchema,
  ...coherenceSignalFields,
});
