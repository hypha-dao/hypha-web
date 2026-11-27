// Copies the MediaPipe WASM files used by the call background effect (#2563) into
// `public/vendor/mediapipe/tasks-vision-<version>/wasm/`, so they are served from our own domain.
// Resolved through `@livekit/track-processors` in `packages/core`, so the copy is always the
// exact version that package loads. Runs on install (postinstall, not build: a Turbo cache hit
// skips the build script); safe to run again. The copy is gitignored.
//
// The segmentation model is committed next to it, `public/vendor/mediapipe/models/
// selfie_segmenter-float16-v1.tflite`: MediaPipe Selfie Segmenter float16 v1 from
// https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite
// (same file as `.../latest/...` on 2026-11-27), SHA-256
// 191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b. Licences: Apache-2.0
// (@mediapipe/tasks-vision and MediaPipe models).
import { createRequire } from 'node:module';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreManifest = resolve(webRoot, '../../packages/core/package.json');
const vendorRoot = join(webRoot, 'public/vendor/mediapipe');

function main() {
  const requireFromCore = createRequire(coreManifest);
  let processorsManifest;
  try {
    processorsManifest = requireFromCore.resolve(
      '@livekit/track-processors/package.json',
    );
  } catch {
    console.warn(
      '[copy-call-effect-assets] @livekit/track-processors not installed; skipped',
    );
    return;
  }
  const requireFromProcessors = createRequire(processorsManifest);
  // The package's `exports` hide package.json: resolve its entry, walk up to its root.
  let visionRoot = dirname(
    requireFromProcessors.resolve('@mediapipe/tasks-vision'),
  );
  while (!existsSync(join(visionRoot, 'package.json'))) {
    const parent = dirname(visionRoot);
    if (parent === visionRoot) {
      throw new Error(
        '[copy-call-effect-assets] @mediapipe/tasks-vision root not found',
      );
    }
    visionRoot = parent;
  }
  const { version } = JSON.parse(
    readFileSync(join(visionRoot, 'package.json'), 'utf8'),
  );
  const source = join(visionRoot, 'wasm');
  if (!existsSync(source)) {
    throw new Error(`[copy-call-effect-assets] missing ${source}`);
  }

  const targetDirName = `tasks-vision-${version}`;
  const target = join(vendorRoot, targetDirName, 'wasm');
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });

  // Drop copies of older versions.
  for (const entry of readdirSync(vendorRoot, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      entry.name.startsWith('tasks-vision-') &&
      entry.name !== targetDirName
    ) {
      rmSync(join(vendorRoot, entry.name), { recursive: true, force: true });
    }
  }
  console.log(`[copy-call-effect-assets] ${targetDirName}/wasm ready`);
}

main();
