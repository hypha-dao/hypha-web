/** Smallest headers the logo check reads: real size fields, no pixel data. */
export function png(width: number, height: number, extra = 0): Uint8Array {
  const bytes = new Uint8Array(33 + extra);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

export function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment to skip, then SOF0 with the size.
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    0x01,
    0x01,
    0x11,
    0x00,
  ]);
}

export function webpLossless(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(
    [...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
  );
  bytes.set(
    [...'WEBP'].map((c) => c.charCodeAt(0)),
    8,
  );
  bytes.set(
    [...'VP8L'].map((c) => c.charCodeAt(0)),
    12,
  );
  bytes[20] = 0x2f;
  const w = width - 1;
  const h = height - 1;
  bytes[21] = w & 255;
  bytes[22] = ((w >> 8) & 0x3f) | ((h & 3) << 6);
  bytes[23] = (h >> 2) & 255;
  bytes[24] = (h >> 10) & 0x0f;
  return bytes;
}
