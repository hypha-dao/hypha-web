'use client';

import React from 'react';
import useSWR from 'swr';
import { EventEntity, Event } from '../../types';

interface UseEventsInput {
  type?: string;
  referenceId?: number;
  referenceEntity?: EventEntity;
}

export const useEvents = ({
  type,
  referenceId,
  referenceEntity,
}: UseEventsInput) => {
  const endpoint = React.useMemo(() => {
    const params = new URLSearchParams();
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

  const { data: events, isLoading: isLoadingEvents } = useSWR(
    endpoint,
    (endpoint) =>
      fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );

  return {
    events: events as Event[],
    isLoadingEvents,
  };
};
