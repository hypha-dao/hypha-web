'use client';

import React from 'react';
import useSWR from 'swr';
import { EventEntity, Event } from '../../types';

interface UseEventsInput {
  type?: string;
  referenceId?: number;
  referenceEntity?: EventEntity;
}

type EventResponse = Omit<Event, 'createdAt'> & { createdAt: string };

export const useEvents = ({
  type,
  referenceId,
  referenceEntity,
}: UseEventsInput) => {
  const endpoint = React.useMemo(() => {
    const params = new URLSearchParams();
    const all = type && referenceId && referenceEntity;
    const none = !type && !referenceId && !referenceEntity;
    if (!all && !none) {
      return null;
    }
    if (type) {
      params.set('type', type);
    }
    if (referenceId) {
      params.set('referenceId', referenceId.toString());
    }
    if (referenceEntity) {
      params.set('referenceEntity', referenceEntity);
    }
    return `/api/v1/events${params.size > 0 ? '?' + params.toString() : ''}`;
  }, [type, referenceId, referenceEntity]);

  const {
    data: events,
    isLoading: isLoadingEvents,
    error,
  } = useSWR<Event[]>(endpoint, (endpoint: string | URL | Request) =>
    fetch(endpoint).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch events: ${res.statusText}`);
      }
      const rawEvents: EventResponse[] = await res.json();
      return rawEvents.map((event) => ({
        ...event,
        createdAt: new Date(event.createdAt),
      }));
    }),
  );

  return {
    events,
    isLoadingEvents,
    error,
  };
};
