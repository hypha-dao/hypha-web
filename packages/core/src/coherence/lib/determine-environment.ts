export function determineEnvironment(url: string) {
  const hostname = new URL(url).hostname;

  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'development';
  }
  if (hostname.includes('.vercel.app')) {
    return 'preview';
  }
  if (hostname.includes('hypha.earth')) {
    return 'production';
  }

  return 'production';
}
