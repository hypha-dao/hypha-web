'use client';

import { Avatar, Card, Chip, Kicker } from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import { agreedPay, unitFor } from '@/lib/data';
import { useStore, PAY_LEA_ID, PAY_ROGERIO_ID } from '@/lib/store';
import { CurrencyRow } from './org';

type HistoryItem = { what: string; when: string };
/** one payment that reached this person — always a proposal the Shapers passed */
type Payment = {
  what: string;
  amount: string;
  when: string;
  /** where the sum was agreed before the proposal */
  agreed: string;
  proposalId?: string;
};
type ProfileData = {
  name: string;
  role: string;
  since: string;
  currencies: { symbol: string; name: string; amount: string; note?: string }[];
  payments: Payment[];
  history: HistoryItem[];
  trust: { label: string; text: string };
};

/** the live payment, once its proposal passed — built from the proposal itself */
function livePayment(
  s: ReturnType<typeof useStore>,
  org: 'river' | 'energy',
): Payment[] {
  const list = org === 'energy' ? s.eProposals : s.proposals;
  const id = org === 'energy' ? PAY_ROGERIO_ID : PAY_LEA_ID;
  const p = list.find((x) => x.id === id);
  if (!p || p.state !== 'passed') return [];
  const a = agreedPay[org];
  return [
    {
      what: a.work.charAt(0).toUpperCase() + a.work.slice(1),
      amount: `${(p.amount ?? 0).toLocaleString()} ${unitFor(org)}`,
      when: 'today',
      agreed: `with ${a.withWhom} in “${a.roomName}”, ${a.when}`,
      proposalId: id,
    },
  ];
}

/* ---- Hypha Energy: the same five viewpoints, this org's record ---- */
function energyProfile(s: ReturnType<typeof useStore>): ProfileData {
  const rogerioProposal = s.eProposals.find((p) => p.id === PAY_ROGERIO_ID);
  const rogerioPaid = rogerioProposal?.state === 'passed';
  const rogerioAmount = (rogerioProposal?.amount ?? 0).toLocaleString();
  const kwh = (n: string, note: string) => ({
    symbol: 'KWH',
    name: 'Tokenised energy credits',
    amount: n,
    note,
  });

  switch (s.persona) {
    case 'lea':
      return {
        name: 'Rogerio',
        role: 'Member · Ticket DRI',
        since: 'since 2024',
        currencies: [
          kwh('42,000 kWh', 'earned facilitating the Portuguese communities'),
          ...(rogerioPaid
            ? [
                {
                  symbol: 'EURC',
                  name: 'Euro Coin',
                  amount: rogerioAmount,
                  note: 'paid for the municipalities — proposal, today',
                },
              ]
            : []),
        ],
        payments: livePayment(s, 'energy'),
        history: [
          {
            what:
              s.eMuni === 'done'
                ? 'Onboarded two Portuguese municipalities — done, confirmed'
                : 'Holds the municipalities ticket — in progress',
            when: s.eMuni === 'done' ? 'today' : 'due 30 Jun',
          },
          { what: 'Ran onboarding for 4 Portuguese communities', when: '2025' },
          { what: 'Brought Coopérnico to the table', when: 'Jan 2026' },
        ],
        trust: {
          label: 'Reliable',
          text: 'Four communities onboarded, four still producing. Every ticket he accepted ended done, with a receipt — and when a council stalls he says so in the room the same day, not at the review.',
        },
      };
    case 'sam':
      return {
        name: 'Pedro',
        role: 'Project DRI',
        since: 'since 2023',
        currencies: [
          kwh('118,000 kWh', 'earned holding Iberia pilots'),
          {
            symbol: 'EURC',
            name: 'Euro Coin',
            amount: '1,200',
            note: 'for holding Iberia through May — proposal, 3 Jun',
          },
        ],
        payments: [
          {
            what: 'Held Iberia pilots through May',
            amount: '1,200 EURC',
            when: '3 Jun',
            agreed: 'with Alex in “Pilots” when he took the project',
            proposalId: 'e-pedro-stipend',
          },
        ],
        history: [
          {
            what: 'Holds Iberia pilots — live in two countries',
            when: 'ongoing',
          },
          { what: 'Signed the Coopérnico partnership', when: 'Jan 2026' },
          { what: 'Approved as project DRI by the Shapers', when: 'Nov 2025' },
        ],
        trust: {
          label: 'Steady',
          text: 'The pilots have held under him through two grant cycles. Every payment under him was agreed in the room first and moved by a proposal — nobody under him got surprised. Offers work instead of assigning it.',
        },
      };
    case 'maya':
      return {
        name: 'Alex',
        role: 'Shaper · Founder',
        since: 'founded 2022',
        currencies: [
          kwh('260,000 kWh', 'founder allocation, decided at founding'),
        ],
        payments: [],
        history: [
          {
            what: 'Confirmed strategy v3 — the org reads from it',
            when: 'Jan 2026',
          },
          { what: 'Confirmed mission v2', when: 'Jan 2024' },
          { what: 'Decided 14 proposals as Shaper', when: '2024–2026' },
          {
            what: 'Founded Hypha Energy with Edgar and Zekeriya',
            when: '2022',
          },
        ],
        trust: {
          label: 'Consistent',
          text: 'Every direction version he confirmed matches what the org then did — four white papers promised, four published. Rejects drafts as often as he confirms them, which is what keeps the record honest.',
        },
      };
    case 'eli':
      return {
        name: 'Nina',
        role: 'Investor · watches',
        since: 'since 2025',
        currencies: [],
        payments: [],
        history: [],
        trust: {
          label: 'Observer',
          text: 'No work history — investors watch, they do not hold. She funded the sandbox and sees everything on the Overview; the receipts are her due diligence.',
        },
      };
    default:
      return {
        name: s.profile.name || 'You',
        role: 'Member',
        since: 'joined from the Ameland pilot',
        currencies: [
          kwh(
            s.eSummary === 'done' ? '1,200 kWh' : '800 kWh',
            s.eSummary === 'done'
              ? 'earned producing on Ameland, plus your first ticket'
              : 'earned producing on Ameland',
          ),
        ],
        payments: [],
        history: [
          {
            what:
              s.eSummary === 'done'
                ? 'Wrote the Ameland pilot summary — done'
                : 'Holds the Ameland summary ticket — in progress',
            when: s.eSummary === 'done' ? 'today' : 'due 15 Jul',
          },
          { what: 'Household in the Ameland sandbox pilot', when: '2026' },
        ],
        trust: {
          label: 'New',
          text:
            s.eSummary === 'done'
              ? 'First ticket accepted and done, same week. One receipt is not a track record — but it is exactly how one starts.'
              : 'One ticket held, none finished yet. Trust here is built from receipts — finish it and the record starts writing itself.',
        },
      };
  }
}

export function ProfileScreen() {
  const s = useStore();
  const leaProposal = s.proposals.find((p) => p.id === PAY_LEA_ID);
  const leaPaid = leaProposal?.state === 'passed';
  const leaAmountN = leaProposal?.amount ?? 0;

  const data: ProfileData = (() => {
    if (s.org === 'energy') return energyProfile(s);
    switch (s.persona) {
      case 'lea':
        return {
          name: 'Lea',
          role: 'Member · Ticket DRI',
          since: 'since March',
          currencies: [
            {
              symbol: 'RIVER',
              name: 'River Commons currency',
              amount: '380',
              note: 'earned hosting Saturdays',
            },
            {
              symbol: 'USDC',
              name: 'USD Coin',
              amount: leaPaid ? (80 + leaAmountN).toLocaleString() : '80',
              note: leaPaid
                ? 'Saturdays in May, and the covers — today'
                : 'four Saturdays hosted in May — proposal, 2 Jun',
            },
          ],
          payments: [
            {
              what: 'Four Saturdays hosted in May',
              amount: '80 USDC',
              when: '2 Jun',
              agreed: 'with Sam in “Saturday stall” — 20 a Saturday',
              proposalId: 'lea-saturdays',
            },
            ...livePayment(s, 'river'),
          ],
          history: [
            {
              what:
                s.covers === 'done'
                  ? 'Found two Saturday covers — done, confirmed'
                  : 'Holds the covers ticket — in progress',
              when: s.covers === 'done' ? 'today' : 'due 7 Jun',
            },
            { what: 'Hosted the Saturday stall 9 times', when: 'since March' },
            { what: 'Helped Jun agree grower prices', when: 'May' },
          ],
          trust: {
            label: 'Reliable',
            text: 'Nine of nine Saturdays she said she would host, she hosted. Every ticket she accepted ended done, with a receipt. When she declines, she says why — the weekday hall came back with a reason, not silence.',
          },
        };
      case 'sam':
        return {
          name: 'Sam',
          role: 'Shaper · Project DRI',
          since: 'since March',
          currencies: [
            {
              symbol: 'RIVER',
              name: 'River Commons currency',
              amount: '640',
              note: 'earned holding the stall',
            },
            {
              symbol: 'USDC',
              name: 'USD Coin',
              amount: '60',
              note: 'for holding the stall through May — proposal, 2 Jun',
            },
          ],
          payments: [
            {
              what: 'Held Saturday stall through May',
              amount: '60 USDC',
              when: '2 Jun',
              agreed: 'with Maya in “Shapers” when he took the stall',
              proposalId: 'sam-stipend',
            },
          ],
          history: [
            {
              what: 'Holds Saturday stall — every week since March',
              when: 'ongoing',
            },
            { what: 'Offered 3 tickets, all answered', when: 'May–Jun' },
            { what: 'Approved as project DRI by the Shapers', when: '12 May' },
          ],
          trust: {
            label: 'Steady',
            text: 'The stall has held every week under him. Every payment under him was agreed in the room first and moved by a proposal — nobody under him got surprised. Offers work instead of assigning it.',
          },
        };
      case 'maya':
        return {
          name: 'Maya',
          role: 'Shaper · Founder',
          since: 'founded March',
          currencies: [
            {
              symbol: 'RIVER',
              name: 'River Commons currency',
              amount: '720',
              note: 'founder allocation, decided at founding',
            },
          ],
          payments: [],
          history: [
            {
              what: `Confirmed strategy v${s.strategyVersion} — the org reads from it`,
              when: s.strategyVersion === 5 ? 'today' : '14 May',
            },
            { what: 'Confirmed objectives v3', when: '14 May' },
            { what: 'Confirmed mission v1 and vision v1', when: 'March' },
            { what: 'Decided 3 proposals as Shaper', when: 'May' },
            { what: 'Founded River Commons', when: 'March' },
          ],
          trust: {
            label: 'Consistent',
            text: 'Every direction version she confirmed matches what the org then actually did — said and done line up. She rejects drafts as often as she confirms them, which is what keeps the record honest.',
          },
        };
      case 'eli':
        return {
          name: 'Eli',
          role: 'Investor · watches',
          since: 'since April',
          currencies: [],
          payments: [],
          history: [],
          trust: {
            label: 'Observer',
            text: 'No work history — investors watch, they do not hold. He sees everything on the Overview; the receipts are his due diligence.',
          },
        };
      default:
        return {
          name: s.profile.name || 'You',
          role: 'Member · new',
          since: 'joined today',
          currencies: [
            {
              symbol: 'RIVER',
              name: 'River Commons currency',
              amount: s.setup === 'done' ? '25' : '0',
              note:
                s.setup === 'done'
                  ? 'earned on your first ticket'
                  : 'earn it by holding work',
            },
          ],
          payments: [],
          history: [
            {
              what:
                s.setup === 'done'
                  ? 'Wrote the Saturday setup — done'
                  : s.setup === 'accepted'
                  ? 'Holds the setup ticket — in progress'
                  : s.setup === 'declined'
                  ? 'Declined the setup ticket, with a note'
                  : 'Offered the setup ticket by Sam',
              when: 'today',
            },
            { what: 'Joined River Commons', when: 'today' },
          ],
          trust: {
            label: 'New',
            text:
              s.setup === 'done'
                ? 'First ticket accepted and done, same week. One receipt is not a track record — but it is exactly how one starts.'
                : 'No history yet. Trust here is built from receipts — accept a ticket, finish it, and the record starts writing itself.',
          },
        };
    }
  })();

  return (
    <Workspace>
      <Page kicker="Who the org knows you as" title="My Profile">
        <div className="space-y-2.5">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar name={data.name} size="lg" />
              <div>
                <p className="text-[19px] font-semibold tracking-[-0.02em]">
                  {data.name}
                </p>
                <p className="text-[13px] text-sub">
                  {data.role} · {data.since}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5" delay={1}>
            <Kicker>What you hold</Kicker>
            {data.currencies.length === 0 ? (
              <p className="mt-2 text-[14px] text-sub">
                No org currency — watching, not holding.
              </p>
            ) : (
              <div className="mt-2">
                {data.currencies.map((c) => (
                  <CurrencyRow
                    key={c.symbol}
                    symbol={c.symbol}
                    name={c.name}
                    amount={c.amount}
                    note={c.note}
                  />
                ))}
              </div>
            )}
            <p className="mt-3 text-[12px] text-faint">
              Balances only ever change through proposals or earned work — every
              movement has a receipt.
            </p>
          </Card>

          <Card className="p-5" delay={2}>
            <Kicker>Paid to you — every one a proposal</Kicker>
            {data.payments.length === 0 ? (
              <p className="mt-2 text-[14px] text-sub">
                {data.role.startsWith('Shaper') ||
                data.role.startsWith('Investor')
                  ? 'Nothing — Shapers and investors are not paid for holding the org.'
                  : 'Nothing yet. Agree a sum with whoever holds the work above you, do the work, then ask your assistant to draft the proposal.'}
              </p>
            ) : (
              <div className="mt-2">
                {data.payments.map((p) => (
                  <button
                    key={p.what}
                    type="button"
                    disabled={!p.proposalId}
                    onClick={() => p.proposalId && s.openProposal(p.proposalId)}
                    className="flex w-full items-baseline justify-between gap-4 border-b border-hair py-2.5 text-left last:border-0 enabled:hover:text-ink"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px]">{p.what}</span>
                      <span className="block text-[12px] text-faint">
                        agreed {p.agreed} · passed {p.when}
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                      {p.amount}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              No sums live on tickets or projects. Pay is agreed in chat, the
              agent remembers the line, and it moves only when the Shapers pass
              the proposal.
            </p>
          </Card>

          <Card className="p-5" delay={3}>
            <Kicker>Work history</Kicker>
            {data.history.length === 0 ? (
              <p className="mt-2 text-[14px] text-sub">
                Nothing yet — no work held, no tickets taken.
              </p>
            ) : (
              <div className="mt-2">
                {data.history.map((h) => (
                  <div
                    key={h.what}
                    className="flex items-baseline justify-between gap-4 border-b border-hair py-2.5 last:border-0"
                  >
                    <span className="text-[14px]">{h.what}</span>
                    <span className="shrink-0 text-[12px] text-faint">
                      {h.when}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5" delay={3}>
            <div className="flex items-center justify-between">
              <Kicker>The agent’s read</Kicker>
              <Chip tone="agent">{data.trust.label}</Chip>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed">
              {data.trust.text}
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              Drawn from the ledger — what was accepted, done, declined, and
              when. Never from vibes, and anyone can check the receipts.
            </p>
          </Card>
        </div>
      </Page>
    </Workspace>
  );
}
