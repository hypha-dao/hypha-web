import 'server-only';

const DEFAULT_BRIDGE_API_BASE_URL = 'https://api.sandbox.bridge.xyz';

/** True when configured Bridge API host is the sandbox environment. */
export function isBridgeSandboxApi(): boolean {
  const baseUrl =
    process.env.BRIDGE_API_BASE_URL ?? DEFAULT_BRIDGE_API_BASE_URL;
  return baseUrl.includes('sandbox');
}
