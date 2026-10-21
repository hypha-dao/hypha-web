import { handleUploadClientLogo } from '@hypha-platform/core/server';

import { integrationRoute } from '@web/lib/integration-api';
import { integrationDeveloperDeps } from '@web/lib/integration-api/developer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * auth: user token (Bearer), the requester of a pending client
 * Multipart field `logo`: PNG, JPEG or WebP, up to 512 KB, roughly square. Checked by content, stored in Hypha file storage.
 */
export const POST = integrationRoute(
  async (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
    handleUploadClientLogo(request, await params, integrationDeveloperDeps),
);
