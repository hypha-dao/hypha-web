import {
  CoherenceTag,
  CoherenceStatus,
  CoherenceType,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';

export type ChatCreatorType = {
  avatar?: string;
  name?: string;
  surname?: string;
  type?: 'person' | 'space';
  address?: string;
};

export const COHERENCE_ORDERS = [
  'mostviews',
  'mostmessages',
  'mostrecent',
] as const;
export type CoherenceOrder = (typeof COHERENCE_ORDERS)[number];

export type ChatPageParams = {
  id: string;
  lang: Locale;
  chatId: string;
};
