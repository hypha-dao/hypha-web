export type SpaceVisualPromptInput = {
  space_purpose: string;
  visual_vibe: string;
};

/** Hard constraint: AI image models mangle letters — never ask for on-image text. */
export const NO_TEXT_IN_IMAGE =
  'CRITICAL PRINCIPLE — ZERO TEXT IN THE IMAGE: do not render any words, letters, numbers, initials, monograms, logos-as-type, captions, labels, watermarks, signatures, UI chrome, or the space name. Pure imagery only. If tempted to add typography, leave it blank.';

const ANTI_SYNTHETIC =
  'Reject the synthetic look entirely: no neon, no bioluminescent glow, no glowing veins or roots, no god rays, no lens flare, no fantasy CGI, no symmetrical mystical subject, no plastic surfaces, no oversaturated color, no unreal-engine or octane render, no stock concept art. One clear subject. Quiet, specific, and believable.';

const LOGO_QUALITY =
  'Square brand mark that could be a real object or a precise printed emblem. One symbol, generous empty ground, true materials such as ink, paper, metal, stone, wood, or a living plant. Soft natural light. Designed, not illustrated fantasy. Reads clearly at a small size.';

const BANNER_QUALITY =
  'Wide documentary photograph for a community profile header. A real place, real texture, and ordinary daylight or a simple interior. Editorial and calm. If the subject is a tree, forest, or landscape, photograph a real one — not a centered heroic illustration. Not a movie poster and not concept art.';

const SYNTHETIC_PHRASES =
  /\b(neon|bioluminescent|god\s?rays?|octane|unreal(?:\s+engine)?|hyper[- ]detailed|ethereal|magical|energy (?:lines|roots|veins)|cinematic(?: lighting)?|lens flare|fantasy|glowing)\b/gi;

/** Drop directions that push the generator into fantasy concept art. */
export function groundVisualVibe(vibe: string): string {
  return vibe
    .replace(SYNTHETIC_PHRASES, '')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*,\s*){2,}/g, ', ')
    .replace(/^\s*,\s*|\s*,\s*$/g, '')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

export function buildLogoPrompt(args: SpaceVisualPromptInput): string {
  const vibe = groundVisualVibe(args.visual_vibe);
  return [
    'Create a square brand mark for a community organisation.',
    `Purpose to express visually, as a real object or printed emblem: ${args.space_purpose}.`,
    vibe ? `Material, place, and light: ${vibe}.` : '',
    'Use the purpose only as the subject. Never write it in the image.',
    LOGO_QUALITY,
    ANTI_SYNTHETIC,
    NO_TEXT_IN_IMAGE,
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildBannerPrompt(args: SpaceVisualPromptInput): string {
  const vibe = groundVisualVibe(args.visual_vibe);
  return [
    'Create a wide photograph for a community profile header.',
    `Purpose to express as a real place or object: ${args.space_purpose}.`,
    vibe ? `Place, material, and light: ${vibe}.` : '',
    'Use the purpose only as the subject. Never write it in the image.',
    BANNER_QUALITY,
    ANTI_SYNTHETIC,
    NO_TEXT_IN_IMAGE,
  ]
    .filter(Boolean)
    .join(' ');
}
