const RADIANS = Math.PI / 180;

/** Spherical [λ, φ] in degrees → unit Cartesian. */
export function cartesian(
  coordinates: [number, number],
): [number, number, number] {
  const λ = coordinates[0] * RADIANS;
  const φ = coordinates[1] * RADIANS;
  const cosφ = Math.cos(φ);
  return [cosφ * Math.cos(λ), cosφ * Math.sin(λ), Math.sin(φ)];
}

/** Rotation delta (degrees) between two surface points for rigid sphere drag. */
export function rotationDelta(
  a: [number, number, number],
  b: [number, number, number],
): [number, number] {
  const axb = cross(a, b);
  const w = dot(a, b);
  const angle = Math.atan2(length(axb), w);
  if (angle < 1e-6) {
    return [0, 0];
  }
  const axis = normalize(axb);
  return [(axis[1] * angle) / RADIANS, (-axis[0] * angle) / RADIANS];
}

function dot(a: [number, number, number], b: [number, number, number]) {
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

function length(v: [number, number, number]) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = length(v);
  if (len < 1e-12) {
    return [0, 0, 1];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}
