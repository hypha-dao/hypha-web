import { Person } from '@hypha-platform/core/client';

export type Coherence = {
  id: number;
  creatorId: number;
  status: 'signal' | 'conversation';
  label: string;
  title: string;
  description: string;
  roomId?: string;
  creator?: Person;
};
