import { z } from 'zod';

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid space slug format');

export const getPeopleBySpaceSlugInputSchema = z.object({
  space_slug: slugSchema.describe('Hypha space slug of the active space'),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(20),
  searchTerm: z.string().optional(),
});

export type GetPeopleBySpaceSlugInput = z.infer<
  typeof getPeopleBySpaceSlugInputSchema
>;

const membershipSnakeSchema = z.object({
  id: z.number(),
  person_id: z.number(),
  space_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

const personPublicSchema = z.object({
  id: z.number(),
  slug: z.string().optional(),
  name: z.string().optional(),
  surname: z.string().optional(),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
  leadImageUrl: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  nickname: z.string().optional(),
  address: z.string().optional(),
  links: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const rosterPersonSchema = z.object({
  member_kind: z.literal('person'),
  membership: membershipSnakeSchema.nullable(),
  join_source: z.enum(['membership', 'unknown']),
  joined_at: z.string().nullable(),
  person: personPublicSchema,
});

const rosterSpaceSchema = z.object({
  member_kind: z.literal('space'),
  membership: z.null(),
  join_source: z.literal('unknown'),
  joined_at: z.null(),
  space: z.record(z.unknown()),
});

/** Structured tool payload (validated after JSON serialization of dates). */
export const getPeopleBySpaceSlugOutputSchema = z.object({
  found: z.boolean(),
  space_slug: z.string(),
  space: z
    .object({
      id: z.number(),
      slug: z.string(),
      title: z.string(),
      parent_id: z.number().nullable(),
    })
    .nullable(),
  source: z.literal('db'),
  source_chain: z.enum(['rpc']).nullable(),
  asOf: z.string(),
  members: z.array(z.union([rosterPersonSchema, rosterSpaceSchema])),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
    has_next_page: z.boolean(),
    has_previous_page: z.boolean(),
  }),
});
