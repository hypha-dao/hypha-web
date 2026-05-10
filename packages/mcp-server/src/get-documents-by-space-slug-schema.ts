import { z } from 'zod';

const documentStateSchema = z.enum(['discussion', 'proposal', 'agreement']);

/** Parity with `spaceSlugSchema` in `@hypha-platform/core`. */
/** TODO: Prefer importing `slugSchema` from `common-schemas.ts` once TS2589 is resolved here. */
const mcpSpaceSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(
    /^[a-z0-9'-]+$/,
    'Slug must contain only lowercase letters, numbers, hyphens, and apostrophes',
  );

const creatorSchema = z
  .object({
    avatarUrl: z.string().optional(),
    name: z.string().optional(),
    surname: z.string().optional(),
    address: z.string().optional(),
    type: z.enum(['person', 'space']).optional(),
  })
  .optional();

const attachmentSchema = z.union([
  z.string(),
  z.object({ name: z.string(), url: z.string() }),
]);

export const getDocumentsBySpaceSlugInputSchema = z.object({
  space_slug: mcpSpaceSlugSchema,
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(20),
  searchTerm: z.string().optional(),
  state: documentStateSchema.optional(),
});

export type GetDocumentsBySpaceSlugInput = z.infer<
  typeof getDocumentsBySpaceSlugInputSchema
>;

export const getDocumentsBySpaceSlugOutputSchema = z.object({
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
  documents: z.array(
    z.object({
      id: z.number(),
      creatorId: z.number(),
      title: z.string(),
      description: z.string().optional(),
      slug: z.string().optional(),
      state: documentStateSchema,
      createdAt: z.string(),
      updatedAt: z.string(),
      creator: creatorSchema,
      leadImage: z.string().optional(),
      attachments: z.array(attachmentSchema).optional(),
      web3ProposalId: z.number().nullable(),
      label: z.string().optional(),
      status: z.enum(['accepted', 'rejected', 'onVoting']).optional(),
    }),
  ),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
    has_next_page: z.boolean(),
    has_previous_page: z.boolean(),
  }),
});
