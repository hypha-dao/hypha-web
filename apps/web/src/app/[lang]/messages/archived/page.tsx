import { Suspense } from 'react';
import {
  MessagesPeopleListSkeleton,
  MyConnections,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from '../_components/messages-page-frame';

export default function MessagesArchivedPage() {
  return (
    <MessagesPageFrame heading="archived">
      <Suspense fallback={<MessagesPeopleListSkeleton />}>
        <MyConnections section="archived" />
      </Suspense>
    </MessagesPageFrame>
  );
}
