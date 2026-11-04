import { Suspense } from 'react';
import { MyConnections } from '@hypha-platform/epics';

import { MessagesPageFrame } from '../_components/messages-page-frame';

export default function MessageSuggestionsPage() {
  return (
    <MessagesPageFrame heading="suggestions">
      <Suspense fallback={null}>
        <MyConnections section="suggestions" />
      </Suspense>
    </MessagesPageFrame>
  );
}
