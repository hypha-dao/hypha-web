import { Suspense } from 'react';
import {
  MessagesPeopleListSkeleton,
  MyConnections,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from './_components/messages-page-frame';

export default function MessagesPage() {
  return (
    <MessagesPageFrame>
      <Suspense fallback={<MessagesPeopleListSkeleton />}>
        <MyConnections section="messages" />
      </Suspense>
    </MessagesPageFrame>
  );
}
