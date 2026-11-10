import { handleAuthServerRequest } from '../../(auth)/auth/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// RFC 8414 metadata for the path-less issuer. 404 on any other host.
export const GET = handleAuthServerRequest;
