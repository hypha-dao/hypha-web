'use client';

import { useEffect, useMemo, useState } from 'react';
import { PersonLink } from '@/components/person';
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
import {
  energyOrg,
  proposalRecipient,
  space,
  type Proposal,
  type ProposalKind,
} from '@/lib/data';

type DecisionFilter = 'all' | ProposalKind;

const FILTERS: { id: DecisionFilter; label: string }[] = [
  { id: 'all', label: 'All decisions' },
  { id: 'project', label: 'Projects' },
  { id: 'money', label: 'Money' },
  { id: 'direction', label: 'Direction' },
];

function kindChip(p: Proposal): string {
  if (p.kind === 'money') return 'money';
  if (p.kind === 'project') return 'project';
  return p.artifact ?? 'direction';
}

function kindTone(p: Proposal): 'money' | 'agent' | 'neutral' {
  if (p.kind === 'money') return 'money';
  if (p.kind === 'direction') return 'neutral';
  return 'agent';
}

function shapersOf(energy: boolean): string[] {
  return energy ? energyOrg.space.shapers : space.shapers;
}

function whoAgreed(p: Proposal, shapers: string[]): string[] {
  return p.agreedBy ?? shapers.slice(0, p.yes);
}

function whoRejected(p: Proposal, shapers: string[]): string[] {
  return p.rejectedBy ?? shapers.slice(p.yes, p.yes + p.no);
}

function quorumLine(needed: number): string {
  if (needed > 2) return 'All three Shapers must agree';
  if (needed === 1) return 'A Shaper must agree';
  return 'Both Shapers must agree';
}

function decisionTitle(p: Proposal): string {
  return p.title.replace(/^Approve project:\s*/, '');
}

/** Session-stable deadline per decision — 3 days from first open, shown as remaining. */
const voteEndsAt = new Map<string, number>();
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

function endsAt(id: string): number {
  let t = voteEndsAt.get(id);
  if (!t) {
    t = Date.now() + THREE_DAYS;
    voteEndsAt.set(id, t);
  }
  return t;
}

function remainLabel(ms: number): string {
  if (ms <= 0) return '0 sec';
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (min) parts.push(`${min} min`);
  parts.push(`${s} sec`);
  return parts.join(' ');
}

function VoteUntil({ id }: { id: string }) {
  const until = useMemo(() => endsAt(id), [id]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <Row label="Voting until" value={remainLabel(until - now)} />;
}

export function Proposals() {
  const s = useStore();
  const [filter, setFilter] = useState<DecisionFilter>('all');
  const list = (s.org === 'energy' ? s.eProposals : s.proposals).filter((p) =>
    filter === 'all' ? true : p.kind === filter,
  );
  const open = list.filter((p) => p.state === 'open');
  const decided = list.filter((p) => p.state !== 'open');

  return (
    <Workspace>
      <Page
        kicker="Projects, money, and direction — Shapers decide"
        title="Decisions"
        wide="board"
      >
        <div className="mb-6 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                filter === f.id
                  ? 'bg-ink text-white'
                  : 'border border-hair bg-paper text-sub hover:border-faint hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {open.length === 0 && decided.length === 0 ? (
          <EmptyState
            title="Nothing here."
            sub="Three kinds land here: a project, money moving, or a change to mission, vision, objectives or strategy."
          />
        ) : (
          <div className="grid items-start gap-7 md:grid-cols-2 md:gap-6">
            <div className={cn(open.length === 0 && 'hidden md:block')}>
              <Kicker className="mb-2">Waiting on the Shapers</Kicker>
              <div className="space-y-2.5">
                {open.map((p) => (
                  <ProposalCard key={p.id} p={p} />
                ))}
              </div>
            </div>
            <div className={cn(decided.length === 0 && 'hidden md:block')}>
              <Kicker className="mb-2">Decided</Kicker>
              <div className="space-y-2.5">
                {decided.map((p) => (
                  <ProposalCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          </div>
        )}
      </Page>
    </Workspace>
  );
}

function VoteDots({ p, shapers }: { p: Proposal; shapers: string[] }) {
  const agreed = whoAgreed(p, shapers);
  const rejected = whoRejected(p, shapers);
  return (
    <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
      {shapers.map((name) => {
        const voted = agreed.includes(name) || rejected.includes(name);
        return (
          <span
            key={name}
            className={cn(
              'block h-2 w-2 shrink-0 rounded-full',
              voted ? 'bg-[#3d5c50]' : 'bg-[#c4c4b8]',
            )}
          />
        );
      })}
    </span>
  );
}

export function ProposalCard({ p }: { p: Proposal }) {
  const s = useStore();
  const shapers = shapersOf(s.org === 'energy').slice(0, p.needed);
  return (
    <Card className="p-5" onClick={() => s.openProposal(p.id)}>
      <div className="flex items-start justify-between gap-3">
        <Chip className="px-2 py-0.5 text-[10px]" tone={kindTone(p)}>
          {kindChip(p)}
        </Chip>
        {p.state === 'open' ? (
          <VoteDots p={p} shapers={shapers} />
        ) : (
          <span
            className={cn(
              'shrink-0 text-[12px] font-medium',
              p.state === 'passed' ? 'text-ink' : 'text-faint',
            )}
          >
            {p.state} · {p.decided}
          </span>
        )}
      </div>
      <p className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.015em]">
        {decisionTitle(p)}
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
  const shapers = shapersOf(energy).slice(0, p.needed);
  const agreed = whoAgreed(p, shapers);
  const rejected = whoRejected(p, shapers);
  const recipient = proposalRecipient(p);

  return (
    <Workspace>
      <Page kicker="Decision" wide>
        <button
          type="button"
          onClick={() => s.go('proposals')}
          className="rise mb-5 text-[13px] font-medium text-sub transition-colors hover:text-ink"
        >
          ← Decisions
        </button>

        <div className="rise mb-1 flex items-center gap-2">
          <Chip tone={kindTone(p)}>
            {p.kind === 'money'
              ? 'money movement'
              : p.kind === 'direction'
              ? `direction · ${p.artifact ?? 'direction'}`
              : 'project approval'}
          </Chip>
          <Chip>
            {p.state === 'open' ? 'open' : `${p.state} · ${p.decided}`}
          </Chip>
        </div>
        <h1
          className={cn(
            'rise text-[26px] font-semibold leading-tight tracking-[-0.03em]',
            p.state === 'open' || p.description ? 'mb-2' : 'mb-6',
          )}
        >
          {decisionTitle(p)}
        </h1>
        {p.state === 'open' && (
          <p
            className={cn(
              'rise-1 text-[14px] text-sub',
              p.description ? 'mb-2' : 'mb-6',
            )}
          >
            {p.sub}
          </p>
        )}
        {p.description && (
          <p className="rise-1 mb-6 max-w-xl text-[15px] leading-relaxed">
            {p.description}
          </p>
        )}

        <Card className="rise-1 p-5">
          <Kicker>Shaper approval</Kicker>
          <div className="mt-3">
            <Hairbar value={p.yes} max={p.needed} />
            <ul className="mt-3 space-y-1.5">
              {shapers.map((name) => {
                const said = agreed.includes(name)
                  ? 'agreed'
                  : rejected.includes(name)
                  ? 'rejected'
                  : 'needs to vote';
                return (
                  <li
                    key={name}
                    className="flex items-baseline justify-between text-[13px]"
                  >
                    <span className="text-ink">
                      <PersonLink name={name} />
                    </span>
                    <span
                      className={cn(
                        said === 'agreed' && 'font-medium text-ink',
                        said === 'rejected' && 'text-faint',
                        said === 'needs to vote' && 'text-sub',
                      )}
                    >
                      {said}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {canVote && (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => s.vote(p.id, 'yes')}>
                {p.kind === 'money'
                  ? 'Agree — pay it'
                  : p.kind === 'direction'
                  ? 'Agree — confirm it'
                  : 'Agree — approve it'}
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
        </Card>

        <div className="rise-2 mt-5">
          {recipient && (
            <Row label="Recipient" value={<PersonLink name={recipient} />} />
          )}
          <Row
            label="Opened by"
            value={p.openedBy ? <PersonLink name={p.openedBy} /> : 'a member'}
          />
          {p.ends && <Row label="Ends" value={p.ends} />}
          <Row label="Decides" value={quorumLine(p.needed)} />
          {p.state === 'open' && <VoteUntil id={p.id} />}
        </div>
      </Page>
    </Workspace>
  );
}
