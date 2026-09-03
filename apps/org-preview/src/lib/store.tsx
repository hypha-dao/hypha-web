'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  agreedPay,
  energyOrg,
  personaName,
  seedProposals,
  unitFor,
  type Msg,
  type OrgId,
  type PersonaId,
  type Proposal,
  type ProjectId,
  type TicketId,
  type TicketView,
} from './data';

export type Route =
  // pre-space
  | 'onboarding'
  | 'public'
  | 'request'
  // the five surfaces
  | 'my'
  | 'all'
  | 'org'
  | 'proposals'
  | 'profile'
  // detail screens
  | 'thread'
  | 'project'
  | 'ticket'
  | 'ticket-view'
  | 'offer'
  | 'proposal'
  | 'about';

export type YouStage = 'chat' | 'member';
export type SetupState = 'offered' | 'accepted' | 'done' | 'declined';
/** covers: accepted → draftDone (done-from-talk, waiting on Lea) → done */
export type CoversState = 'accepted' | 'draftDone' | 'done';
/**
 * A ticket under Lea's covers ticket — she holds the whole, Jun holds the
 * piece. none → drafted (by the assistant) → offered → accepted → done.
 */
export type SubCoversState =
  | 'none'
  | 'drafted'
  | 'offered'
  | 'accepted'
  | 'done';
export const SUB_COVERS_TITLE = 'Print the Saturday cover rota';
export type WeekdayState =
  | 'draft'
  | 'offering-lea'
  | 'declined-lea'
  | 'offering-rafi'
  | 'held';
export type ReviewState = 'due' | 'extended' | 'closed';

/* ---- Hypha Energy world ---- */
export type SummaryState = 'accepted' | 'done';
/** Rogerio's municipalities ticket: doing → draftDone (done-from-talk) → done */
export type MuniState = 'doing' | 'draftDone' | 'done';
export type CarbonState = 'draft' | 'offering' | 'held';

/** small extra offers to "You", one per org — accepted or sent back */
export type OfferId = 'photo' | 'e-faq';
export type OfferState = 'offered' | 'accepted' | 'declined';
export const OFFERS: Record<
  OfferId,
  {
    title: string;
    from: string;
    project: string;
    due: string;
    why: string;
  }
> = {
  photo: {
    title: 'Photograph each grower’s stand for the welcome sheet',
    from: 'Jun',
    project: 'Grower onboarding',
    due: '21 Jun',
    why: 'You said you have a decent camera. One Saturday morning.',
  },
  'e-faq': {
    title: 'Translate the member FAQ into Portuguese',
    from: 'Suzana',
    project: 'Community onboarding playbook',
    due: '31 Jul',
    why: 'You wrote the Ameland summary — same voice, other language.',
  },
};

export type ChatTicket = {
  title: string;
  state: 'drafted' | 'created' | 'routed';
  org: OrgId;
};

/**
 * A pay proposal the assistant drafted for someone. Anyone can ask for it —
 * the person who did the work, or the person above them. The sum is what
 * they named, or what the room says was agreed.
 */
export type PayDraft = {
  /** display name of whoever asked the assistant */
  by: string;
  amount: number;
  /** the sum found in the agreement line — differs when the asker named another */
  agreed: number;
};

type Profile = { name: string; handle: string; about: string };

type Store = {
  // viewpoint
  persona: PersonaId;
  route: Route;
  threadId: string;
  projectId: ProjectId;
  ticketId: TicketId;
  proposalId: string;
  // you (newcomer)
  youStage: YouStage;
  profile: Profile;
  intent: 'join' | 'create' | null;
  pinnedJob: string | null;
  // shared world
  setup: SetupState;
  covers: CoversState;
  coversQuote: string | null;
  weekday: WeekdayState;
  rafiJoined: boolean;
  briefVersion: 4 | 5;
  briefPending: boolean;
  review: ReviewState;
  proposals: Proposal[];
  myVotes: Record<string, 'yes' | 'no'>;
  payDraft: PayDraft | null;
  extraMsgs: Record<string, Msg[]>;
  notice: string | null;
  // navigation
  go: (route: Route) => void;
  openThread: (id: string) => void;
  openProject: (id: ProjectId) => void;
  openTicket: (id: TicketId) => void;
  /** any ticket on the board, read-only */
  ticketView: TicketView | null;
  viewTicket: (t: TicketView) => void;
  openProposal: (id: string) => void;
  switchPersona: (id: PersonaId) => void;
  // onboarding
  setProfile: (p: Partial<Profile>) => void;
  setIntent: (i: 'join' | 'create') => void;
  pinJob: (id: string) => void;
  joinSpace: () => void;
  requestJoin: () => void;
  skipToOrg: () => void;
  // setup ticket (You)
  acceptSetup: () => void;
  declineSetup: () => void;
  finishSetup: () => void;
  // weekday project (Maya)
  offerWeekday: (to: 'lea' | 'rafi') => void;
  acceptRafi: () => void;
  // brief (Maya)
  confirmBrief: () => void;
  rejectBrief: () => void;
  // done-from-talk (covers)
  triggerDoneDraft: (quote: string, threadId?: string) => void;
  confirmCoversDone: () => void;
  reopenCovers: () => void;
  // extra offers to You (one per org)
  offers: Record<OfferId, OfferState>;
  answerOffer: (id: OfferId, yes: boolean) => void;
  // a ticket under a ticket (Lea splits covers, offers a piece to Jun)
  subCovers: SubCoversState;
  draftSubTicket: (threadId?: string) => void;
  offerSubTicket: () => void;
  // ticket created through the assistant (one draft at a time, per org)
  chatTicket: ChatTicket | null;
  draftChatTicket: (title: string) => void;
  confirmChatTicket: () => void;
  routeChatTicket: () => void;
  // chats the user started, in whichever org was on screen
  customChats: { id: string; title: string; org: OrgId }[];
  createChat: (title: string) => void;
  // which sample org is on screen
  org: OrgId;
  switchOrg: (id: OrgId) => void;
  /** the assistant thread is per org — its messages live under this key */
  agentKey: string;
  // money via proposals — `vote` acts on whichever org is on screen
  /**
   * Draft the pay proposal for the live ticket of whichever org is on screen.
   * `amount` is what the asker named; omitted → whatever the room says was agreed.
   */
  draftPayment: (amount?: number) => void;
  openPayProposal: () => void;
  vote: (id: string, v: 'yes' | 'no') => void;
  // Hypha Energy world
  eSummary: SummaryState;
  eMuni: MuniState;
  eMuniQuote: string | null;
  eCarbon: CarbonState;
  eJoin: boolean;
  ePayDraft: PayDraft | null;
  eProposals: Proposal[];
  eVotes: Record<string, 'yes' | 'no'>;
  finishSummary: () => void;
  triggerMuniDone: (quote: string, threadId?: string) => void;
  confirmMuniDone: () => void;
  reopenMuni: () => void;
  offerCarbon: () => void;
  acceptEnergyJoin: () => void;
  // review (Maya)
  reviewExtend: () => void;
  reviewClose: () => void;
  // chat
  sendMsg: (threadId: string, msg: Msg) => void;
  toast: (text: string) => void;
  reset: () => void;
};

const StoreCtx = createContext<Store | null>(null);

const initialProfile: Profile = { name: '', handle: '', about: '' };
const initialOffers: Record<OfferId, OfferState> = {
  photo: 'offered',
  'e-faq': 'offered',
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export const PAY_LEA_ID = 'pay-lea';
export const PAY_ROGERIO_ID = 'e-pay-rogerio';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<PersonaId>('you');
  const [route, setRoute] = useState<Route>('onboarding');
  const [threadId, setThreadId] = useState('agent');
  const [projectId, setProjectId] = useState<ProjectId>('stall');
  const [ticketId, setTicketId] = useState<TicketId>('covers');
  const [proposalId, setProposalId] = useState('');
  const [ticketView, setTicketView] = useState<TicketView | null>(null);

  const [youStage, setYouStage] = useState<YouStage>('chat');
  const [profile, setProfileState] = useState<Profile>(initialProfile);
  const [intent, setIntentState] = useState<'join' | 'create' | null>(null);
  const [pinnedJob, setPinnedJob] = useState<string | null>(null);

  const [setup, setSetup] = useState<SetupState>('offered');
  const [covers, setCovers] = useState<CoversState>('accepted');
  const [coversQuote, setCoversQuote] = useState<string | null>(null);
  const [subCovers, setSubCovers] = useState<SubCoversState>('none');
  const [offers, setOffers] =
    useState<Record<OfferId, OfferState>>(initialOffers);
  const [weekday, setWeekday] = useState<WeekdayState>('draft');
  const [rafiJoined, setRafiJoined] = useState(false);
  const [briefVersion, setBriefVersion] = useState<4 | 5>(4);
  const [briefPending, setBriefPending] = useState(true);
  const [review, setReview] = useState<ReviewState>('due');
  const [proposals, setProposals] = useState<Proposal[]>(seedProposals);
  const [myVotes, setMyVotes] = useState<Record<string, 'yes' | 'no'>>({});
  const [payDraft, setPayDraft] = useState<PayDraft | null>(null);
  const [chatTicket, setChatTicket] = useState<ChatTicket | null>(null);
  const [customChats, setCustomChats] = useState<
    { id: string; title: string; org: OrgId }[]
  >([]);
  const [org, setOrg] = useState<OrgId>('river');
  const [extraMsgs, setExtraMsgs] = useState<Record<string, Msg[]>>({});

  const [eSummary, setESummary] = useState<SummaryState>('accepted');
  const [eMuni, setEMuni] = useState<MuniState>('doing');
  const [eMuniQuote, setEMuniQuote] = useState<string | null>(null);
  const [eCarbon, setECarbon] = useState<CarbonState>('draft');
  const [eJoin, setEJoin] = useState(false);
  const [ePayDraft, setEPayDraft] = useState<PayDraft | null>(null);
  const [eProposals, setEProposals] = useState<Proposal[]>(energyOrg.proposals);
  const [eVotes, setEVotes] = useState<Record<string, 'yes' | 'no'>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3600);
  }, []);

  const sendMsg = useCallback((tid: string, msg: Msg) => {
    setExtraMsgs((m) => ({ ...m, [tid]: [...(m[tid] ?? []), msg] }));
  }, []);

  const value = useMemo<Store>(() => {
    const agentKey = org === 'energy' ? 'e-agent' : 'agent';
    const homeRoute = (p: PersonaId): Route => {
      // onboarding is River Commons' door — in Hypha Energy you are already in
      if (p === 'you' && youStage === 'chat' && org === 'river')
        return 'onboarding';
      if (p === 'eli') return 'org';
      return 'my';
    };

    return {
      persona,
      route,
      threadId,
      projectId,
      ticketId,
      proposalId,
      youStage,
      profile,
      intent,
      pinnedJob,
      setup,
      covers,
      coversQuote,
      weekday,
      rafiJoined,
      briefVersion,
      briefPending,
      review,
      proposals,
      myVotes,
      payDraft,
      extraMsgs,
      notice,

      go: setRoute,
      openThread: (id) => {
        setThreadId(id);
        setRoute('thread');
      },
      openProject: (id) => {
        setProjectId(id);
        setRoute('project');
      },
      openTicket: (id) => {
        setTicketId(id);
        setRoute('ticket');
      },
      ticketView,
      viewTicket: (t) => {
        setTicketView(t);
        setRoute('ticket-view');
      },
      openProposal: (id) => {
        setProposalId(id);
        setRoute('proposal');
      },
      switchPersona: (id) => {
        setPersona(id);
        setRoute(homeRoute(id));
      },

      setProfile: (p) => setProfileState((prev) => ({ ...prev, ...p })),
      setIntent: setIntentState,
      pinJob: (id) => {
        setPinnedJob(id);
        setRoute('public');
      },
      joinSpace: () => {
        setYouStage('member');
        setRoute('my');
        toast(
          'You are in. Work is offered, never assigned — you say yes or no.',
        );
      },
      requestJoin: () => setRoute('request'),
      skipToOrg: () => {
        setProfileState({
          name: 'You',
          handle: '',
          about: 'Skipped onboarding for the demo',
        });
        setYouStage('member');
        setRoute('my');
        toast('Skipped — you are inside River Commons as a member.');
      },

      acceptSetup: () => {
        setSetup('accepted');
        setRoute('my');
        toast('You are the DRI of this ticket. It is on My Work now.');
      },
      declineSetup: () => {
        setSetup('declined');
        setRoute('my');
        toast('Sent back to Sam with your note. Nothing held against you.');
      },
      finishSetup: () => {
        setSetup('done');
        setRoute('my');
        toast('Done. Sam sees it on All Work — with your name on it.');
      },

      offerWeekday: (to) => {
        if (to === 'lea') {
          setWeekday('offering-lea');
          setTimeout(() => {
            setWeekday('declined-lea');
            toast(
              'Lea declined — “I can host a Saturday, I cannot sign a licence.”',
            );
          }, 2200);
        } else {
          setWeekday('offering-rafi');
          setTimeout(() => {
            setWeekday('held');
            setProposals((ps) =>
              ps.some((p) => p.id === 'approve-weekday')
                ? ps
                : [
                    {
                      id: 'approve-weekday',
                      kind: 'project' as const,
                      title: 'Approve project: Weekday hall',
                      sub: 'Rafi as DRI',
                      description:
                        'Find a weekday hall and hold it: the licence, the deposit, the keys.',
                      ends: '1 Aug 2026',
                      state: 'passed' as const,
                      decided: 'today',
                      yes: 2,
                      no: 0,
                      needed: 2,
                      openedBy: 'Maya',
                    },
                    ...ps,
                  ],
            );
            toast(
              'Rafi accepted — he holds Weekday hall. Recorded as a Shaper approval in Proposals.',
            );
          }, 1800);
        }
      },
      acceptRafi: () => {
        setRafiJoined(true);
        toast(
          'Rafi is in. He is a member — nothing lands on him until he accepts it.',
        );
      },

      confirmBrief: () => {
        setBriefVersion(5);
        setBriefPending(false);
        toast(
          'Brief v5 confirmed. Everything the agent does now reads from it.',
        );
      },
      rejectBrief: () => {
        setBriefPending(false);
        toast('Rejected. The agent keeps reading v4 — and remembers why.');
      },

      triggerDoneDraft: (quote, threadId = 'saturday') => {
        if (subCovers === 'offered' || subCovers === 'accepted') {
          sendMsg(threadId, {
            id: uid(),
            from: 'agent',
            system: true,
            text: 'Heard — but “Print the Saturday cover rota” is still open under this ticket, with Jun. Done moves up the tree, never down: when his piece closes, I draft this one as done.',
          });
          return;
        }
        setCovers('draftDone');
        setCoversQuote(quote);
        sendMsg(threadId, {
          id: uid(),
          from: 'agent',
          system: true,
          text: 'Heard — drafted the ticket as done, receipt attached. Lea confirms, or it confirms itself in 48h if nobody objects.',
          card: 'done-draft',
        });
      },
      confirmCoversDone: () => {
        if (subCovers === 'offered' || subCovers === 'accepted') {
          toast(
            'Not yet — “Print the Saturday cover rota” is still open under this ticket. Done moves up the tree, never down.',
          );
          return;
        }
        setCovers('done');
        setRoute('my');
        toast(
          'Done, with the receipt on it. Ask your assistant to draft the pay proposal — or Sam will.',
        );
      },
      reopenCovers: () => {
        setCovers('accepted');
        setCoversQuote(null);
        toast('Reopened. The draft is gone — nothing changed state silently.');
      },

      offers,
      answerOffer: (id, yes) => {
        setOffers((o) => ({ ...o, [id]: yes ? 'accepted' : 'declined' }));
        const from = OFFERS[id].from;
        toast(
          yes
            ? `You are the DRI of this piece only. It is on My Work — ${from} sees it on All Work.`
            : `Sent back to ${from}. Nothing held against you.`,
        );
      },

      subCovers,
      draftSubTicket: (threadId = agentKey) => {
        if (subCovers !== 'none') return;
        setSubCovers('drafted');
        sendMsg(threadId, {
          id: uid(),
          from: 'agent',
          system: threadId !== agentKey,
          text: 'Drafted a ticket under yours — “Find two neighbours who can cover a Saturday”. You hold that one, so you can offer a piece of it yourself; Sam does not need to see this. Nothing exists until Jun says yes.',
          card: 'sub-ticket-draft',
        });
      },
      offerSubTicket: () => {
        setSubCovers('offered');
        setTimeout(() => {
          setSubCovers('accepted');
          toast(
            'Jun accepted — he holds the rota. You still hold the covers; his piece sits under yours.',
          );
        }, 2000);
        setTimeout(() => {
          setSubCovers((v) => (v === 'accepted' ? 'done' : v));
          sendMsg('saturday', {
            id: uid(),
            from: 'Jun',
            text: 'Rota printed — 20 copies, on the table by the cash box.',
          });
          sendMsg('saturday', {
            id: uid(),
            from: 'agent',
            system: true,
            text: 'Marked “Print the Saturday cover rota” done — receipt: Jun’s line above. Jun confirmed. The covers ticket above it can close now.',
          });
          toast(
            'Jun printed the rota — his piece is done. The covers ticket can close now.',
          );
        }, 9000);
      },

      chatTicket,
      draftChatTicket: (title) => {
        setChatTicket({ title, state: 'drafted', org });
        sendMsg(agentKey, {
          id: uid(),
          from: 'agent',
          text:
            org === 'energy'
              ? 'Drafted a ticket from that — under Iberia pilots, since that is where it belongs. Nothing exists until Pedro, the project DRI, says yes.'
              : 'Drafted a ticket from that — under Saturday stall, since that is where it belongs. Nothing exists until the project DRI says yes.',
          card: 'ticket-draft',
        });
      },
      confirmChatTicket: () => {
        setChatTicket((t) => (t ? { ...t, state: 'created' } : t));
        toast(
          org === 'energy'
            ? 'Ticket created under Iberia pilots — open, no DRI yet. It is on All Work.'
            : 'Ticket created under Saturday stall — open, no DRI yet. It is on All Work.',
        );
      },
      routeChatTicket: () => {
        setChatTicket((t) => (t ? { ...t, state: 'routed' } : t));
        toast(
          org === 'energy'
            ? 'Sent to Pedro — Iberia is his. It exists when he confirms.'
            : 'Sent to Sam — the stall is his. It exists when he confirms.',
        );
      },

      org,
      agentKey,
      switchOrg: (id) => {
        if (id === org) return;
        setOrg(id);
        setRoute('org');
        setThreadId('agent');
        setProjectId(id === 'energy' ? 'iberia' : 'stall');
        setTicketId(id === 'energy' ? 'e-summary' : 'covers');
        toast(
          id === 'energy'
            ? 'Hypha Energy — same you, a different org. Your work here is on My Work.'
            : 'Back to River Commons.',
        );
      },

      customChats,
      createChat: (title) => {
        const id = `c-${uid()}`;
        setCustomChats((cs) => [...cs, { id, title, org }]);
        setThreadId(id);
        setRoute('thread');
        toast('Room open. Everything said here feeds the org, like any room.');
      },

      draftPayment: (amount) => {
        const energy = org === 'energy';
        const a = agreedPay[org];
        const unit = unitFor(org);
        const by = personaName(org, persona);
        const sum = amount ?? a.amount;
        const draft: PayDraft = { by, amount: sum, agreed: a.amount };
        (energy ? setEPayDraft : setPayDraft)(draft);
        const money = (n: number) => `${n.toLocaleString()} ${unit}`;
        const pair =
          by === a.who
            ? `You and ${a.withWhom}`
            : by === a.withWhom
            ? `You and ${a.who}`
            : `${a.who} and ${a.withWhom}`;
        const found = `${pair} agreed ${money(a.amount)} for ${a.work} in “${
          a.roomName
        }” on ${a.when} — I have the line.`;
        const differs =
          sum !== a.amount
            ? ` You named ${money(
                sum,
              )}; the draft carries that, with the agreed line beside it so the Shapers see both.`
            : '';
        sendMsg(agentKey, {
          id: uid(),
          from: 'agent',
          text: `Drafted. ${found} The ticket is done and confirmed, receipt attached.${differs} I never move money — open it as a proposal and ${
            energy ? 'the three Shapers' : 'the Shapers'
          } decide.`,
          card: 'payment-draft',
        });
      },
      openPayProposal: () => {
        const energy = org === 'energy';
        const draft = energy ? ePayDraft : payDraft;
        if (!draft) return;
        const a = agreedPay[org];
        const unit = unitFor(org);
        const id = energy ? PAY_ROGERIO_ID : PAY_LEA_ID;
        const money = (n: number) => `${n.toLocaleString()} ${unit}`;
        const proposal: Proposal = {
          id,
          kind: 'money',
          title: `Pay ${a.who} ${money(draft.amount)} for ${a.work}`,
          sub:
            `Agreed between ${a.who} and ${a.withWhom} in “${a.roomName}”, ${a.when}` +
            (draft.amount !== draft.agreed
              ? ` — the line says ${money(draft.agreed)}`
              : ''),
          amount: draft.amount,
          state: 'open',
          yes: 0,
          no: 0,
          needed: energy ? 3 : 2,
          openedBy: draft.by,
        };
        (energy ? setEProposals : setProposals)((ps) =>
          ps.some((p) => p.id === id) ? ps : [proposal, ...ps],
        );
        setProposalId(id);
        setRoute('proposal');
        toast(
          energy
            ? 'Open. Money moves when all three Shapers agree — everyone can watch.'
            : 'Open. Money moves when both Shapers agree — everyone can watch.',
        );
      },
      vote: (id, v) => {
        const isEnergy = org === 'energy';
        const setVotes = isEnergy ? setEVotes : setMyVotes;
        const setList = isEnergy ? setEProposals : setProposals;
        setVotes((m) => ({ ...m, [id]: v }));
        setList((ps) =>
          ps.map((p) =>
            p.id === id
              ? {
                  ...p,
                  yes: p.yes + (v === 'yes' ? 1 : 0),
                  no: p.no + (v === 'no' ? 1 : 0),
                }
              : p,
          ),
        );
        // the other Shaper(s) answer shortly after — the rest of the quorum
        setTimeout(() => {
          setList((ps) =>
            ps.map((p) => {
              if (p.id !== id || p.state !== 'open') return p;
              const rest = p.needed - p.yes - p.no;
              if (v === 'yes') {
                toast(
                  p.kind === 'money'
                    ? `${isEnergy ? 'All three' : 'Both'} Shapers agreed. ${(
                        p.amount ?? 0
                      ).toLocaleString()} ${unitFor(
                        org,
                      )} moves from the treasury.`
                    : `${
                        isEnergy ? 'All three' : 'Both'
                      } Shapers agreed. The project is live.`,
                );
                return {
                  ...p,
                  yes: p.yes + rest,
                  state: 'passed',
                  decided: 'today',
                };
              }
              toast('Rejected — recorded, with the reason. Nothing moved.');
              return {
                ...p,
                no: p.no + rest,
                state: 'rejected',
                decided: 'today',
              };
            }),
          );
        }, 1600);
      },

      reviewExtend: () => {
        setReview('extended');
        toast('Extended to 1 Sep. One tap — the story was already written.');
      },
      reviewClose: () => {
        setReview('closed');
        toast('Closed. The project and its trail stay readable forever.');
      },

      /* ---- Hypha Energy ---- */
      eSummary,
      eMuni,
      eMuniQuote,
      eCarbon,
      eJoin,
      ePayDraft,
      eProposals,
      eVotes,
      finishSummary: () => {
        setESummary('done');
        setRoute('my');
        toast('Done. Marcus sees it on All Work — with your name on it.');
      },
      triggerMuniDone: (quote, threadId = 'e-pilots') => {
        setEMuni('draftDone');
        setEMuniQuote(quote);
        sendMsg(threadId, {
          id: uid(),
          from: 'agent',
          system: true,
          text: 'Heard — drafted the municipalities ticket as done, receipt attached. Rogerio confirms, or it confirms itself in 48h if nobody objects.',
          card: 'e-done-draft',
        });
      },
      confirmMuniDone: () => {
        setEMuni('done');
        setRoute('my');
        toast(
          'Done, with the receipt on it. Ask your assistant to draft the pay proposal — or Pedro will.',
        );
      },
      reopenMuni: () => {
        setEMuni('doing');
        setEMuniQuote(null);
        toast('Reopened. The draft is gone — nothing changed state silently.');
      },
      offerCarbon: () => {
        setECarbon('offering');
        setTimeout(() => {
          setECarbon('held');
          setEProposals((ps) =>
            ps.some((p) => p.id === 'e-approve-carbon')
              ? ps
              : [
                  {
                    id: 'e-approve-carbon',
                    kind: 'project' as const,
                    title: 'Approve project: Carbon credits module',
                    sub: 'Rowan as DRI',
                    description:
                      'Measure the CO₂ each community avoids, sell the reductions, and fund new setups from the savings they create.',
                    ends: '31 Mar 2028',
                    state: 'passed' as const,
                    decided: 'today',
                    yes: 3,
                    no: 0,
                    needed: 3,
                    openedBy: 'Alex',
                  },
                  ...ps,
                ],
          );
          toast(
            'Rowan accepted — he holds Carbon credits. Recorded as a Shaper approval in Proposals.',
          );
        }, 2000);
      },
      acceptEnergyJoin: () => {
        setEJoin(true);
        toast(
          'Ameland Energy Coop is in — a member community. Nothing lands on them until they accept it.',
        );
      },

      sendMsg,
      toast,
      reset: () => {
        setPersona('you');
        setRoute('onboarding');
        setThreadId('agent');
        setProjectId('stall');
        setTicketId('covers');
        setProposalId('');
        setTicketView(null);
        setYouStage('chat');
        setProfileState(initialProfile);
        setIntentState(null);
        setPinnedJob(null);
        setSetup('offered');
        setCovers('accepted');
        setCoversQuote(null);
        setSubCovers('none');
        setOffers(initialOffers);
        setWeekday('draft');
        setRafiJoined(false);
        setBriefVersion(4);
        setBriefPending(true);
        setReview('due');
        setProposals(seedProposals);
        setMyVotes({});
        setPayDraft(null);
        setChatTicket(null);
        setCustomChats([]);
        setOrg('river');
        setExtraMsgs({});
        setNotice(null);
        setESummary('accepted');
        setEMuni('doing');
        setEMuniQuote(null);
        setECarbon('draft');
        setEJoin(false);
        setEPayDraft(null);
        setEProposals(energyOrg.proposals);
        setEVotes({});
      },
    };
  }, [
    eSummary,
    eMuni,
    eMuniQuote,
    eCarbon,
    eJoin,
    ePayDraft,
    eProposals,
    eVotes,
    persona,
    route,
    threadId,
    projectId,
    ticketId,
    ticketView,
    proposalId,
    youStage,
    profile,
    intent,
    pinnedJob,
    setup,
    covers,
    coversQuote,
    subCovers,
    offers,
    weekday,
    rafiJoined,
    briefVersion,
    briefPending,
    review,
    proposals,
    myVotes,
    payDraft,
    chatTicket,
    customChats,
    org,
    extraMsgs,
    notice,
    toast,
    sendMsg,
  ]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}
