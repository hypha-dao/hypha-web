'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createEmptyJourneyState,
  createMomentId,
  scoreFromAxes,
  type JourneyAddonState,
  type JourneyStoreState,
  type WellbeingDimension,
  type WellbeingMoment,
  type WellbeingScope,
} from './wellbeing-model';

const STORAGE_PREFIX = 'hypha.journey.wellbeing.v1';

function storageKey(personSlug: string): string {
  return `${STORAGE_PREFIX}:${personSlug}`;
}

function parseState(raw: string | null): JourneyStoreState {
  if (!raw) return createEmptyJourneyState();
  try {
    const parsed = JSON.parse(raw) as Partial<JourneyStoreState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.moments)) {
      return createEmptyJourneyState();
    }
    return {
      version: 1,
      personalActivated: Boolean(parsed.personalActivated),
      personalActivatedAt: parsed.personalActivatedAt,
      moments: parsed.moments,
      spaceAddons: parsed.spaceAddons ?? {},
    };
  } catch {
    return createEmptyJourneyState();
  }
}

function readState(personSlug: string | undefined): JourneyStoreState {
  if (!personSlug || typeof window === 'undefined') {
    return createEmptyJourneyState();
  }
  return parseState(window.localStorage.getItem(storageKey(personSlug)));
}

function writeState(personSlug: string, state: JourneyStoreState) {
  window.localStorage.setItem(storageKey(personSlug), JSON.stringify(state));
}

function emptyAddonState(): JourneyAddonState {
  return { wellbeing: false, water: false, culture: false };
}

export function useJourneyStore(personSlug: string | undefined) {
  const [state, setState] = useState<JourneyStoreState>(
    createEmptyJourneyState,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readState(personSlug));
    setHydrated(true);
  }, [personSlug]);

  const persist = useCallback(
    (updater: (current: JourneyStoreState) => JourneyStoreState) => {
      setState((current) => {
        const next = updater(current);
        if (personSlug) {
          writeState(personSlug, next);
        }
        return next;
      });
    },
    [personSlug],
  );

  const activatePersonal = useCallback(() => {
    persist((current) => ({
      ...current,
      personalActivated: true,
      personalActivatedAt:
        current.personalActivatedAt ?? new Date().toISOString(),
    }));
  }, [persist]);

  const activateSpaceAddon = useCallback(
    (spaceSlug: string, addon: keyof JourneyAddonState) => {
      persist((current) => {
        const existing = current.spaceAddons[spaceSlug] ?? emptyAddonState();
        return {
          ...current,
          spaceAddons: {
            ...current.spaceAddons,
            [spaceSlug]: { ...existing, [addon]: true },
          },
        };
      });
    },
    [persist],
  );

  const addMoment = useCallback(
    (input: {
      personSlug: string;
      spaceSlug?: string;
      scope: WellbeingScope;
      dimension: WellbeingDimension;
      practiceId: string;
      felt: number;
      impact: number;
      title: string;
    }) => {
      const moment: WellbeingMoment = {
        id: createMomentId(),
        createdAt: new Date().toISOString(),
        personSlug: input.personSlug,
        spaceSlug: input.spaceSlug,
        scope: input.scope,
        dimension: input.dimension,
        practiceId: input.practiceId,
        felt: input.felt,
        impact: input.impact,
        score: scoreFromAxes(input.felt, input.impact),
        title: input.title.trim(),
      };
      persist((current) => ({
        ...current,
        moments: [moment, ...current.moments],
      }));
      return moment;
    },
    [persist],
  );

  const spaceAddon = useCallback(
    (spaceSlug: string | undefined): JourneyAddonState => {
      if (!spaceSlug) return emptyAddonState();
      return state.spaceAddons[spaceSlug] ?? emptyAddonState();
    },
    [state.spaceAddons],
  );

  return useMemo(
    () => ({
      hydrated,
      state,
      activatePersonal,
      activateSpaceAddon,
      addMoment,
      spaceAddon,
    }),
    [
      activatePersonal,
      activateSpaceAddon,
      addMoment,
      hydrated,
      spaceAddon,
      state,
    ],
  );
}
