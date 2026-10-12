'use client';

import {
  CoherenceBlock,
  type CoherenceBlockProps,
} from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';

export function ConnectedCoherenceBlock(
  props: Omit<CoherenceBlockProps, 'useMembers'>,
) {
  return <CoherenceBlock {...props} useMembers={useMembers} />;
}
