'use client';

import { hasSpaceMapLocation, type Space } from '@hypha-platform/core/client';
import { useEffect, useState } from 'react';

export type DeferredMapPin = { latitude: number; longitude: number };

function isPin(value: unknown): value is DeferredMapPin {
  if (!value || typeof value !== 'object') return false;
  const pin = value as { latitude?: unknown; longitude?: unknown };
  return (
    typeof pin.latitude === 'number' &&
    Number.isFinite(pin.latitude) &&
    typeof pin.longitude === 'number' &&
    Number.isFinite(pin.longitude)
  );
}

/**
 * Spaces that already have coordinates stay on the map. Creator and member
 * places are looked up after paint, and each resolved pin is merged in.
 */
export function useDeferredMapPins(
  spaces: readonly Space[],
  enabled: boolean,
): Readonly<Record<number, DeferredMapPin>> {
  const [pins, setPins] = useState<Record<number, DeferredMapPin>>({});

  useEffect(() => {
    if (!enabled) return;
    const pending = spaces.flatMap((space) => {
      if (hasSpaceMapLocation(space)) return [];
      const creatorAddress = space.creatorAddress?.trim() ?? '';
      const memberAddresses = space.memberAddresses ?? [];
      if (!creatorAddress && memberAddresses.length === 0) return [];
      return [
        {
          id: space.id,
          creatorAddress: creatorAddress || null,
          memberAddresses,
        },
      ];
    });
    if (pending.length === 0) return;

    const controller = new AbortController();
    const run = async () => {
      const response = await fetch('/api/v1/network/map-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaces: pending }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        const batch: Record<number, DeferredMapPin> = {};
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (!parsed || typeof parsed !== 'object') continue;
          for (const [id, pin] of Object.entries(parsed)) {
            const spaceId = Number(id);
            if (!Number.isInteger(spaceId) || spaceId <= 0 || !isPin(pin)) {
              continue;
            }
            batch[spaceId] = pin;
          }
        }
        if (Object.keys(batch).length === 0) continue;
        setPins((current) => ({ ...current, ...batch }));
      }
    };

    void run().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error('[useDeferredMapPins] failed to load map pins', error);
    });

    return () => controller.abort();
  }, [enabled, spaces]);

  return pins;
}
