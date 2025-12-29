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
    label: 'Tensions',
    labelType: 'tensions',
    title:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 28',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    status: 'conversation',
    creatorAddress: '0x822Bf2Fd502d7EaA679BDCe365cb620A05924E2C',
    roomId: 'conv-28',
    archived: false,
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
