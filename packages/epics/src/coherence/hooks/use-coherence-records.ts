'use client';

import { useMemo, useState } from 'react';
import { Order } from '@hypha-platform/core/client';
import { Coherence } from '../types';

const MOCK_RECORDS: Coherence[] = [
  {
    id: 1,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 2,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 3,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 4,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 5,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 6,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 7,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 8,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 9,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 10,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 11,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 12,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 13,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 14,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 15,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 16,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 17,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 18,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 19,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 20,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 21,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 22,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 23,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 24,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 25,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 26,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'conversation',
    creatorId: 1,
    roomId: undefined,
  },
  {
    id: 27,
    label: 'Test',
    title: 'Test title 1',
    description: 'Test description 1',
    status: 'signal',
    creatorId: 1,
    roomId: undefined,
  },
];

export const useCoherenceRecords = ({
  order,
}: {
  order?: Order<Coherence>;
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const response = useMemo(() => {
    /*return {
      signals: [] as Coherence[],
      conversations: [] as Coherence[],
    };*/

    const signals = MOCK_RECORDS.filter((record) => record.status === 'signal');
    const conversations = MOCK_RECORDS.filter(
      (record) => record.status === 'conversation',
    );

    return {
      signals,
      conversations,
    };
  }, []);

  return {
    records: response,
    isLoading,
  };
};
