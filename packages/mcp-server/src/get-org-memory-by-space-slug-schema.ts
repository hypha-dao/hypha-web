import { z } from 'zod';
import {
  getPeopleBySpaceSlugInputSchema,
  getPeopleBySpaceSlugOutputSchema,
} from './get-people-by-space-slug-schema.js';

/** Roster inputs plus optional pagination/filter for `org_memory_assets`. */
export const getOrgMemoryBySpaceSlugInputSchema =
  getPeopleBySpaceSlugInputSchema.extend({
    assets_page: z.number().int().min(1).optional().default(1),
    assets_page_size: z.number().int().min(1).max(100).optional().default(50),
    assets_search: z.string().optional(),
  });

export type GetOrgMemoryBySpaceSlugInput = z.infer<
  typeof getOrgMemoryBySpaceSlugInputSchema
>;

const orgMemoryAssetSchema = z.object({
  source: z.enum([
    'proposal_upload',
    'matrix_chat',
    'call_recording',
    'call_transcript',
    'discussion_summary',
  ]),
  filename: z.string(),
  asset_key: z.string().optional(),
  mime: z.string().optional(),
  app_url: z.string().optional(),
  mxc_uri: z.string().optional(),
  matrix_room_id: z.string().optional(),
  matrix_event_id: z.string().optional(),
  document_id: z.number().optional(),
  document_title: z.string().optional(),
  document_state: z.string().optional(),
  document_slug: z.string().optional(),
  document_label: z.string().optional(),
  call_session_id: z.string().optional(),
  call_recording_id: z.number().int().optional(),
  call_transcript_id: z.number().int().optional(),
  discussion_summary_id: z.number().int().optional(),
  text_excerpt: z.string().optional(),
  occurred_at: z.string(),
});

const assetsPaginationSchema = z.object({
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  total_pages: z.number(),
  has_next_page: z.boolean(),
  has_previous_page: z.boolean(),
});

const matrixFetchMetaSchema = z.object({
  attempted: z.boolean(),
  skipped_reason: z
    .enum([
      'missing_homeserver_url',
      'missing_access_token',
      'missing_chat_room_id',
    ])
    .nullable(),
  chat_room_id: z.string().nullable(),
  homeserver_configured: z.boolean(),
  access_token_configured: z.boolean(),
  used_bot_access_token: z.boolean(),
  used_session_matrix_token: z.boolean(),
  session_matrix_token_unavailable: z.boolean(),
  http_status: z.number().nullable(),
  events_in_chunk: z.number(),
  media_events_yielded: z.number(),
  hypha_media_bundle_slots: z.number(),
  error: z.string().nullable(),
});

/**
 * Roster payload (ISO dates) plus `org_memory_assets` and separate asset pagination.
 */
export const getOrgMemoryBySpaceSlugOutputSchema =
  getPeopleBySpaceSlugOutputSchema.extend({
    org_memory_assets: z.array(orgMemoryAssetSchema),
    assets_pagination: assetsPaginationSchema,
    matrix_fetch: matrixFetchMetaSchema,
  });

export type GetOrgMemoryBySpaceSlugOutput = z.infer<
  typeof getOrgMemoryBySpaceSlugOutputSchema
>;
