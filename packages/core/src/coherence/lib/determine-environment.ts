import { Environment } from '../types';

export function determineEnvironment(url: string): Environment | undefined {
  if (!url) {
    return undefined;
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return Environment.DEVELOPMENT;
  }
  if (hostname.endsWith('.vercel.app')) {
    return Environment.PREVIEW;
  }
  if (hostname === 'hypha.earth' || hostname.endsWith('.hypha.earth')) {
    return Environment.PRODUCTION;
  }
  /* Custom domains (e.g. hstgr.cloud) must still map to a Matrix `environment` row; otherwise
   * `/api/matrix/token` returns 400 and chat/calls break. Prefer an explicit Vercel signal,
   * then any production Node build, else development. */
  if (
    process.env.VERCEL_ENV === 'production' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
  ) {
    return Environment.PRODUCTION;
  }
  if (process.env.NODE_ENV === 'production') {
    return Environment.PRODUCTION;
  }
  return Environment.DEVELOPMENT;
}
