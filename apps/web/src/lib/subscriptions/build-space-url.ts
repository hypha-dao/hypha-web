/** Absolute URL of a space page, used for Stripe redirect targets. */
export function buildSpaceUrl(lang: string, spaceSlug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  return `${base}/${lang}/dho/${encodeURIComponent(spaceSlug)}`;
}
