import type { OrgId, PersonaId } from './data';
import type { Route } from './store';

/**
 * Where a URL drops you. `/` opens Hypha Energy's Overview; `/onboarding`
 * opens River Commons' door as a newcomer. Everything after that is the
 * same in-memory world — `reset` returns to this entry.
 *
 * Plain module on purpose (no 'use client'): server pages import it and
 * pass the entry down as a prop.
 */
export type Entry = {
  org: OrgId;
  route: Route;
  persona: PersonaId;
};

export const ENTRIES = {
  overview: { org: 'energy', route: 'org', persona: 'you' },
  onboarding: { org: 'river', route: 'onboarding', persona: 'you' },
} satisfies Record<string, Entry>;
