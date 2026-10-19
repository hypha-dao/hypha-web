import { Suspense } from 'react';
import { MyConnections } from '@hypha-platform/epics';

import { MessagesPageFrame } from './_components/messages-page-frame';

export default function MessagesPage() {
  return (
    <MessagesPageFrame>
      <Suspense fallback={null}>
        <MyConnections section="messages" />
      </Suspense>
    </MessagesPageFrame>
  );
}
