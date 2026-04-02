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

  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return Environment.DEVELOPMENT;
  }
  if (hostname.includes('.vercel.app')) {
    return Environment.PREVIEW;
  }
  if (hostname.includes('hypha.earth')) {
    return Environment.PRODUCTION;
  }

  return Environment.PRODUCTION;
}
