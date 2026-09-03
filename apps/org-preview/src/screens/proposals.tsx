'use client';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Hairbar,
  Kicker,
  Row,
  cn,
} from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import { useStore } from '@/lib/store';
import { energyOrg, unitFor, type Proposal } from '@/lib/data';

export function Proposals() {
  const s = useStore();
  const list = s.org === 'energy' ? s.eProposals : s.proposals;
  const open = list.filter((p) => p.state === 'open');
  const decided = list.filter((p) => p.state !== 'open');

  return (
    <Workspace>
      <Page kicker="Money and projects — Shapers decide" title="Proposals">
        {open.length === 0 ? (
          <EmptyState
            title="Nothing to decide."
            sub="Only two things ever land here: money moving, or a project being approved. The agent drafts them from work that actually happened."
          />
        ) : (
          <div className="space-y-2.5">
            <Kicker>Waiting on the Shapers</Kicker>
            {open.map((p) => (
              <ProposalCard key={p.id} p={p} />
            ))}
          </div>
        )}

        <div className="mt-8 space-y-2.5">
          <Kicker>Decided</Kicker>
          {decided.map((p) => (
            <ProposalCard key={p.id} p={p} />
          ))}
        </div>

        <p className="pt-5 text-[13px] leading-relaxed text-faint">
          Two kinds only: <strong>money movements</strong> (“pay Lea for the
          covers”) and <strong>project approvals</strong> (“Weekday hall — Rafi
          as DRI”). This is the only place a sum lives. Pay is agreed in chat;
          the agent drafts from that line and the receipts, a person opens it,
          the Shapers agree — and everyone sees everything.
        </p>
      </Page>
    </Workspace>
  );
}

function ProposalCard({ p }: { p: Proposal }) {
  const s = useStore();
  return (
    <Card className="p-5" onClick={() => s.openProposal(p.id)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Chip
            className="mt-0.5 shrink-0"
            tone={p.kind === 'money' ? 'money' : 'agent'}
          >
            {p.kind === 'money' ? 'money' : 'project'}
          </Chip>
          <p className="text-[15px] font-semibold leading-snug tracking-[-0.015em]">
            {p.title}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 pt-0.5 text-[12px] font-medium',
            p.state === 'open'
              ? 'text-agent'
              : p.state === 'passed'
              ? 'text-ink'
              : 'text-faint',
          )}
        >
          {p.state === 'open'
            ? `${p.yes} of ${p.needed} Shapers agreed`
            : `${p.state} · ${p.decided}`}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
        {p.description ?? p.sub}
        {p.ends ? ` · ends ${p.ends}` : ''}
      </p>
    </Card>
  );
}

export function ProposalDetail() {
  const s = useStore();
  const energy = s.org === 'energy';
  const list = energy ? s.eProposals : s.proposals;
  const p = list.find((x) => x.id === s.proposalId);
  if (!p) return null;

  const myVote = (energy ? s.eVotes : s.myVotes)[p.id];
  // River Commons: Maya and Sam shape. Hypha Energy: Alex (the Shaper slot).
  const isShaper = energy
    ? s.persona === 'maya'
    : s.persona === 'maya' || s.persona === 'sam';
  const canVote = isShaper && p.state === 'open' && !myVote;
  const shaperNames = energy
    ? energyOrg.space.shapers.slice(0, -1).join(', ') +
      ' and ' +
      energyOrg.space.shapers.slice(-1)
    : 'Maya and Sam';

  return (
    <Workspace>
      <Page kicker="Proposal" wide>
        <button
          type="button"
          onClick={() => s.go('proposals')}
          className="rise mb-5 text-[13px] font-medium text-sub transition-colors hover:text-ink"
        >
          ← Proposals
        </button>

        <div className="rise mb-1 flex items-center gap-2">
          <Chip tone={p.kind === 'money' ? 'money' : 'agent'}>
            {p.kind === 'money' ? 'money movement' : 'project approval'}
          </Chip>
          <Chip>
            {p.state === 'open' ? 'open' : `${p.state} · ${p.decided}`}
          </Chip>
        </div>
        <h1 className="rise mb-2 text-[26px] font-semibold leading-tight tracking-[-0.03em]">
          {p.title}
        </h1>
        <p
          className={cn(
            'rise-1 text-[14px] text-sub',
            p.description ? 'mb-2' : 'mb-6',
          )}
        >
          {p.sub}
        </p>
        {p.description && (
          <p className="rise-1 mb-6 max-w-xl text-[15px] leading-relaxed">
            {p.description}
          </p>
        )}

        <Card className="rise-1 p-5">
          <div className="flex items-baseline justify-between">
            <Kicker>Shaper approval</Kicker>
            <span className="text-[12px] text-faint">
              {p.needed > 2
                ? 'all three Shapers must agree'
                : 'both Shapers must agree'}
            </span>
          </div>
          <div className="mt-3">
            <Hairbar value={p.yes} max={p.needed} />
            <div className="mt-2 flex justify-between text-[13px] text-sub">
              <span>
                {p.yes} agreed{p.no > 0 && ` · ${p.no} rejected`}
              </span>
              <span>
                {p.state === 'open' ? `${shaperNames} decide` : p.state}
              </span>
            </div>
          </div>

          {canVote && (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => s.vote(p.id, 'yes')}>
                {p.kind === 'money' ? 'Agree — pay it' : 'Agree — approve it'}
              </Button>
              <Button variant="outline" onClick={() => s.vote(p.id, 'no')}>
                Reject
              </Button>
            </div>
          )}
          {myVote && p.state === 'open' && (
            <p className="mt-4 text-[14px] text-sub">
              You {myVote === 'yes' ? 'agreed' : 'rejected'}. Waiting on the
              other Shaper{energy ? 's' : ''}…
            </p>
          )}
          {p.state === 'passed' && (
            <p className={cn('mt-4 text-[14px] font-medium text-ink', 'rise')}>
              Agreed by {p.needed > 2 ? 'all three' : 'both'} Shapers.{' '}
              {p.kind === 'money'
                ? `${(p.amount ?? 0).toLocaleString()} ${unitFor(
                    s.org,
                  )} moves from the treasury.`
                : 'The project is live — the DRI holds it.'}
            </p>
          )}
          {p.state === 'rejected' && (
            <p className="mt-4 text-[14px] text-sub">
              Rejected — and remembered. The brief says why.
            </p>
          )}
          {!isShaper && p.state === 'open' && (
            <p className="mt-4 text-[13px] text-faint">
              Shapers decide this one. You see the draft and the outcome.
            </p>
          )}
        </Card>

        <div className="rise-2 mt-5">
          <Row label="Opened by" value={p.openedBy ?? 'a member'} />
          {p.ends && <Row label="Ends" value={p.ends} />}
          <Row
            label="Decides"
            value={`the Shapers — ${shaperNames}, ${
              energy ? 'all three' : 'both'
            }`}
          />
        </div>
      </Page>
    </Workspace>
  );
}
