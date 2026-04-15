import { tool } from 'ai';
import { z } from 'zod';
import { fetchOrgMemoryAsset } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { sanitizeSlug } from '../system-prompt';

const inputSchema = z.object({
  space_slug: z
    .string()
    .trim()
    .min(1)
    .describe('Hypha space slug (same as get_org_memory_by_space_slug)'),
  asset_key: z
    .string()
    .trim()
    .min(1)
    .describe('Opaque key from org_memory_assets[].asset_key'),
  return_mode: z
    .enum(['auto', 'text_only', 'binary_as_base64'])
    .optional()
    .default('auto'),
  max_bytes: z
    .number()
    .int()
    .min(1024)
    .max(4 * 1024 * 1024)
    .optional()
    .default(2 * 1024 * 1024),
});

export function createFetchOrgMemoryAssetTool(
  authToken: string,
  requestUrlForSessionMatrix?: string,
) {
  return tool({
    description:
      'Fetch bytes for one org-memory asset (asset_key from get_org_memory_by_space_slug). auto: text files, PDF text extraction, base64 for images/video/Office for multimodal models. Matrix: verifies room+event references MXC via GET /event (not limited to last /messages page), then downloads media with Bearer. max_bytes default 2 MiB.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          ok: false as const,
          error: parsed.error.message,
          code: 'invalid_asset_key' as const,
        };
      }
      const toolArgs = parsed.data;
      const safe = sanitizeSlug(toolArgs.space_slug);
      if (!safe) {
        return {
          ok: false as const,
          error: 'Invalid space slug format',
          code: 'invalid_asset_key' as const,
        };
      }

      const gated = await fetchOrgMemoryAsset(
        {
          spaceSlug: safe,
          asset_key: toolArgs.asset_key,
          return_mode: toolArgs.return_mode,
          max_bytes: toolArgs.max_bytes,
        },
        { db, authToken, requestUrlForSessionMatrix },
      );

      if (gated.access === 'denied') {
        return {
          ok: false as const,
          error: gated.message,
          code: 'access_denied' as const,
        };
      }
      return gated.result;
    },
    toModelOutput: async ({ output }) => {
      if (!output || typeof output !== 'object') {
        return { type: 'json', value: output as never };
      }
      const o = output as {
        ok?: boolean;
        error?: string;
        mode?: string;
        text?: string;
        filename?: string;
        mime?: string;
        text_truncated?: boolean;
        byte_length?: number;
        data_base64?: string;
        code?: string;
      };
      if (o.ok === false) {
        return {
          type: 'text',
          value: `fetch_org_memory_asset failed: ${o.error ?? 'unknown'}${
            o.code ? ` (${o.code})` : ''
          }`,
        };
      }
      if (o.mode === 'text') {
        const head = `File: ${o.filename ?? 'unknown'} (${o.mime ?? ''})\n`;
        const body = o.text ?? '';
        const tail = o.text_truncated ? '\n\n[truncated]' : '';
        return { type: 'text', value: head + body + tail };
      }
      if (o.mode === 'binary' && o.data_base64 && o.mime) {
        const mime = o.mime.toLowerCase();
        if (mime.startsWith('image/')) {
          return {
            type: 'content',
            value: [
              {
                type: 'text',
                text: `Image: ${o.filename ?? 'file'} (${o.mime}, ${
                  o.byte_length ?? 0
                } bytes)`,
              },
              {
                type: 'image-data',
                data: o.data_base64,
                mediaType: o.mime,
              },
            ],
          };
        }
        const kind = mime.startsWith('video/')
          ? 'Video'
          : mime.startsWith('audio/')
          ? 'Audio'
          : 'File';
        return {
          type: 'content',
          value: [
            {
              type: 'text',
              text: `${kind}: ${o.filename ?? 'file'} (${o.mime}, ${
                o.byte_length ?? 0
              } bytes). Office/video are attached as file-data for the model (no auto transcription).`,
            },
            {
              type: 'file-data',
              data: o.data_base64,
              mediaType: o.mime,
              filename: o.filename,
            },
          ],
        };
      }
      return { type: 'json', value: o as never };
    },
  });
}
