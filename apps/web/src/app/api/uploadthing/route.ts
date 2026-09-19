import {
  fileRouter,
  probeBundledGenerateSignedURL,
  rewriteUploadThingPresignedResponse,
} from '@hypha-platform/core/server';
import { createRouteHandler } from 'uploadthing/next';
import { NextRequest, NextResponse } from 'next/server';

const handlers = createRouteHandler({
  router: fileRouter,
});

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('check') === 'signed-url-encoding') {
    return NextResponse.json(probeBundledGenerateSignedURL());
  }
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const response = await handlers.POST(req);
  if (req.headers.get('uploadthing-hook')) {
    return response;
  }
  return rewriteUploadThingPresignedResponse(response);
}
