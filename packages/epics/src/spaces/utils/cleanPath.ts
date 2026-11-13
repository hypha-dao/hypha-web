export const PATH_SELECT_ACTIVATE_ACTION = '/select-activate-action';

export const cleanPath = (pathname: string, keepSegments = 4): string => {
  return pathname
    .split('/')
    .slice(0, keepSegments + 1)
    .join('/');
};

/**
 * Activate always lives on the Agreements aside. Building it from the current
 * tab (`/quests/<slug>/select-activate-action`) makes Next prefetch that
 * intercepted slot — and can treat `select-activate-action` as a quest slug.
 */
export function spaceSelectActivateActionPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const lang = parts[0];
  const space = parts[2];
  if (lang && parts[1] === 'dho' && space) {
    return `/${lang}/dho/${space}/agreements${PATH_SELECT_ACTIVATE_ACTION}`;
  }
  return `${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`;
}
