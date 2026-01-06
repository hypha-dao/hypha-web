'use client';

import { useCallback, useMemo } from 'react';
import {
  Coherence,
  DirectionType,
  Order,
  useFindCoherences,
} from '@hypha-platform/core/client';

export const useCoherenceRecords = ({
  order,
  spaceId,
}: {
  order?: Order<Coherence>;
  spaceId?: number;
}) => {
  const { coherences, isLoading, error, refresh } = useFindCoherences({
    spaceId,
  });

  const compare = useCallback(
    (a: Coherence, b: Coherence) => {
      if (!order) {
        return 0;
      }
      for (const o of order) {
        const left = a[o.name];
        const right = b[o.name];
        if (left === right || (left === undefined && right === undefined)) {
          continue;
        }
        switch (o.dir) {
          case DirectionType.ASC:
            if (left === undefined) {
              return -1;
            } else if (right === undefined) {
              return 1;
            }
            return left < right ? -1 : 1;
          case DirectionType.DESC:
            if (left === undefined) {
              return 1;
            } else if (right === undefined) {
              return -1;
            }
            return left < right ? 1 : -1;
          default:
            break;
        }
      }
      return 0;
    },
    [order],
  );

  const response = useMemo(() => {
    if (isLoading) {
      return {
        signals: [] as Coherence[],
        conversations: [] as Coherence[],
      };
    }

    const raw = coherences ? coherences : [];
    const sortedRecords = compare ? raw.sort(compare) : raw;

    const signals = sortedRecords.filter(
      (record) => record.status === 'signal',
    );
    const conversations = sortedRecords.filter(
      (record) => record.status === 'conversation',
    );

    return {
      signals,
      conversations,
    };
  }, [coherences, isLoading, compare]);

  return {
    records: response,
    isLoading,
    error,
    refresh,
  };
};
