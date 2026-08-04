import slugify from 'slugify';
import { z } from 'zod';
import type { ChatRouteTool } from './types';
import { generateOpenRouterImage } from '../openrouter-image';
import { uploadGeneratedImageDataUrl } from '../upload-generated-image';
import { sanitizeSlug } from '../system-prompt';
import { buildBannerPrompt, buildLogoPrompt } from './space-visual-prompts';

const assetKindSchema = z.enum(['logo', 'banner', 'both']);

const inputSchema = z.object({
  space_name: z.string().trim().min(1).max(120),
  space_purpose: z.string().trim().min(1).max(300),
  visual_vibe: z.string().trim().min(1).max(400),
  asset_kind: assetKindSchema.optional().default('both'),
});

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
    const failures: string[] = [];

    if (shouldGenerateLogo) {
      try {
        const logoDataUrl = await generateOpenRouterImage(
          buildLogoPrompt(data),
        );
        logoUrl = await uploadGeneratedImageDataUrl(
          logoDataUrl,
          `${slugStem}-logo`,
        );
      } catch (error) {
        failures.push(
          error instanceof Error ? error.message : 'Logo generation failed.',
        );
      }
    }

    if (shouldGenerateBanner) {
      try {
        const bannerDataUrl = await generateOpenRouterImage(
          buildBannerPrompt(data),
        );
        leadImageUrl = await uploadGeneratedImageDataUrl(
          bannerDataUrl,
          `${slugStem}-banner`,
        );
      } catch (error) {
        failures.push(
          error instanceof Error ? error.message : 'Banner generation failed.',
        );
      }
    }

    if (!logoUrl && !leadImageUrl) {
      return {
        ok: false,
        error: failures.join(' ') || 'Image generation failed.',
      };
    }

    return {
      ok: true,
      logo_url: logoUrl,
      lead_image_url: leadImageUrl,
      next_step:
        failures.length > 0
          ? `Partial success (${failures.join(
              '; ',
            )}). Show the generated visuals to the user and ask whether they want to use them or regenerate.`
          : 'Show the generated visuals to the user and ask whether they want to use them for space creation or regenerate with a different vibe.',
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
      'Generate Hypha space visual assets (square icon/logo and/or wide banner) from the space purpose and desired vibe. HARD RULE: images must be text-free — never put words, letters, or the space name in the image. Aim for mature, inspirational, mindblowing craft (not basic flat icons). Pass rich visual_vibe (mood, symbols, light, materials, composition) — never slogans to render. Returns hosted https URLs suitable for create_space_from_onboarding. Always use this when the user asks to generate images, logos, banners, or placeholders — never say images must wait until after creation.',
    inputSchema,
    execute: async (args) => generateSpaceVisualAssets(args),
  } satisfies ChatRouteTool<typeof inputSchema>;
}
