export type SpaceScreen =
  | 'overview'
  | 'ecosystem_navigation'
  | 'signals'
  | 'agreements'
  | 'members'
  | 'treasury'
  | 'rewards'
  | 'memory'
  | 'space_configuration';

export type InternalSpaceNavigationPayload = {
  kind: 'internal';
  href: string;
  label: string;
  screen?: SpaceScreen;
  space_slug?: string;
};

function resolveNavigationLang(lang?: string): string {
  const trimmed = lang?.trim();
  if (trimmed && /^[a-z]{2}(?:-[A-Z]{2})?$/i.test(trimmed)) {
    return trimmed.split('-')[0]?.toLowerCase() ?? 'en';
  }
  return 'en';
}

export function resolveSpaceScreenPath(
  lang: string,
  spaceSlug: string,
  screen: SpaceScreen,
): string {
  if (screen === 'overview') return `/${lang}/dho/${spaceSlug}/overview`;
  if (screen === 'ecosystem_navigation')
    return `/${lang}/dho/${spaceSlug}/ecosystem-navigation`;
  if (screen === 'signals') return `/${lang}/dho/${spaceSlug}/coherence`;
  if (screen === 'agreements') return `/${lang}/dho/${spaceSlug}/agreements`;
  if (screen === 'members') return `/${lang}/dho/${spaceSlug}/members`;
  if (screen === 'treasury') return `/${lang}/dho/${spaceSlug}/treasury`;
  if (screen === 'rewards') return `/${lang}/dho/${spaceSlug}/rewards`;
  if (screen === 'memory') return `/${lang}/dho/${spaceSlug}/memory`;
  return `/${lang}/dho/${spaceSlug}/agreements/space-configuration`;
}

export function buildSpaceScreenNavigation(args: {
  lang?: string;
  spaceSlug: string;
  screen: SpaceScreen;
  label?: string;
}): InternalSpaceNavigationPayload {
  const lang = resolveNavigationLang(args.lang);
  const spaceSlug = args.spaceSlug.trim();
  const screen = args.screen;

  return {
    kind: 'internal',
    href: resolveSpaceScreenPath(lang, spaceSlug, screen),
    space_slug: spaceSlug,
    screen,
    label: args.label?.trim() || `Open ${screen.replace(/_/g, ' ')}`,
  };
}
