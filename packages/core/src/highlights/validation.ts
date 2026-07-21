import { z } from 'zod';
import { HIGHLIGHTS_BLOCK_TYPES } from './types';

const blockItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(2000).optional(),
  imageUrl: z.string().max(2000).optional(),
  caption: z.string().max(500).optional(),
  url: z.string().max(2000).optional(),
  label: z.string().max(200).optional(),
});

export const highlightsBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(HIGHLIGHTS_BLOCK_TYPES),
  order: z.number().int().min(0),
  visible: z.boolean(),
  title: z.string().max(200).optional(),
  body: z.string().max(20000).optional(),
  items: z.array(blockItemSchema).max(24).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const highlightsSupportActionSchema = z.object({
  id: z.string().min(1),
  label: z.enum(['donate', 'invest', 'support', 'custom']),
  customLabel: z.string().max(80).optional(),
  enabled: z.boolean(),
  destination: z.enum(['wallet', 'iban', 'bank_rail', 'external_url']),
  walletAddress: z.string().max(200).optional(),
  bankingRail: z.string().max(64).optional(),
  externalUrl: z.string().max(2000).optional(),
  copyInstructions: z.string().max(1000).optional(),
});

export const schemaUpsertHighlightProfile = z.object({
  summary: z.string().trim().max(160).nullable().optional(),
  coverImageUrl: z.string().trim().max(2000).nullable().optional(),
  goalAmount: z.string().trim().max(64).nullable().optional(),
  goalCurrency: z.string().trim().max(8).nullable().optional(),
  blocks: z.array(highlightsBlockSchema).max(40),
  supportActions: z.array(highlightsSupportActionSchema).max(10),
});

export const schemaPublishHighlightProfile = z.object({
  published: z.boolean(),
});

export type UpsertHighlightProfileInput = z.infer<
  typeof schemaUpsertHighlightProfile
>;
