/** Client-safe build-time gate for network map + space location UI. */
export function getEnableNetworkMap(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_NETWORK_MAP === 'true';
}
