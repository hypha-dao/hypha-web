import slugify from 'slugify';
import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { generateOpenRouterImage } from '../openrouter-image';
import { uploadGeneratedImageDataUrl } from '../upload-generated-image';
import { sanitizeSlug } from '../system-prompt';

const assetKindSchema = z.enum(['logo', 'banner', 'both']);

const inputSchema = z.object({
  space_name: z.string().trim().min(1).max(120),
  space_purpose: z.string().trim().min(1).max(300),
  visual_vibe: z.string().trim().min(1).max(200),
  asset_kind: assetKindSchema.optional().default('both'),
});

function buildLogoPrompt(args: z.infer<typeof inputSchema>): string {
  return [
    'Create a clean, modern square app icon for a Hypha DAO community space.',
    `Space name: ${args.space_name}.`,
    `Purpose: ${args.space_purpose}.`,
    `Mood / vibe: ${args.visual_vibe}.`,
    'Minimal flat vector style, strong silhouette, no text, no watermark, centered subject, solid or soft gradient background, high contrast, professional community branding.',
  ].join(' ');
}

function buildBannerPrompt(args: z.infer<typeof inputSchema>): string {
  return [
    'Create a wide cinematic banner image for a Hypha DAO community space profile header.',
    `Space name: ${args.space_name}.`,
    `Purpose: ${args.space_purpose}.`,
    `Mood / vibe: ${args.visual_vibe}.`,
    'Landscape composition, atmospheric depth, no text, no watermark, abstract or symbolic imagery that fits the purpose, polished and inviting.',
  ].join(' ');
}

export async function generateSpaceVisualAssets(
  args: z.infer<typeof inputSchema>,
): Promise<
  | {
      ok: true;
      logo_url: string | null;
      lead_image_url: string | null;
      next_step: string;
    }
  | { ok: false; error: string }
> {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;

  const slugStem =
    sanitizeSlug(slugify(data.space_name, { lower: true })) ?? 'space';

  try {
    const shouldGenerateLogo =
      data.asset_kind === 'logo' || data.asset_kind === 'both';
    const shouldGenerateBanner =
      data.asset_kind === 'banner' || data.asset_kind === 'both';

    let logoUrl: string | null = null;
    let leadImageUrl: string | null = null;

    if (shouldGenerateLogo) {
      const logoDataUrl = await generateOpenRouterImage(buildLogoPrompt(data));
      logoUrl = await uploadGeneratedImageDataUrl(
        logoDataUrl,
        `${slugStem}-logo`,
      );
    }

    if (shouldGenerateBanner) {
      const bannerDataUrl = await generateOpenRouterImage(
        buildBannerPrompt(data),
      );
      leadImageUrl = await uploadGeneratedImageDataUrl(
        bannerDataUrl,
        `${slugStem}-banner`,
      );
    }

    return {
      ok: true,
      logo_url: logoUrl,
      lead_image_url: leadImageUrl,
      next_step:
        'Show the generated visuals to the user and ask whether they want to use them for space creation or regenerate with a different vibe.',
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Image generation failed.';
    return { ok: false, error: message };
  }
}

export function createGenerateSpaceVisualAssetsTool() {
  return {
    description:
      'Generate Hypha space visual assets (square icon/logo and/or wide banner) from the space name, purpose, and desired vibe. Returns hosted https URLs suitable for create_space_from_onboarding. Always use this when the user asks to generate images, logos, banners, or placeholders — never say images must wait until after creation.',
    inputSchema,
    execute: async (args) => generateSpaceVisualAssets(args),
  } satisfies ChatRouteTool<typeof inputSchema>;
}
