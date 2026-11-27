/**
 * Background of the call's space for the camera effect (#2563): the space accent gradient (same
 * sampling as the space pages), the mycelium threads, the space logo towards the top right and a
 * small Hypha mark at the bottom left. Drawn in the browser at call time.
 *
 * Others see it as drawn; the member's own preview is mirrored, so the logo and mark appear on the
 * other side and the wordmark reads backwards there only.
 */

import { toCanvasSampleSrc } from '../optimize-remote-image';
import {
  sampleBannerReading,
  sampleImageToAccent,
} from '../../spaces/components/space-accent-from-images';
import { buildSpaceScopeStyleFromSampledAccents } from '../../spaces/utils/space-accent-scope-style';
import { SPACE_ACCENT_FALLBACK } from '../../spaces/utils/extract-space-accent';

export const SPACE_CALL_BACKGROUND_WIDTH = 1920;
export const SPACE_CALL_BACKGROUND_HEIGHT = 1080;

/** Same-origin assets: the mycelium threads and the white Hypha wordmark. */
const MYCELIUM_TEXTURE_SRC = '/call-backgrounds/mycelium-dark.jpg';
const HYPHA_MARK_SRC = '/brand/hypha-logo-white.png';

export type SpaceAccentStops = { deep: string; mid: string; luminous: string };

type Rect = { x: number; y: number; width: number; height: number };

/**
 * Where the logo and the mark go. The logo is a square tile (cropped to cover, like the space avatar
 * in the app) towards the top right, inset so a 4:3 or portrait crop (cover, centred) keeps most
 * of it; the mark is small, bottom left, keeping its aspect.
 */
export function spaceCallBackgroundLayout(
  width: number,
  height: number,
  hasLogo: boolean,
  markAspect: number | null,
): { logo: Rect | null; mark: Rect | null } {
  const logoSize = Math.round(height * 0.18);
  const logo: Rect | null = hasLogo
    ? {
        x: Math.round(width * 0.82 - logoSize / 2),
        y: Math.round(height * 0.11),
        width: logoSize,
        height: logoSize,
      }
    : null;
  let mark: Rect | null = null;
  if (markAspect && Number.isFinite(markAspect) && markAspect > 0) {
    const markWidth = Math.round(width * 0.075);
    const markHeight = Math.round(markWidth / markAspect);
    mark = {
      x: Math.round(width * 0.06),
      y: Math.round(height * 0.9 - markHeight),
      width: markWidth,
      height: markHeight,
    };
  }
  return { logo, mark };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  { x, y, width, height }: Rect,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

type DrawableImage = {
  image: CanvasImageSource;
  width: number;
  height: number;
};

export function drawSpaceCallBackground(
  ctx: CanvasRenderingContext2D,
  {
    width,
    height,
    stops,
    texture,
    logo,
    mark,
  }: {
    width: number;
    height: number;
    stops: SpaceAccentStops;
    texture: DrawableImage | null;
    logo: DrawableImage | null;
    mark: DrawableImage | null;
  },
): void {
  // Accent wash: deep at the bottom left to mid at the top right.
  const wash = ctx.createLinearGradient(0, height, width, 0);
  wash.addColorStop(0, stops.deep);
  wash.addColorStop(0.62, stops.mid);
  wash.addColorStop(1, stops.mid);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  // Luminous glow behind the logo.
  const glow = ctx.createRadialGradient(
    width * 0.82,
    height * 0.2,
    0,
    width * 0.82,
    height * 0.2,
    width * 0.55,
  );
  glow.addColorStop(0, stops.luminous);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  // Mycelium threads, screened in faintly (dark parts add nothing).
  if (texture) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.35;
    drawCover(ctx, texture, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Calm centre, where the person sits.
  const veil = ctx.createRadialGradient(
    width * 0.5,
    height * 0.55,
    0,
    width * 0.5,
    height * 0.55,
    width * 0.45,
  );
  veil.addColorStop(0, hexWithAlpha(stops.deep, 0.45));
  veil.addColorStop(1, hexWithAlpha(stops.deep, 0));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);

  const layout = spaceCallBackgroundLayout(
    width,
    height,
    Boolean(logo),
    mark ? mark.width / mark.height : null,
  );
  if (logo && layout.logo) {
    const radius = Math.min(layout.logo.width, layout.logo.height) * 0.22;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 6;
    roundedRectPath(ctx, layout.logo, radius);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundedRectPath(ctx, layout.logo, radius);
    ctx.clip();
    ctx.translate(layout.logo.x, layout.logo.y);
    drawCover(ctx, logo, layout.logo.width, layout.logo.height);
    ctx.restore();
  }
  if (mark && layout.mark) {
    ctx.globalAlpha = 0.5;
    ctx.drawImage(
      mark.image,
      layout.mark.x,
      layout.mark.y,
      layout.mark.width,
      layout.mark.height,
    );
    ctx.globalAlpha = 1;
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  { image, width: iw, height: ih }: DrawableImage,
  width: number,
  height: number,
) {
  const scale = Math.max(width / iw, height / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

function hexWithAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(0,0,0,${alpha})`;
  return `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(
    m[3]!,
    16,
  )},${alpha})`;
}

/** The space's accent stops, sampled exactly as the space pages do. */
export async function sampleSpaceAccentStops({
  leadImage,
  logoUrl,
}: {
  leadImage?: string | null;
  logoUrl?: string | null;
}): Promise<SpaceAccentStops> {
  const [bannerReading, logoAccent] = await Promise.all([
    leadImage
      ? sampleBannerReading(leadImage)
      : Promise.resolve({ hex: null, profile: null }),
    logoUrl ? sampleImageToAccent(logoUrl) : Promise.resolve(null),
  ]);
  const style = buildSpaceScopeStyleFromSampledAccents({
    bannerAccent: bannerReading.hex,
    logoAccent,
    bannerProfile: bannerReading.profile,
    overlayVars: null,
  }) as Record<string, string | undefined>;
  const mid = style['--space-accent'] ?? SPACE_ACCENT_FALLBACK;
  return {
    deep: style['--space-accent-deep'] ?? mid,
    mid,
    luminous: style['--space-accent-luminous'] ?? mid,
  };
}

function loadImage(src: string | null): Promise<DrawableImage | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () =>
      resolve(
        img.naturalWidth > 0
          ? { image: img, width: img.naturalWidth, height: img.naturalHeight }
          : null,
      );
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Draws the call's space background and returns it as a JPEG blob. A missing logo or texture is
 * left out; the accent falls back like the space pages. Throws only if the canvas fails.
 */
export async function renderSpaceCallBackground(space: {
  leadImage?: string | null;
  logoUrl?: string | null;
}): Promise<Blob> {
  const logoSrc = space.logoUrl
    ? toCanvasSampleSrc(space.logoUrl, 384, 85)
    : null;
  const [stops, texture, logo, mark] = await Promise.all([
    sampleSpaceAccentStops(space),
    loadImage(MYCELIUM_TEXTURE_SRC),
    loadImage(logoSrc),
    loadImage(HYPHA_MARK_SRC),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = SPACE_CALL_BACKGROUND_WIDTH;
  canvas.height = SPACE_CALL_BACKGROUND_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  drawSpaceCallBackground(ctx, {
    width: canvas.width,
    height: canvas.height,
    stops,
    texture,
    logo,
    mark,
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.86,
    );
  });
}
