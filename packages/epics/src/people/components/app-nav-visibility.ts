/**
 * Members use the space menu (Home, Energy, Wallet, Messages, community).
 * Those screens leave the shared top menu. Builders keep every entry.
 * Funders keep home, wallet, network, and messages, and not the spaces screen.
 */
export function shouldShowHomeNav(orientation: string | null | undefined) {
  return orientation !== 'member';
}

export function shouldShowMessagesNav(orientation: string | null | undefined) {
  return orientation !== 'member';
}

export function shouldShowWalletNav(orientation: string | null | undefined) {
  return orientation !== 'member';
}

export function shouldShowSpacesScreen(orientation: string | null | undefined) {
  return orientation !== 'investor' && orientation !== 'member';
}

export function shouldShowNetworkNav(orientation: string | null | undefined) {
  return orientation !== 'member';
}

export function isHomeNavHref(href: string | undefined) {
  return Boolean(href && /\/(?:home|my-dashboard)\/?$/.test(href));
}

export function isMessagesNavHref(href: string | undefined) {
  return Boolean(href?.includes('/messages'));
}

export function isWalletNavHref(href: string | undefined) {
  return Boolean(href?.includes('/my-wallet'));
}

export function isSpacesNavHref(href: string | undefined) {
  return Boolean(href?.includes('/my-spaces'));
}

export function isNetworkNavHref(href: string | undefined) {
  return Boolean(href && /\/network\/?$/.test(href));
}
