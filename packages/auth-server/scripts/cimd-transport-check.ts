/** Exercises the library's pinned Node transport for Client ID Metadata Documents (needs network). */
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { validateClientIdUrl } from '@better-auth/cimd';

const tryFetch = async (url: string) => {
  try {
    const res = await fetchClientMetadataResource(url, {} as never);
    return `status ${res.status}`;
  } catch (e) {
    return `refused: ${(e as Error).message.slice(0, 80)}`;
  }
};

console.log(
  'public https  ->',
  await tryFetch('https://www.google.com/robots.txt'),
);
console.log('redirect      ->', await tryFetch('https://google.com/'));
console.log('loopback ip   ->', await tryFetch('https://127.0.0.1/x'));
console.log('localhost dns ->', await tryFetch('https://localhost/x'));
console.log(
  'validate loopback url ->',
  validateClientIdUrl('https://127.0.0.1/c.json'),
);
console.log(
  'validate http url     ->',
  validateClientIdUrl('http://client.example.com/c.json'),
);
console.log(
  'validate fragment url ->',
  validateClientIdUrl('https://client.example.com/c.json#x'),
);
