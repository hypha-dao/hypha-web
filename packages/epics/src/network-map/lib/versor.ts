/** Quaternion-based versor math for rigid globe dragging (d3/versor). */

const RADIANS = Math.PI / 180;
const DEGREES = 180 / Math.PI;

export type Versor = [number, number, number, number];
export type Rotation = [number, number, number];

/** Spherical [λ, φ] in degrees → unit Cartesian. */
export function cartesian(
  coordinates: [number, number],
): [number, number, number] {
  const λ = coordinates[0] * RADIANS;
  const φ = coordinates[1] * RADIANS;
  const cosφ = Math.cos(φ);
  return [cosφ * Math.cos(λ), cosφ * Math.sin(λ), Math.sin(φ)];
}

/** Euler rotation angles [λ, φ, γ] → unit quaternion. */
export function fromAngles([l, p, g = 0]: Rotation): Versor {
  l *= RADIANS / 2;
  p *= RADIANS / 2;
  g *= RADIANS / 2;
  const sl = Math.sin(l);
  const cl = Math.cos(l);
  const sp = Math.sin(p);
  const cp = Math.cos(p);
  const sg = Math.sin(g);
  const cg = Math.cos(g);
  return [
    cl * cp * cg + sl * sp * sg,
    sl * cp * cg - cl * sp * sg,
    cl * sp * cg + sl * cp * sg,
    cl * cp * sg - sl * sp * cg,
  ];
}

/** Unit quaternion → Euler rotation angles [λ, φ, γ] in degrees. */
export function toAngles([a, b, c, d]: Versor): Rotation {
  return [
    Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * DEGREES,
    Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * DEGREES,
    Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * DEGREES,
  ];
}

export function multiply(
  [a1, b1, c1, d1]: Versor,
  [a2, b2, c2, d2]: Versor,
): Versor {
  return [
    a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2,
    a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2,
    a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2,
    a1 * d2 + b1 * c2 - c1 * b2 + d1 * a2,
  ];
}

/** Quaternion rotating v0 to v1 on the sphere. */
export function delta(
  v0: [number, number, number],
  v1: [number, number, number],
): Versor {
  const w = cross(v0, v1);
  const l = Math.hypot(w[0], w[1], w[2]);
  if (l < 1e-12) {
    return [1, 0, 0, 0];
  }
  const t = Math.acos(Math.max(-1, Math.min(1, dot3(v0, v1)))) / 2;
  const s = Math.sin(t);
  return [Math.cos(t), (w[2] / l) * s, (-w[1] / l) * s, (w[0] / l) * s];
}

/** Spherical linear interpolation between two Euler rotations. */
export function interpolateAngles(
  a: Rotation,
  b: Rotation,
): (t: number) => Rotation {
  const q0 = fromAngles(a);
  const q1 = fromAngles(b);
  let dot = q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3];
  let bq = q1;
  if (dot < 0) {
    bq = [-q1[0], -q1[1], -q1[2], -q1[3]];
    dot = -dot;
  }
  if (dot > 0.9995) {
    return (t) =>
      toAngles([
        q0[0] + (bq[0] - q0[0]) * t,
        q0[1] + (bq[1] - q0[1]) * t,
        q0[2] + (bq[2] - q0[2]) * t,
        q0[3] + (bq[3] - q0[3]) * t,
      ]);
  }
  const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
  const bx = bq[0] - q0[0] * dot;
  const by = bq[1] - q0[1] * dot;
  const bz = bq[2] - q0[2] * dot;
  const bw = bq[3] - q0[3] * dot;
  const bl = Math.hypot(bx, by, bz, bw);
  const nx = bx / bl;
  const ny = by / bl;
  const nz = bz / bl;
  const nw = bw / bl;
  return (t) => {
    const theta = theta0 * t;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    return toAngles([
      q0[0] * c + nx * s,
      q0[1] * c + ny * s,
      q0[2] * c + nz * s,
      q0[3] * c + nw * s,
    ]);
  };
}

function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
