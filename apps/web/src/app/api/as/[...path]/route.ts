import { handleAuthServerRequest } from '../../../as/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Protocol endpoints of the authorization server (#2608). 404 on any other host and for any
// path outside the allowlist in the auth-server package.
export const GET = handleAuthServerRequest;
export const POST = handleAuthServerRequest;
