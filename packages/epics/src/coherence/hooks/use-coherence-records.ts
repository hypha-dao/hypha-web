'use client';

import { useMemo, useState } from 'react';
import { Order } from '@hypha-platform/core/client';
import { Coherence } from '../types';

const MOCK_RECORDS: Coherence[] = [
  {
    id: 1,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 2,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-2',
  },
  {
    id: 3,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 4,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-4',
  },
  {
    id: 5,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 6,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-6',
  },
  {
    id: 7,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 8,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-8',
  },
  {
    id: 9,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 10,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-10',
  },
  {
    id: 11,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 12,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-12',
  },
  {
    id: 13,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 14,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-14',
  },
  {
    id: 15,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 16,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-16',
  },
  {
    id: 17,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 18,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-18',
  },
  {
    id: 19,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 20,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-20',
  },
  {
    id: 21,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 22,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-22',
  },
  {
    id: 23,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 24,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-24',
  },
  {
    id: 25,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 26,
    label: 'Opportunity',
    labelType: 'opportunity',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-26',
  },
  {
    id: 27,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'signal',
    creatorAddress: undefined,
    roomId: undefined,
  },
  {
    id: 28,
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-28',
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
