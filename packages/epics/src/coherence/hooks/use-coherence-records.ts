'use client';

import { useCallback, useMemo, useState } from 'react';
import { DirectionType, Order } from '@hypha-platform/core/client';
import { Coherence } from '../types';
import { isUndefined } from 'swr/_internal';

export const MOCK_RECORDS: Coherence[] = [
  {
    id: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 1',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 2',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-2',
    archived: false,
  },
  {
    id: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 3',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 4',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-4',
    archived: true,
  },
  {
    id: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 5',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 6,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 6',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-6',
    archived: false,
  },
  {
    id: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 7',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 8',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-8',
    archived: false,
  },
  {
    id: 9,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 9',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 10',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-10',
    archived: false,
  },
  {
    id: 11,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 11',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 12,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 12',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-12',
    archived: false,
  },
  {
    id: 13,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 13',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 14,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 14',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-14',
    archived: false,
  },
  {
    id: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 15',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 16,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 16',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-16',
    archived: false,
  },
  {
    id: 17,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 17',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 18,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 18',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-18',
    archived: false,
  },
  {
    id: 19,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 19',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 20',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-20',
    archived: false,
  },
  {
    id: 21,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 21',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 22,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 22',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-22',
    archived: false,
  },
  {
    id: 23,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 23',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 24,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 24',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-24',
    archived: false,
  },
  {
    id: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 25',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 26,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 26',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-26',
    archived: false,
  },
  {
    id: 27,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 27',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
    archived: false,
  },
  {
    id: 28,
    createdAt: new Date(),
    updatedAt: new Date(),
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 28',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-28',
    archived: true,
  },
];

export const useCoherenceRecords = ({
  order,
}: {
  order?: Order<Coherence>;
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const compare = useCallback(
    (a: Coherence, b: Coherence) => {
      if (!order) {
        return 0;
      }
      for (const o of order) {
        const left = a[o.name];
        const right = b[o.name];
        if (left === right || (isUndefined(left) && isUndefined(right))) {
          continue;
        }
        switch (o.dir) {
          case DirectionType.ASC:
            if (isUndefined(left)) {
              return -1;
            } else if (isUndefined(right)) {
              return 1;
            }
            return left < right ? -1 : 1;
          case DirectionType.DESC:
            if (isUndefined(left)) {
              return 1;
            } else if (isUndefined(right)) {
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
    /*return {
      signals: [] as Coherence[],
      conversations: [] as Coherence[],
    };*/

    const sortedRecords = compare ? MOCK_RECORDS.sort(compare) : MOCK_RECORDS;

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
  }, [compare]);

  return {
    records: response,
    isLoading,
  };
};
