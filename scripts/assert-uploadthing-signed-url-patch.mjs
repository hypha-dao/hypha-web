import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

const uploadthingPkg = require.resolve('uploadthing/package.json');
const sharedJs = require.resolve('@uploadthing/shared', {
  paths: [uploadthingPkg],
});
const source = readFileSync(sharedJs, 'utf8');

if (source.includes('encodeURIComponent(value)')) {
  console.error(
    `@uploadthing/shared still double-encodes signed URL params:\n${sharedJs}`,
  );
  process.exit(1);
}

if (!source.includes('searchParams.append(key, String(value))')) {
  console.error(
    `@uploadthing/shared is missing the ingest MIME encoding patch:\n${sharedJs}`,
  );
  process.exit(1);
}

console.log(`UploadThing signed-URL patch OK: ${sharedJs}`);
