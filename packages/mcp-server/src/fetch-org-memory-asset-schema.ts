import { z } from 'zod';

export const fetchOrgMemoryAssetInputSchema = z.object({
  space_slug: z.string().trim().min(1),
  asset_key: z
    .string()
    .trim()
    .min(1)
    .describe(
      'Opaque key from org_memory_assets[].asset_key (get_org_memory_by_space_slug)',
    ),
  return_mode: z
    .enum(['auto', 'text_only', 'binary_as_base64'])
    .optional()
    .default('auto')
    .describe(
      'auto: UTF-8 text + PDF text extraction + images as base64; text_only: text/PDF only; binary_as_base64: raw base64 for image/* and application/pdf',
    ),
  max_bytes: z
    .number()
    .int()
    .min(1024)
    .max(4 * 1024 * 1024)
    .optional()
    .default(2 * 1024 * 1024),
});

export type FetchOrgMemoryAssetInput = z.infer<
  typeof fetchOrgMemoryAssetInputSchema
>;

const successTextSchema = z.object({
  ok: z.literal(true),
  filename: z.string(),
  mime: z.string(),
  mode: z.literal('text'),
  text: z.string().optional(),
  text_truncated: z.boolean().optional(),
  byte_length: z.number(),
});

const successBinarySchema = z.object({
  ok: z.literal(true),
  filename: z.string(),
  mime: z.string(),
  mode: z.literal('binary'),
  data_base64: z.string().optional(),
  byte_length: z.number(),
});

const failureSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  code: z
    .enum([
      'invalid_asset_key',
      'access_denied',
      'not_found',
      'unsupported_type',
      'too_large',
      'fetch_failed',
      'matrix_auth',
      'decode_failed',
    ])
    .optional(),
});

export const fetchOrgMemoryAssetOutputSchema = z.union([
  successTextSchema,
  successBinarySchema,
  failureSchema,
]);

export type FetchOrgMemoryAssetOutput = z.infer<
  typeof fetchOrgMemoryAssetOutputSchema
>;
