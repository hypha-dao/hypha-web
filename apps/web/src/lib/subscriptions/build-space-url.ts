function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
}

/** Absolute URL of a space page, used for Stripe redirect targets. */
export function buildSpaceUrl(lang: string, spaceSlug: string): string {
  return `${getAppBaseUrl()}/${lang}/dho/${encodeURIComponent(spaceSlug)}`;
}

/** Absolute URL of the caller's My Spaces page, used as the Billing Portal return target. */
export function buildMySpacesUrl(lang: string): string {
  return `${getAppBaseUrl()}/${lang}/my-spaces`;
}
