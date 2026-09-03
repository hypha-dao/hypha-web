'use client';

import { Bubble, Composer, ScrollArea, TypingDots } from '@/components/chat';
import {
  AgentMark,
  Avatar,
  Button,
  Card,
  Chip,
  Kicker,
  cn,
} from '@/components/primitives';
import { Workspace } from '@/components/workspace';
import {
  agreedPay,
  energyOrg,
  personaName,
  seedMessages,
  threads,
  unitFor,
  type Msg,
  type OrgId,
  type ProjectId,
} from '@/lib/data';
import {
  useStore,
  PAY_LEA_ID,
  PAY_ROGERIO_ID,
  SUB_COVERS_TITLE,
} from '@/lib/store';
import { useState } from 'react';

let n = 0;
const uid = () => `x${++n}`;

/** "150", "1,500 EURC", "200 usdc" → the number; none → undefined */
function amountIn(text: string): number | undefined {
  const m = text.match(/(\d[\d,]*)\s*(usdc|eurc)?\b/i);
  if (!m) return undefined;
  const v = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * The one way money is asked for: "draft a proposal for my work — 150",
 * "…whatever we agreed", "let's pay Lea what we agreed", "pay me".
 */
const payAsk =
  /\b(pay|paid|payment|proposal for (my|the|his|her)|whatever we agreed|what we agreed|owe)\b/i;

function ticketTitle(text: string) {
  let t = text
    .replace(/^\s*(create|make|add|open)\s+(a\s+)?ticket\s*(to|for|:)?\s*/i, '')
    .replace(/^\s*we\s+(need|should)\s+(a\s+|to\s+)?/i, '')
    .replace(/[.!\s]+$/, '')
    .trim();
  if (!t) t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "how does pay work here?" — a question about the model, not a request to pay */
const payHow =
  /\b(salary|salaries|monthly|hourly|how (do|does|am|is|will|would).*(pay|paid)|when (do|does|am|will).*(pay|paid)|get paid|paid for|pay(ment)? (work|model|system))\b/i;

function payHowReply(org: OrgId, persona: string): string {
  const a = agreedPay[org];
  const unit = unitFor(org);
  const shapers = org === 'energy' ? 'the three Shapers' : 'both Shapers';
  const money = `${a.amount.toLocaleString()} ${unit}`;
  const mine =
    persona === 'lea'
      ? ` Yours: you and ${a.withWhom} agreed ${money} for ${a.work} in “${a.roomName}” on ${a.when} — I have the line. When the ticket is done, tell me “draft a proposal for my work” and name the sum, or say “whatever we agreed”.`
      : persona === 'sam'
      ? ` Under you: ${a.who} and you agreed ${money} for ${a.work} in “${a.roomName}” on ${a.when}. When it is done, either of you asks me to draft the proposal. Your own pay for holding the project is between you and the Shapers — same move, same room.`
      : persona === 'you'
      ? org === 'energy'
        ? ' Nothing is agreed for your summary ticket yet. If it should pay, say a number to Marcus in “Pilots” — I remember the line, and when the ticket is done you ask me to draft the proposal.'
        : ' Nothing is agreed for your setup ticket — Sam offered it as a favour. If you think it should pay, say a number to Sam in “Saturday stall”; I remember the line, and when the ticket is done you ask me to draft the proposal.'
      : persona === 'maya'
      ? ' As a Shaper you see every pay proposal on Proposals and on My Work — you agree or not. Sums are never on tickets; they are in the rooms and in the proposals.'
      : '';
  return (
    `No salaries, no invoices, no numbers on tickets or projects. Pay is agreed where you already talk — a ticket holder with the project DRI, or a DRI with a Shaper — and I remember the line. When the work is done, anyone involved tells me “draft a proposal for the Shapers for this work” with a sum, or “whatever we agreed”, and I draft it with the agreement and the done receipt attached. ${shapers} agree, the money moves, and it shows on the profile. I never move money myself.` +
    mine
  );
}

/** what the assistant says when someone asks for pay before the work is done */
function notYetReply(org: OrgId): string {
  const a = agreedPay[org];
  return `${a.who}’s ${a.work} ticket is not confirmed done yet. Say it is done in “${a.roomName}” or here and I draft the done for ${a.who} to confirm — then ask me again and I draft the pay proposal with the agreed line attached.`;
}

/* =========================================================
   Thread — with agent cards, receipts, and scripted replies
   ========================================================= */

type ThreadInfo = {
  id: string;
  kind: 'agent' | 'shapers' | 'room' | 'dm';
  title: string;
  sub: string;
};

export function Thread() {
  const s = useStore();
  const custom = s.customChats.find((c) => c.id === s.threadId);
  const t: ThreadInfo =
    (threads.find((x) => x.id === s.threadId) as ThreadInfo | undefined) ??
    (energyOrg.threads.find((x) => x.id === s.threadId) as
      | ThreadInfo
      | undefined) ??
    (custom
      ? {
          id: custom.id,
          kind: 'room',
          title: custom.title,
          sub: 'room you started · feeds the org like any other',
        }
      : (threads[0] as ThreadInfo));
  const [agentTyping, setAgentTyping] = useState(false);
  // the assistant is one thread in the sidebar but keeps a history per org
  const key = t.kind === 'agent' ? s.agentKey : t.id;
  const msgs: Msg[] = [
    ...(seedMessages[key] ?? []),
    ...(s.extraMsgs[key] ?? []),
  ];

  function agentReply(text: string, extra?: Partial<Msg>) {
    setAgentTyping(true);
    setTimeout(() => {
      setAgentTyping(false);
      s.sendMsg(key, { id: uid(), from: 'agent', text, ...extra });
    }, 950);
  }

  function later(fn: () => void) {
    setAgentTyping(true);
    setTimeout(() => {
      setAgentTyping(false);
      fn();
    }, 1100);
  }

  function send(text: string) {
    s.sendMsg(key, { id: uid(), from: 'you', text });
    if (s.org === 'energy') return sendEnergy(text);

    const splitish = /\b(print|rota|could you|can you take|piece)\b/i.test(
      text,
    );

    // ---- rooms: the org listens ----
    if (t.id === 'saturday') {
      // Lea asks Jun for a piece of her ticket — heard, drafted under hers
      if (splitish && s.persona === 'lea' && s.covers === 'accepted') {
        if (s.subCovers === 'none') later(() => s.draftSubTicket('saturday'));
        return;
      }
      if (/\b(done|finished|found|covered|got (both|two))\b/i.test(text)) {
        if (s.covers === 'accepted') {
          setAgentTyping(true);
          setTimeout(() => {
            setAgentTyping(false);
            s.triggerDoneDraft(text);
          }, 1100);
        }
      }
      return;
    }
    if (t.kind !== 'agent') return;

    // ---- the assistant thread ----
    if (payHow.test(text)) {
      agentReply(payHowReply('river', s.persona), {
        receipts: [
          {
            label: 'Where Lea and Sam agreed the covers pay — “Saturday stall”',
            go: 'thread',
            id: 'saturday',
          },
          {
            label: 'Proposal — Lea, four Saturdays hosted',
            go: 'proposal',
            id: 'lea-saturdays',
          },
          {
            label: 'Proposal — Priya, voucher design',
            go: 'proposal',
            id: 'pay-priya',
          },
        ],
      });
      return;
    }
    const payish = payAsk.test(text);
    const askish =
      /\b(council|licen[cs]e|hall|before|dealt|history|happened|sponsor)\b/i.test(
        text,
      );
    const doneish = /\b(done|finished|found|covered)\b/i.test(text);
    const worky = /\b(need|should|fix|broken|help|ticket|project)\b/i.test(
      text,
    );

    // move your own work: Lea says her ticket is done, right here
    if (doneish && s.persona === 'lea' && s.covers === 'accepted') {
      setAgentTyping(true);
      setTimeout(() => {
        setAgentTyping(false);
        s.triggerDoneDraft(text, 'agent');
      }, 1100);
      return;
    }

    if (payish) {
      if (s.proposals.some((p) => p.id === PAY_LEA_ID)) {
        agentReply(
          'That proposal is already open — the Shapers are deciding. It is on the Proposals page.',
        );
      } else if (s.payDraft) {
        agentReply(
          'The draft is above — open it as a proposal when you are ready. I never move money.',
        );
      } else if (s.persona === 'you') {
        agentReply(
          'Nothing is agreed for your setup ticket — Sam offered it as a favour. If you think it should pay, say a number to Sam in “Saturday stall”; I remember the line, and when the ticket is done you ask me to draft the proposal.',
        );
      } else if (s.covers === 'done') {
        const amount = amountIn(text);
        later(() => s.draftPayment(amount));
      } else {
        agentReply(notYetReply('river'));
      }
      return;
    }

    // split your own work: Lea holds covers, so a need she voices lands
    // under her ticket — the nearest thing she holds — not with Sam
    if ((splitish || worky) && s.persona === 'lea' && s.covers !== 'done') {
      if (s.subCovers === 'none') {
        later(() => s.draftSubTicket());
      } else {
        agentReply(
          s.subCovers === 'drafted'
            ? 'The draft is above — offer it to Jun when you are ready.'
            : s.subCovers === 'offered'
            ? 'Offered to Jun — his yes or no, nobody else’s.'
            : s.subCovers === 'accepted'
            ? 'Jun holds the rota, under your covers ticket. Yours cannot close until his piece does — done moves up the tree, never down.'
            : 'Jun printed the rota — done, receipt in “Saturday stall”. Your covers ticket can close now.',
        );
      }
      return;
    }

    if (askish) {
      agentReply(
        s.weekday === 'held'
          ? 'Yes — twice. The council licence came up in “Saturday stall”; nobody held it, so a project was drafted and Rafi holds Weekday hall now. And the org already decided about outside money: the brand sponsorship was rejected on 2 May, and the brief says no brand money. Receipts below.'
          : 'Yes — twice. Jun raised the council licence in “Saturday stall”; nobody held it, so I drafted the Weekday hall project — it is with the Shapers now. And on outside money: the brand sponsorship was rejected on 2 May, and the brief says no brand money. Receipts below.',
        {
          receipts: [
            {
              label: 'Jun — “Who signs the weekday hall licence?”',
              go: 'thread',
              id: 'saturday',
            },
            {
              label: 'Proposal — sponsorship rejected, 2 May',
              go: 'proposal',
              id: 'sponsor',
            },
            {
              label: 'Project — Weekday hall',
              go: 'project',
              id: 'weekday',
            },
          ],
        },
      );
      return;
    }

    if (worky) {
      if (s.chatTicket?.org === 'river') {
        agentReply(
          s.chatTicket.state === 'created'
            ? 'That ticket exists — open, under Saturday stall. It is on All Work.'
            : s.chatTicket.state === 'routed'
            ? 'The draft is with Sam — it exists when he confirms.'
            : 'The draft is above — create it, or send it to Sam.',
        );
        return;
      }
      later(() => s.draftChatTicket(ticketTitle(text)));
      return;
    }

    agentReply(
      'Noted — it is in the record. If it ever needs work or a decision, I will draft the card and the right person says yes or no.',
    );
  }

  /* ---- Hypha Energy: same assistant, different rooms and receipts ---- */
  function sendEnergy(text: string) {
    const doneish = /\b(done|finished|signed|onboarded|both)\b/i.test(text);

    if (t.id === 'e-pilots') {
      if (doneish && s.persona === 'lea' && s.eMuni === 'doing')
        later(() => s.triggerMuniDone(text));
      return;
    }
    if (t.kind !== 'agent') return;

    if (payHow.test(text)) {
      agentReply(payHowReply('energy', s.persona), {
        receipts: [
          {
            label:
              'Where Rogerio and Pedro agreed the municipalities pay — “Pilots”',
            go: 'thread',
            id: 'e-pilots',
          },
          {
            label: 'Proposal — Pedro, held Iberia through May',
            go: 'proposal',
            id: 'e-pedro-stipend',
          },
          {
            label: 'Proposal — Rowan, battery optimisation v2',
            go: 'proposal',
            id: 'e-pay-rowan',
          },
        ],
      });
      return;
    }

    const payish = payAsk.test(text);
    const askish =
      /\b(ameland|sandbox|eecf|grant|nordpool|portug|coop[eé]rnico|carbon|credits|who holds|hubs|white ?paper|research)\b/i.test(
        text,
      );
    const worky = /\b(need|should|fix|broken|help|ticket|project)\b/i.test(
      text,
    );

    // Rogerio moves his own work from here
    if (doneish && s.persona === 'lea' && s.eMuni === 'doing') {
      later(() => s.triggerMuniDone(text, 'e-agent'));
      return;
    }

    if (payish) {
      if (s.eProposals.some((p) => p.id === PAY_ROGERIO_ID)) {
        agentReply(
          'That proposal is already open — the three Shapers are deciding. It is on the Proposals page.',
        );
      } else if (s.ePayDraft) {
        agentReply(
          'The draft is above — open it as a proposal when you are ready. I never move money.',
        );
      } else if (s.persona === 'you') {
        agentReply(
          'Nothing is agreed for your summary ticket yet. If it should pay, say a number to Marcus in “Pilots” — I remember the line, and when the ticket is done you ask me to draft the proposal.',
        );
      } else if (s.eMuni === 'done') {
        const amount = amountIn(text);
        later(() => s.draftPayment(amount));
      } else {
        agentReply(notYetReply('energy'));
      }
      return;
    }

    if (askish) {
      agentReply(
        'Yes. Ameland ran the tokenised credits through a full sandbox cycle — Marcus posted the report an hour ago and the ticket is done. The EECF second call opens in spring; Pedro wants six communities ready, and the 6,000 EURC to support their applications is an open proposal with the Shapers. Receipts below.',
        {
          receipts: [
            {
              label: 'Marcus — “Ameland report is live”',
              go: 'thread',
              id: 'e-pilots',
            },
            {
              label: 'Proposal — EECF round 2, open',
              go: 'proposal',
              id: 'e-eecf',
            },
            { label: 'Project — Island grids', go: 'project', id: 'islands' },
          ],
        },
      );
      return;
    }

    if (worky) {
      if (s.chatTicket?.org === 'energy') {
        agentReply(
          s.chatTicket.state === 'created'
            ? 'That ticket exists — open, under Iberia pilots. It is on All Work.'
            : s.chatTicket.state === 'routed'
            ? 'The draft is with Pedro — it exists when he confirms.'
            : 'The draft is above — create it, or send it to Pedro.',
        );
        return;
      }
      later(() => s.draftChatTicket(ticketTitle(text)));
      return;
    }

    agentReply(
      'Noted — it is in the record. If it ever needs work or a decision, I will draft the card and the right person says yes or no.',
    );
  }

  const suggestions: string[] =
    s.org === 'energy'
      ? t.kind === 'agent'
        ? [
            'What happened with Ameland?',
            'How do I get paid here?',
            ...(s.chatTicket?.org !== 'energy'
              ? [
                  s.persona === 'sam'
                    ? 'Create a ticket: Spanish-language onboarding guide'
                    : 'We need a Spanish-language onboarding guide',
                ]
              : []),
            ...(s.persona === 'lea' && s.eMuni === 'doing'
              ? ['Both municipalities signed — done.']
              : []),
            ...(s.persona === 'lea' && s.eMuni === 'done' && !s.ePayDraft
              ? [
                  'Draft a proposal for the Shapers for my municipalities work — whatever we agreed.',
                ]
              : []),
            ...(s.persona === 'sam' && s.eMuni === 'done' && !s.ePayDraft
              ? [
                  'Rogerio finished the municipalities — draft the pay proposal, what we agreed.',
                ]
              : []),
          ]
        : t.id === 'e-pilots' && s.persona === 'lea' && s.eMuni === 'doing'
        ? ['Both municipalities signed — done.']
        : []
      : t.kind === 'agent'
      ? [
          'Have we dealt with the council before?',
          'How do I get paid here?',
          ...(s.chatTicket?.org !== 'river' && s.persona !== 'lea'
            ? [
                s.persona === 'sam'
                  ? 'Create a ticket: print price signs for the stall'
                  : 'We need price signs for the stall',
              ]
            : []),
          ...(s.persona === 'lea' && s.covers === 'accepted'
            ? [
                ...(s.subCovers === 'none'
                  ? ['Jun, could you print the Saturday cover rota?']
                  : []),
                'Found both covers — Priya and Tom. Done.',
              ]
            : []),
          ...(s.persona === 'lea' && s.covers === 'done' && !s.payDraft
            ? [
                'Draft a proposal for the Shapers for my covers work — whatever we agreed.',
                'Draft a proposal for my covers work — 200 USDC.',
              ]
            : []),
          ...(s.persona === 'sam' && s.covers === 'done' && !s.payDraft
            ? [
                'Lea finished the covers — draft the pay proposal, what we agreed.',
              ]
            : []),
        ]
      : t.id === 'saturday' && s.persona === 'lea' && s.covers === 'accepted'
      ? [
          ...(s.subCovers === 'none'
            ? ['Jun, could you print the Saturday cover rota?']
            : []),
          'Found both covers — Priya and Tom. Done.',
        ]
      : [];

  return (
    <Workspace>
      <header className="flex shrink-0 items-center gap-3 border-b border-hair px-4 py-3 md:px-6">
        {t.kind === 'agent' ? (
          <AgentMark size={14} />
        ) : (
          <Avatar name={t.title} size="sm" />
        )}
        <div>
          <p className="text-[14px] font-semibold tracking-[-0.01em]">
            {t.title}
          </p>
          <p className="text-[12px] text-faint">
            {t.kind === 'agent'
              ? 'Your personal AI · creates tickets, moves your work, answers with receipts — decides nothing'
              : t.kind === 'shapers'
              ? 'Private · where the brief gets confirmed'
              : t.sub}
          </p>
        </div>
      </header>

      <ScrollArea
        deps={[
          msgs.length,
          agentTyping,
          s.covers,
          s.subCovers,
          s.briefPending,
          s.eMuni,
        ]}
      >
        {msgs.map((m) => (
          <MsgBlock
            key={m.id}
            msg={m}
            agentName={
              t.kind === 'agent'
                ? 'Personal Assistant'
                : s.org === 'energy'
                ? 'Hypha Energy'
                : 'River Commons'
            }
            agentRole={t.kind === 'agent' ? 'your AI' : 'agent'}
          />
        ))}
        {agentTyping && <TypingDots />}
      </ScrollArea>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-1 md:px-6">
          {suggestions.map((sg) => (
            <button
              key={sg}
              type="button"
              onClick={() => send(sg)}
              className="rounded-full border border-hair bg-paper px-3.5 py-1.5 text-[13px] text-sub transition-colors hover:border-ink hover:text-ink"
            >
              {sg}
            </button>
          ))}
        </div>
      )}

      <Composer
        onSend={send}
        placeholder={
          t.kind === 'agent'
            ? 'Ask, or say what should happen…'
            : `Message ${t.title}…`
        }
      />
    </Workspace>
  );
}

/* ---------- message + attached card / receipts ---------- */

function MsgBlock({
  msg,
  agentName,
  agentRole,
}: {
  msg: Msg;
  agentName: string;
  agentRole: string;
}) {
  const s = useStore();
  return (
    <div className="flex flex-col gap-2.5">
      <Bubble msg={msg} agentName={agentName} agentRole={agentRole} />
      {msg.receipts && (
        <div className="flex flex-wrap gap-2 pl-11">
          {msg.receipts.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                if (r.go === 'thread') s.openThread(r.id);
                else if (r.go === 'proposal') s.openProposal(r.id);
                else s.openProject(r.id as ProjectId);
              }}
              className="rounded-full border border-hair bg-paper px-3 py-1.5 text-[12px] font-medium text-sub transition-colors hover:border-agent hover:text-agent"
            >
              {r.label} →
            </button>
          ))}
        </div>
      )}
      {msg.card === 'payment-draft' && <PaymentDraftCard />}
      {msg.card === 'done-draft' && <DoneDraftCard />}
      {msg.card === 'e-done-draft' && <EnergyDoneDraftCard />}
      {msg.card === 'brief-draft' && <BriefDraftCard />}
      {msg.card === 'ticket-draft' && <TicketDraftCard />}
      {msg.card === 'sub-ticket-draft' && <SubTicketDraftCard />}
    </div>
  );
}

/** A ticket under Lea's ticket — she holds the parent, so she offers it. */
function SubTicketDraftCard() {
  const s = useStore();
  const st = s.subCovers;
  if (st === 'none') return null;
  const settled = st !== 'drafted';
  return (
    <Card className={cn('ml-11 max-w-md p-4', !settled && 'border-agent/30')}>
      <div className="flex items-center justify-between gap-3">
        <Kicker className={settled ? undefined : 'text-agent'}>
          Ticket draft — under your covers ticket
        </Kicker>
        {st === 'offered' && <Chip>offered to Jun</Chip>}
        {st === 'accepted' && <Chip tone="agent">Jun holds it</Chip>}
        {st === 'done' && <Chip>done</Chip>}
      </div>
      <p className="mt-2 text-[15px] font-semibold tracking-[-0.015em]">
        {SUB_COVERS_TITLE}
      </p>
      <p className="mt-1 text-[12px] text-faint">
        Saturday stall › Find two neighbours who can cover a Saturday › this
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-sub">
        {st === 'drafted'
          ? 'Jun has the printer — he said so in “Saturday stall”. You hold the covers ticket, so you can offer a piece of it yourself. Due 6 Jun. Nothing exists until Jun says yes.'
          : st === 'offered'
          ? 'Offered. His yes or no, nobody else’s. Yours stays whole above it.'
          : st === 'accepted'
          ? 'Jun is DRI of this piece only. Your covers ticket cannot close until it does — done moves up, never down.'
          : 'Printed, confirmed by Jun, receipt in “Saturday stall”. Your covers ticket can close now.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {st === 'drafted' && s.persona === 'lea' && (
          <>
            <Button size="sm" onClick={s.offerSubTicket}>
              Offer to Jun
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                s.toast(
                  'Amended in place — title, due, wording. Still a draft.',
                )
              }
            >
              Amend
            </Button>
          </>
        )}
        {st === 'drafted' && s.persona !== 'lea' && (
          <p className="text-[13px] text-sub">
            Only Lea can offer this — she holds the ticket above it.
          </p>
        )}
        {st === 'offered' && (
          <p className="text-[13px] text-sub">Waiting on Jun…</p>
        )}
        {(st === 'accepted' || st === 'done') && (
          <Button
            size="sm"
            variant="soft"
            onClick={() =>
              s.persona === 'lea'
                ? s.openTicket('covers')
                : s.openProject('stall')
            }
          >
            See it under the covers ticket →
          </Button>
        )}
      </div>
    </Card>
  );
}

function PaymentDraftCard() {
  const s = useStore();
  const energy = s.org === 'energy';
  const id = energy ? PAY_ROGERIO_ID : PAY_LEA_ID;
  const list = energy ? s.eProposals : s.proposals;
  const draft = energy ? s.ePayDraft : s.payDraft;
  const a = agreedPay[s.org];
  const unit = unitFor(s.org);
  const opened = list.some((p) => p.id === id);
  if (!draft) return null;
  const money = (n: number) => `${n.toLocaleString()} ${unit}`;
  const differs = draft.amount !== draft.agreed;
  return (
    <Card className={cn('ml-11 max-w-md p-4', !opened && 'border-agent/30')}>
      <div className="flex items-center justify-between">
        <Kicker className="text-agent">Proposal draft — for the Shapers</Kicker>
        {opened && <Chip>opened</Chip>}
      </div>
      <p className="mt-2 text-[15px] font-semibold tracking-[-0.015em]">
        Pay {a.who} for {a.work} — {money(draft.amount)}
      </p>
      <blockquote className="mt-2 rounded-xl bg-wash px-3 py-2 text-[13px] leading-relaxed text-sub">
        “{money(a.amount)} when both are {energy ? 'signed' : 'found'}.{' '}
        {energy ? 'Yes' : 'Deal'}.” — {a.withWhom} to {a.who}, “{a.roomName}”,{' '}
        {a.when}
      </blockquote>
      <p className="mt-2 text-[13px] leading-relaxed text-sub">
        {differs
          ? `${draft.by} named ${money(
              draft.amount,
            )}; the agreed line says ${money(
              draft.agreed,
            )}. Both go on the card so the Shapers see the difference. `
          : ''}
        Evidence: the agreement above, the ticket for {a.work} (done, confirmed
        by {a.who}), and the line in “{a.roomName}” where done was said.
      </p>
      <div className="mt-3 flex gap-2">
        {opened ? (
          <Button size="sm" variant="soft" onClick={() => s.openProposal(id)}>
            See the vote →
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={s.openPayProposal}>
              Open as a proposal
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                s.toast('Amended in place — amount, wording. Still a draft.')
              }
            >
              Amend
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function TicketDraftCard() {
  const s = useStore();
  const t = s.chatTicket;
  if (!t || t.org !== s.org) return null;
  const energy = t.org === 'energy';
  const project = energy ? 'Iberia pilots' : 'Saturday stall';
  const dri = personaName(t.org, 'sam');
  const settled = t.state !== 'drafted';
  return (
    <Card className={cn('ml-11 max-w-md p-4', !settled && 'border-agent/30')}>
      <div className="flex items-center justify-between">
        <Kicker className={settled ? undefined : 'text-agent'}>
          Ticket draft — under {project}
        </Kicker>
        {t.state === 'created' && <Chip>created</Chip>}
        {t.state === 'routed' && <Chip>with {dri}</Chip>}
      </div>
      <p className="mt-2 text-[15px] font-semibold tracking-[-0.015em]">
        {t.title}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-sub">
        No DRI yet — it starts open, and someone accepts it. Only the project
        DRI can make it real.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {t.state === 'drafted' &&
          (s.persona === 'sam' ? (
            <>
              <Button size="sm" onClick={s.confirmChatTicket}>
                Create it
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  s.toast('Amended in place — title, due. Still a draft.')
                }
              >
                Amend
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={s.routeChatTicket}>
              Send to {dri} — he confirms
            </Button>
          ))}
        {t.state === 'created' && (
          <Button
            size="sm"
            variant="soft"
            onClick={() => s.openProject(energy ? 'iberia' : 'stall')}
          >
            See it on the board →
          </Button>
        )}
        {t.state === 'routed' && (
          <p className="text-[13px] text-sub">
            Nothing exists until {dri} says yes — same rule as everything else.
          </p>
        )}
      </div>
    </Card>
  );
}

function DoneDraftCard() {
  const s = useStore();
  if (s.covers === 'accepted') {
    return (
      <Card className="ml-11 max-w-md p-4">
        <Kicker>Done draft — withdrawn</Kicker>
        <p className="mt-1.5 text-[13px] text-sub">
          Reopened. Nothing changed state silently.
        </p>
      </Card>
    );
  }
  const confirmed = s.covers === 'done';
  return (
    <Card className={cn('ml-11 max-w-md p-4', !confirmed && 'border-agent/30')}>
      <div className="flex items-center justify-between">
        <Kicker className={confirmed ? undefined : 'text-agent'}>
          Done draft — covers ticket
        </Kicker>
        {confirmed && <Chip>confirmed</Chip>}
      </div>
      <p className="mt-2 text-[14px] font-medium">
        Find two neighbours who can cover a Saturday
      </p>
      {s.coversQuote && (
        <blockquote className="mt-2 rounded-xl bg-wash px-3 py-2 text-[13px] leading-relaxed text-sub">
          “{s.coversQuote}” — this thread, today
        </blockquote>
      )}
      {confirmed ? (
        <p className="mt-2 text-[13px] text-sub">
          Confirmed by Lea. The receipt stays on the ticket.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-sub">
            Lea confirms — or it confirms itself in 48h if nobody objects.
          </p>
          {s.persona === 'lea' && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={s.confirmCoversDone}>
                Confirm — done
              </Button>
              <Button size="sm" variant="ghost" onClick={s.reopenCovers}>
                Not done yet
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function EnergyDoneDraftCard() {
  const s = useStore();
  if (s.eMuni === 'doing') {
    return (
      <Card className="ml-11 max-w-md p-4">
        <Kicker>Done draft — withdrawn</Kicker>
        <p className="mt-1.5 text-[13px] text-sub">
          Reopened. Nothing changed state silently.
        </p>
      </Card>
    );
  }
  const confirmed = s.eMuni === 'done';
  return (
    <Card className={cn('ml-11 max-w-md p-4', !confirmed && 'border-agent/30')}>
      <div className="flex items-center justify-between">
        <Kicker className={confirmed ? undefined : 'text-agent'}>
          Done draft — municipalities ticket
        </Kicker>
        {confirmed && <Chip>confirmed</Chip>}
      </div>
      <p className="mt-2 text-[14px] font-medium">
        Onboard two Portuguese municipalities
      </p>
      {s.eMuniQuote && (
        <blockquote className="mt-2 rounded-xl bg-wash px-3 py-2 text-[13px] leading-relaxed text-sub">
          “{s.eMuniQuote}” — this thread, today
        </blockquote>
      )}
      {confirmed ? (
        <p className="mt-2 text-[13px] text-sub">
          Confirmed by Rogerio. The receipt stays on the ticket.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-sub">
            Rogerio confirms — or it confirms itself in 48h if nobody objects.
          </p>
          {s.persona === 'lea' && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={s.confirmMuniDone}>
                Confirm — done
              </Button>
              <Button size="sm" variant="ghost" onClick={s.reopenMuni}>
                Not done yet
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function BriefDraftCard() {
  const s = useStore();
  const decided = !s.briefPending;
  const confirmed = s.briefVersion === 5;
  return (
    <Card className={cn('ml-11 max-w-md p-4', !decided && 'border-agent/30')}>
      <div className="flex items-center justify-between">
        <Kicker className={decided ? undefined : 'text-agent'}>
          Brief v5 — one line added
        </Kicker>
        {decided && <Chip>{confirmed ? 'confirmed' : 'kept v4'}</Chip>}
      </div>
      <p className="mt-2 text-[14px] font-medium leading-relaxed">
        “We do not take the brand sponsorship. Not this year.”
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
        From Tuesday’s call · consistent with the vote on 2 May. Everything I
        draft reads from the confirmed brief.
      </p>
      {!decided && (s.persona === 'maya' || s.persona === 'sam') && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={s.confirmBrief}>
            Confirm v5
          </Button>
          <Button size="sm" variant="ghost" onClick={s.rejectBrief}>
            That is not what we decided
          </Button>
        </div>
      )}
      {!decided && s.persona !== 'maya' && s.persona !== 'sam' && (
        <p className="mt-2 text-[12px] text-faint">
          Waiting on a Shaper’s confirm.
        </p>
      )}
    </Card>
  );
}
