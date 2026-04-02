import { Environment } from '../types';

export function determineEnvironment(
  url: string,
): Environment | undefined {
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

  return undefined;
}
