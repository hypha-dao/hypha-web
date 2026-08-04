export type SpaceVisualPromptInput = {
  space_purpose: string;
  visual_vibe: string;
};

/** Hard constraint: AI image models mangle letters — never ask for on-image text. */
export const NO_TEXT_IN_IMAGE =
  'CRITICAL PRINCIPLE — ZERO TEXT IN THE IMAGE: do not render any words, letters, numbers, initials, monograms, logos-as-type, captions, labels, watermarks, signatures, UI chrome, or the space name. Pure imagery only. If tempted to add typography, leave it blank.';

const LOGO_QUALITY =
  'Premium emblematic mark — mindblowing, not basic. Avoid generic flat clipart, simple geometric shapes alone, stock-icon silhouettes, or cookie-cutter startup badges. Invent a striking, original symbol with depth, light, material presence, and memorable silhouette. Think sculptural brand mark or luminous sigil: refined, mature, and distinctive at small size. Centered subject, rich but controlled palette, high craft, square composition suitable as an app icon.';

const BANNER_QUALITY =
  'Mature, inspirational, cinematic landscape — editorial or fine-art quality. Atmospheric depth, evocative light, and a single powerful visual idea that feels purposeful and alive. Avoid generic stock gradients, bland corporate banners, or cluttered collages. Polished, emotionally resonant, and symbolic of the community purpose.';

export function buildLogoPrompt(args: SpaceVisualPromptInput): string {
  return [
    'Create a square brand mark / app icon for a Hypha DAO community space.',
    `Purpose to express visually: ${args.space_purpose}.`,
    `Mood, symbolism, and aesthetic direction: ${args.visual_vibe}.`,
    'Use the purpose and mood as conceptual inspiration only — never write them in the image.',
    LOGO_QUALITY,
    NO_TEXT_IN_IMAGE,
  ].join(' ');
}

export function buildBannerPrompt(args: SpaceVisualPromptInput): string {
  return [
    'Create a wide cinematic banner for a Hypha DAO community space profile header.',
    `Purpose to express visually: ${args.space_purpose}.`,
    `Mood, symbolism, and aesthetic direction: ${args.visual_vibe}.`,
    'Use the purpose and mood as conceptual inspiration only — never write them in the image.',
    BANNER_QUALITY,
    NO_TEXT_IN_IMAGE,
  ].join(' ');
}
