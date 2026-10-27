export type MySpacesListing = 'spaces' | 'ecosystems';

export const MY_SPACES_LISTING_KEY = 'hypha:my-spaces-listing';
export const MY_SPACES_LISTING_EVENT = 'hypha:my-spaces-listing';

export function readMySpacesListing(): MySpacesListing {
  try {
    return window.localStorage.getItem(MY_SPACES_LISTING_KEY) === 'ecosystems'
      ? 'ecosystems'
      : 'spaces';
  } catch {
    return 'spaces';
  }
}

export function writeMySpacesListing(listing: MySpacesListing) {
  try {
    window.localStorage.setItem(MY_SPACES_LISTING_KEY, listing);
  } catch {
    // Private browsing can block storage. The choice still applies this visit.
  }
  window.dispatchEvent(new Event(MY_SPACES_LISTING_EVENT));
}
