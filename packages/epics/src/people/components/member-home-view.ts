export type HomeView = 'ai' | 'classic' | 'field' | 'energy';

export const HOME_VIEW_KEY = 'hypha-member-home-view';
export const HOME_VIEW_EVENT = 'hypha:member-home-view';

export function readHomeView(): HomeView {
  try {
    const value = window.localStorage.getItem(HOME_VIEW_KEY);
    if (value === 'classic' || value === 'field' || value === 'energy') {
      return value;
    }
    return 'ai';
  } catch {
    return 'ai';
  }
}

export function writeHomeView(view: HomeView) {
  try {
    window.localStorage.setItem(HOME_VIEW_KEY, view);
  } catch {
    // Private browsing can block storage. The choice still applies this visit.
  }
  window.dispatchEvent(new Event(HOME_VIEW_EVENT));
}
