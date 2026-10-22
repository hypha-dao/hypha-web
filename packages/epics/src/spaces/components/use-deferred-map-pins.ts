'use client';

import { hasSpaceMapLocation, type Space } from '@hypha-platform/core/client';
import { useEffect, useMemo, useRef, useState } from 'react';

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
 * Spaces that already have coordinates stay on the map. A written place
 * name, then the creator, then another member, are looked up after paint.
 * Each resolved pin is merged in.
 */
function pinRequestKey(space: Space): string | null {
  if (hasSpaceMapLocation(space)) return null;
  const locationLabel = space.locationLabel?.trim() ?? '';
  const creatorAddress = space.creatorAddress?.trim() ?? '';
  const members = space.memberAddresses?.length ?? 0;
  if (!locationLabel && !creatorAddress && members === 0) return null;
  return `${space.id}|${locationLabel}|${creatorAddress}|${members}`;
}

export function useDeferredMapPins(
  spaces: readonly Space[],
  enabled: boolean,
): Readonly<Record<number, DeferredMapPin>> {
  const [pins, setPins] = useState<Record<number, DeferredMapPin>>({});
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const spacesRef = useRef(spaces);
  spacesRef.current = spaces;
  const startedRef = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);
  const childrenRef = useRef(new Set<AbortController>());
  const pendingKey = useMemo(
    () =>
      spaces
        .map((space) => pinRequestKey(space))
        .filter((key): key is string => key != null)
        .join('\n'),
    [spaces],
  );

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    abortRef.current = controller;
    return () => {
      controller.abort();
      abortRef.current = null;
      childrenRef.current.forEach((child) => child.abort());
      childrenRef.current.clear();
      startedRef.current = new Set();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const parent = abortRef.current;
    if (!parent || parent.signal.aborted) return;
    const pending = spacesRef.current.flatMap((space) => {
      const key = pinRequestKey(space);
      if (!key || startedRef.current.has(key) || pinsRef.current[space.id]) {
        return [];
      }
      startedRef.current.add(key);
      return [
        {
          id: space.id,
          locationLabel: space.locationLabel?.trim() || null,
          creatorAddress: space.creatorAddress?.trim() || null,
          memberAddresses: space.memberAddresses ?? [],
        },
      ];
    });
    if (pending.length === 0) return;

    const controller = new AbortController();
    childrenRef.current.add(controller);
    if (parent.signal.aborted) controller.abort();
    const chunks: Array<typeof pending> = [];
    for (let index = 0; index < pending.length; index += 80) {
      chunks.push(pending.slice(index, index + 80));
    }
    const applyLines = (buffer: string, flush: boolean) => {
      const lines = buffer.split('\n');
      const rest = flush ? '' : lines.pop() ?? '';
      const batch: Record<number, DeferredMapPin> = {};
      for (const line of flush ? lines.concat(rest ? [rest] : []) : lines) {
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
      if (Object.keys(batch).length > 0) {
        setPins((current) => ({ ...current, ...batch }));
      }
      return rest;
    };
    const run = async () => {
      for (const chunk of chunks) {
        if (controller.signal.aborted) return;
        const response = await fetch('/api/v1/network/map-pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spaces: chunk }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) continue;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            applyLines(buffer, true);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          buffer = applyLines(buffer, false);
        }
      }
    };

    void run().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error('[useDeferredMapPins] failed to load map pins', error);
    });

    return () => {
      if (abortRef.current?.signal.aborted) {
        controller.abort();
        childrenRef.current.delete(controller);
      }
    };
  }, [enabled, pendingKey]);

  return pins;
}
