import { HYPHA_TIMEZONE } from '@hypha-platform/cookie';
import {
  getBrowserTimeZone,
  isValidTimeZone,
  LOCAL_DATE_FORMAT_OPTIONS,
  LOCAL_DATE_TIME_FORMAT_OPTIONS,
} from '@hypha-platform/ui-utils';

/** Reads the persisted timezone cookie on the server (Next.js `cookies()` store). */
export async function resolveRequestTimeZone(): Promise<string> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(HYPHA_TIMEZONE)?.value;
    if (isValidTimeZone(fromCookie)) {
      return fromCookie;
    }
  } catch {
    // Outside Next.js request context (tests, scripts).
  }

  return 'UTC';
}
