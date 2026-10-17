/**
 * Circle packing for the ecosystem diagram.
 *
 * Each ring is sized from its children, not squeezed into a fixed parent.
 * A fixed outer radius shrinks every extra level by the same fraction, and
 * the later pass that grows a ring to fit its labels then overlaps the
 * siblings that were placed for the smaller size.
 *
 * The parent keeps a centre for its mark and the name under that mark, air
 * between neighbouring rings, and air inside its own stroke.
 */

/** Centre mark inside an enclosure. The drawing code uses this same ratio. */
export const ENCLOSURE_LOGO_RATIO = 0.22;
/**
 * Share of an enclosure's radius kept under the centre mark for its name.
 * The diagram only draws that name when this band is tall enough on screen,
 * or when no inner ring sits in the band.
 */
export const CENTRE_CAPTION_RATIO = 0.18;

const LEAF_RADIUS = 100;
/**
 * Extra reach past a leaf ring for the name under it. Counted all the way
 * round so the name stays clear of the next ring whichever way it hangs.
 */
const LEAF_CAPTION_RATIO = 0.36;
/** Air between neighbouring rings, as a fraction of the smaller claim. */
const SIBLING_AIR_RATIO = 0.46;
/** Share of the parent radius left inside the stroke, past the outermost child. */
const PARENT_MARGIN_RATIO = 0.08;
/**
 * Share of the parent radius kept clear in the middle: the mark, the name
 * under it, and a gap before the inner edge of a child ring.
 */
const CENTRE_BLOCK_RATIO = ENCLOSURE_LOGO_RATIO + CENTRE_CAPTION_RATIO;

export type RingLayoutNode = {
  x?: number;
  y?: number;
  r?: number;
  children?: RingLayoutNode[];
};

function claimOf(node: RingLayoutNode): number {
  const r = node.r ?? LEAF_RADIUS;
  if (node.children && node.children.length > 0) return r;
  return r * (1 + LEAF_CAPTION_RATIO);
}

/**
 * Orbit is the distance from a parent centre to a child centre.
 * Parent radius encloses every child's claim plus the rim margin.
 */
function pack(children: RingLayoutNode[]): { orbit: number; parentR: number } {
  const n = children.length;
  const claims = children.map(claimOf);
  const maxClaim = Math.max(...claims, 1);

  let orbit = 0;
  if (n > 1) {
    const sin = Math.sin(Math.PI / n);
    for (let i = 0; i < n; i += 1) {
      const a = claims[i] ?? maxClaim;
      const b = claims[(i + 1) % n] ?? maxClaim;
      const air = SIBLING_AIR_RATIO * Math.min(a, b);
      orbit = Math.max(orbit, (a + b + air) / (2 * sin));
    }
  }

  // P = (orbit + maxClaim) / (1 - margin)
  // orbit >= centre * P + maxClaim
  // so the largest claim stays outside the centre block. A larger sibling
  // orbit still satisfies that.
  const denom = 1 - PARENT_MARGIN_RATIO;
  const k = CENTRE_BLOCK_RATIO / denom;
  if (k < 0.999) {
    const minOrbit = (maxClaim * (1 + k)) / (1 - k);
    orbit = Math.max(orbit, minOrbit);
  } else {
    orbit = Math.max(orbit, maxClaim * 3);
  }

  return { orbit, parentR: (orbit + maxClaim) / denom };
}

function measure(node: RingLayoutNode): void {
  const children = node.children ?? [];
  if (children.length === 0) {
    node.r = LEAF_RADIUS;
    return;
  }
  for (const child of children) measure(child);
  node.r = pack(children).parentR;
}

function place(node: RingLayoutNode): void {
  const children = node.children ?? [];
  if (children.length === 0) return;
  const { orbit } = pack(children);
  const n = children.length;
  const step = (2 * Math.PI) / n;
  const px = node.x ?? 0;
  const py = node.y ?? 0;
  for (let i = 0; i < n; i += 1) {
    const child = children[i];
    if (!child) continue;
    const angle = -Math.PI / 2 + i * step;
    child.x = px + Math.cos(angle) * orbit;
    child.y = py + Math.sin(angle) * orbit;
    place(child);
  }
}

export function layoutSpaceRings(root: RingLayoutNode): void {
  root.x = 0;
  root.y = 0;
  measure(root);
  place(root);
}
