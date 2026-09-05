'use client';

import { DIRECTION_LABEL, DirectionMark } from '@/components/direction-mark';
import { Button, Card, Chip, Kicker, cn } from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import {
  direction,
  energyOrg,
  strategyDraft,
  type DirectionHistory,
  type DirectionLine,
  type Proof,
  type ProjectId,
} from '@/lib/data';
import { useStore } from '@/lib/store';

/**
 * One direction artifact on its own page: the full text, every confirmed
 * version, and — line by line — the ledger facts that bear it out. Nothing
 * here is a claim without a receipt to click.
 */
export function DirectionDetail() {
  const s = useStore();
  const isEnergy = s.org === 'energy';
  const dir = isEnergy ? energyOrg.direction : direction;
  const kind = s.directionKind;
  const label = DIRECTION_LABEL[kind];
  const art = dir[kind];

  // River's strategy is the one artifact that moves in the demo (v4 → v5)
  const v5 = !isEnergy && kind === 'strategy' && s.strategyVersion === 5;
  const meta = v5
    ? { version: 5, confirmedBy: 'Maya', confirmedOn: 'today' }
    : art;

  const statement =
    kind === 'mission' || kind === 'vision' ? dir[kind].text : null;

  const lines: DirectionLine[] | null =
    kind === 'objectives'
      ? liveObjectives(dir.objectives.items, s, isEnergy)
      : kind === 'strategy'
      ? v5
        ? [...dir.strategy.lines, strategyDraft.line]
        : dir.strategy.lines
      : null;

  const proofs: Proof[] | null =
    kind === 'mission' || kind === 'vision' ? dir[kind].proofs : null;

  const history: DirectionHistory[] = v5
    ? [...art.history, strategyDraft.history]
    : art.history;

  // the 'maya' slot is the Shaper viewpoint in both orgs (Alex in Energy)
  const isShaper = s.persona === 'maya';
  const shaperRoom = isEnergy ? s.agentKey : 'shapers';

  return (
    <Workspace>
      <Page kicker="Direction" wide>
        <button
          type="button"
          onClick={() => s.go('org')}
          className="rise mb-5 text-[13px] font-medium text-sub transition-colors hover:text-ink"
        >
          ← Overview
        </button>

        <div className="rise mb-1 flex items-center gap-2">
          <Chip tone={v5 ? 'agent' : 'neutral'}>
            v{meta.version} · confirmed by {meta.confirmedBy},{' '}
            {meta.confirmedOn}
          </Chip>
          {v5 && <Chip tone="agent">changed today</Chip>}
        </div>
        <div className="rise mb-2 flex items-center gap-3">
          <DirectionMark kind={kind} live={v5} size={22} />
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">
            {label.title}
            <span className="text-faint"> — {label.question}</span>
          </h1>
        </div>

        {statement && (
          <p className="rise-1 mt-4 max-w-2xl text-[21px] font-medium leading-snug tracking-[-0.02em] text-ink">
            {statement}
          </p>
        )}
        <div className="rise-1 mt-4 max-w-2xl space-y-3">
          {art.body.map((para) => (
            <p key={para} className="text-[15px] leading-relaxed text-sub">
              {para}
            </p>
          ))}
        </div>

        {/* mission / vision — one list of proofs for the whole statement */}
        {proofs && (
          <Card className="rise-1 mt-6 p-5">
            <Kicker>
              How we are achieving the{' '}
              {kind === 'mission' ? 'mission' : 'vision'}
            </Kicker>
            <ProofList proofs={proofs} />
          </Card>
        )}

        {/* objectives / strategy — proofs sit under each line */}
        {lines && (
          <div className="mt-6 space-y-2.5">
            <Kicker className="px-1">
              {kind === 'objectives'
                ? 'Each objective, and what backs it'
                : 'Each bet, and what backs it'}
            </Kicker>
            {lines.map((line, i) => {
              const isNew = v5 && i === lines.length - 1;
              return (
                <Card
                  key={line.text}
                  className={cn('p-5', isNew && 'dir-card-live')}
                  delay={i < 3 ? ((i + 1) as 1 | 2 | 3) : 3}
                >
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        'mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full',
                        kind === 'objectives' &&
                          'border-[1.5px] border-ink bg-paper',
                        kind === 'strategy' && !isNew && 'bg-ink',
                        kind === 'strategy' && isNew && 'bg-agent',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-[16px] font-medium leading-snug tracking-[-0.01em]',
                          isNew && 'text-agent',
                        )}
                      >
                        {line.text}
                      </p>
                      {line.read && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-agent">
                          <span className="font-semibold">
                            The agent’s read ·{' '}
                          </span>
                          {line.read}
                        </p>
                      )}
                      <ProofList proofs={line.proofs} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* every version, latest first */}
        <Card className="rise-2 mt-6 p-5">
          <Kicker>Versions — every one confirmed by a Shaper</Kicker>
          <ol className="mt-3">
            {[...history].reverse().map((h, i) => (
              <li
                key={h.version}
                className={cn(
                  'flex gap-4 border-b border-hair py-2.5 last:border-0',
                  i === 0 ? 'text-ink' : 'text-sub',
                )}
              >
                <span className="w-9 shrink-0 text-[13px] font-semibold tabular-nums">
                  v{h.version}
                </span>
                <span className="w-24 shrink-0 text-[13px] text-faint">
                  {h.confirmedOn}
                </span>
                <span className="min-w-0 flex-1 text-[14px] leading-relaxed">
                  {h.change}
                  <span className="text-faint"> — {h.confirmedBy}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>

        {isShaper && (
          <Card className="rise-2 mt-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-medium">Want to change it?</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-sub">
                  Say it in plain words. The agent drafts v{meta.version + 1};
                  you confirm — nothing changes until you do.
                </p>
              </div>
              <Button
                variant="soft"
                size="sm"
                onClick={() => s.openThread(shaperRoom)}
              >
                {isEnergy ? 'Open Personal Assistant' : 'Open Shapers room'} →
              </Button>
            </div>
          </Card>
        )}

        <p className="pt-5 text-[13px] leading-relaxed text-faint">
          Every line on this page is a belief the Shapers confirmed. Every proof
          is a fact from the ledger — a proposal that passed, a project that
          moved, a line someone said in a room. Click through and check the
          receipt. The agent drafts; it never confirms.
        </p>
      </Page>
    </Workspace>
  );
}

/* ---------- live overlay: what happened in this session, on top of the story ---------- */

function liveObjectives(
  items: DirectionLine[],
  s: ReturnType<typeof useStore>,
  isEnergy: boolean,
): DirectionLine[] {
  return items.map((item, i) => {
    if (!isEnergy) {
      // 0 — Saturday stall; 1 — weekday hall; 2 — growers
      if (i === 0 && s.covers === 'done') {
        return {
          ...item,
          proofs: [
            ...item.proofs,
            {
              when: 'today',
              what: 'Lea found two neighbours to cover Saturdays — the stall no longer depends on one person.',
              go: 'thread',
              id: 'saturday',
            },
          ],
        };
      }
      if (i === 1) {
        const held = s.weekday === 'held';
        return {
          ...item,
          read: held
            ? 'On track — Rafi holds it; the licence is next.'
            : 'At risk — no one holds it yet, and the licence is unsigned.',
          proofs: held
            ? [
                ...item.proofs,
                {
                  when: 'today',
                  what: 'Weekday hall approved — Rafi holds it. He ran the market office six years.',
                  go: 'project',
                  id: 'weekday',
                },
              ]
            : item.proofs,
        };
      }
      return item;
    }
    // energy: 0 — Iberia; 2 — playbook
    if (i === 0) {
      const done = s.eMuni === 'done';
      return {
        ...item,
        read: done
          ? '4 of 6 — two councils signed today; the EECF money is waiting on the Shapers.'
          : '2 of 6 signed; the EECF money is waiting on the Shapers.',
        proofs: done
          ? [
              ...item.proofs,
              {
                when: 'today',
                what: 'Rogerio signed two municipalities.',
                go: 'project',
                id: 'iberia',
              },
            ]
          : item.proofs,
      };
    }
    if (i === 2) {
      const done = s.eSummary === 'done';
      return {
        ...item,
        read: done
          ? 'One of three — the Ameland summary landed today; Portuguese next.'
          : 'One of three underway — the Ameland summary is being written.',
        proofs: done
          ? [
              ...item.proofs,
              {
                when: 'today',
                what: 'Ameland summary for new communities written.',
                go: 'project',
                id: 'playbook',
              },
            ]
          : item.proofs,
      };
    }
    return item;
  });
}

/* ---------- proofs ---------- */

function ProofList({ proofs }: { proofs: Proof[] }) {
  const s = useStore();
  if (proofs.length === 0) return null;
  const open = (p: Proof) => {
    if (!p.go || !p.id) return;
    if (p.go === 'thread') s.openThread(p.id);
    else if (p.go === 'proposal') s.openProposal(p.id);
    else s.openProject(p.id as ProjectId);
  };
  return (
    <ul className="mt-3">
      {proofs.map((p) => (
        <li
          key={p.when + p.what}
          className="flex items-baseline gap-3 border-b border-hair py-2 last:border-0"
        >
          <span className="w-20 shrink-0 text-[12px] tabular-nums text-faint">
            {p.when}
          </span>
          <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink">
            {p.what}
          </span>
          {p.go && p.id && (
            <button
              type="button"
              onClick={() => open(p)}
              className="shrink-0 rounded-full border border-hair bg-paper px-2.5 py-1 text-[12px] font-medium text-sub transition-colors hover:border-agent hover:text-agent"
            >
              {p.go === 'proposal'
                ? 'proposal'
                : p.go === 'project'
                ? 'project'
                : 'chat'}{' '}
              →
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
