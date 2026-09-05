'use client';

import { useState } from 'react';
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
  unitFor,
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

        {open.length > 0 && (
          <div className="space-y-2.5">
            <Kicker>Waiting on the Shapers</Kicker>
            {open.map((p) => (
              <ProposalCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {open.length === 0 && decided.length === 0 && (
          <EmptyState
            title="Nothing here."
            sub="Three kinds land here: a project, money moving, or a change to mission, vision, objectives or strategy."
          />
        )}

        {decided.length > 0 && (
          <div className="mt-8 space-y-2.5">
            <Kicker>Decided</Kicker>
            {decided.map((p) => (
              <ProposalCard key={p.id} p={p} />
            ))}
          </div>
        )}
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
          <Chip className="mt-0.5 shrink-0" tone={kindTone(p)}>
            {kindChip(p)}
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
          {p.state === 'passed' && (
            <p className={cn('mt-4 text-[14px] font-medium text-ink', 'rise')}>
              Agreed by {p.needed > 2 ? 'all three' : 'both'} Shapers.{' '}
              {p.kind === 'money'
                ? `${(p.amount ?? 0).toLocaleString()} ${unitFor(
                    s.org,
                  )} moves from the treasury.`
                : p.kind === 'direction'
                ? 'The new version is live. Everything the agent drafts now reads from it.'
                : 'The project is live — the DRI holds it.'}
            </p>
          )}
          {p.state === 'rejected' && (
            <p className="mt-4 text-[14px] text-sub">
              Rejected — and remembered. The strategy says why.
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
