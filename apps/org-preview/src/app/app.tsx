'use client';

import type { Entry } from '@/lib/entries';
import { StoreProvider, useStore } from '@/lib/store';
import { About } from '@/screens/about';
import { Thread } from '@/screens/chats';
import { DirectionDetail } from '@/screens/direction';
import { Onboarding } from '@/screens/onboarding';
import { OrgPage } from '@/screens/org';
import { ProfileScreen } from '@/screens/profile';
import { ProposalDetail, Proposals } from '@/screens/proposals';
import { PublicSpace, RequestSent } from '@/screens/public-space';
import { TicketViewScreen } from '@/screens/ticket-view';
import {
  AllWork,
  MyWork,
  OfferScreen,
  ProjectDetail,
  TicketScreen,
} from '@/screens/work';

function Router() {
  const s = useStore();

  switch (s.route) {
    case 'onboarding':
      return <Onboarding />;
    case 'public':
      return <PublicSpace />;
    case 'request':
      return <RequestSent />;
    case 'my':
      // onboarding is River Commons' door — in Hypha Energy you are already in
      return s.persona === 'you' &&
        s.youStage === 'chat' &&
        s.org === 'river' ? (
        <Onboarding />
      ) : (
        <MyWork />
      );
    case 'all':
      return <AllWork />;
    case 'org':
      return <OrgPage />;
    case 'proposals':
      return <Proposals />;
    case 'profile':
      return <ProfileScreen />;
    case 'thread':
      return <Thread />;
    case 'project':
      return <ProjectDetail />;
    case 'ticket':
      return <TicketScreen />;
    case 'ticket-view':
      return <TicketViewScreen />;
    case 'offer':
      return <OfferScreen />;
    case 'proposal':
      return <ProposalDetail />;
    case 'direction':
      return <DirectionDetail />;
    case 'about':
      return <About />;
  }
}

/** The whole prototype, started at one entry point. One per URL. */
export function App({ entry }: { entry: Entry }) {
  return (
    <StoreProvider entry={entry}>
      <Router />
    </StoreProvider>
  );
}
