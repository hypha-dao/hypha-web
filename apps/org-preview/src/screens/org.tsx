'use client';

import { Avatar, Card, Chip, Kicker, cn } from '@/components/primitives';
import { Page, Workspace } from '@/components/workspace';
import { brief, energyOrg, projectsData, space, treasury } from '@/lib/data';
import { useStore, PAY_LEA_ID, PAY_ROGERIO_ID } from '@/lib/store';
import { HealthCard } from './work-bits';

type TlKind = 'past' | 'now' | 'future';
type TlItem = {
  when: string;
  title: string;
  /** two-or-three word version for the horizontal timeline */
  short: string;
  detail: string;
  kind: TlKind;
};

export function OrgPage() {
  const s = useStore();
  const v5 = s.briefVersion === 5;
  const leaPaid =
    s.proposals.find((p) => p.id === PAY_LEA_ID)?.state === 'passed';

  /* ---- highlights, past → today → planned ---- */
  const timeline: TlItem[] = [
    {
      when: 'March',
      title: 'Founded by Maya',
      short: 'Founded',
      detail: 'River Commons opens — brief v1 confirmed the same day.',
      kind: 'past',
    },
    {
      when: 'March',
      title: 'First Saturday stall',
      short: 'First stall',
      detail: 'Three growers selling. It has held every week since.',
      kind: 'past',
    },
    {
      when: '2 May',
      title: 'Sponsorship rejected',
      short: 'Sponsor: no',
      detail: '2,000 USDC from a drinks brand, declined — no brand money.',
      kind: 'past',
    },
    {
      when: '12 May',
      title: 'Stall becomes a project',
      short: 'Stall approved',
      detail: 'Shapers agreed — Sam as DRI.',
      kind: 'past',
    },
    {
      when: 'May',
      title: '4,200 USDC grant lands',
      short: 'Grant lands',
      detail: 'USDC into the treasury. It only moves through proposals.',
      kind: 'past',
    },
    ...(s.covers === 'done'
      ? [
          {
            when: 'today',
            title: 'Saturday covers secured',
            short: 'Covers secured',
            detail:
              'Lea found two neighbours — the stall no longer depends on one person.',
            kind: 'now' as const,
          },
        ]
      : []),
    ...(leaPaid
      ? [
          {
            when: 'today',
            title: 'Lea paid 150 USDC',
            short: 'Lea paid',
            detail: 'Both Shapers agreed. Receipt on the proposal.',
            kind: 'now' as const,
          },
        ]
      : []),
    ...(v5
      ? [
          {
            when: 'today',
            title: 'Brief v5 confirmed',
            short: 'Brief v5',
            detail: '“No brand money” is now in writing.',
            kind: 'now' as const,
          },
        ]
      : []),
    ...(s.weekday === 'held'
      ? [
          {
            when: 'today',
            title: 'Weekday hall approved',
            short: 'Hall approved',
            detail: 'Rafi holds it — he ran the market office six years.',
            kind: 'now' as const,
          },
        ]
      : []),
    {
      when: '1 Aug',
      title: 'Weekday hall opens',
      short: 'Hall opens',
      detail:
        s.weekday === 'held'
          ? 'Target — Rafi signs the licence, first weekday sale.'
          : 'Target — blocked until someone holds the project.',
      kind: 'future',
    },
    {
      when: s.review === 'extended' ? '1 Sep' : '1 Jun',
      title: 'Saturday stall review',
      short: 'Stall review',
      detail: 'Held vs planned — the story writes itself.',
      kind: 'future',
    },
    {
      when: 'October',
      title: 'Season closes',
      short: 'Season closes',
      detail: 'Every grower paid the same week they sold — all year.',
      kind: 'future',
    },
  ];

  /* ---- stats ---- */
  // 23 tickets done before the demo window starts; live actions add on top
  const ticketsDone =
    23 + 1 + (s.covers === 'done' ? 1 : 0) + (s.setup === 'done' ? 1 : 0);
  const members =
    space.members.length +
    (s.rafiJoined ? 1 : 0) +
    (s.youStage === 'member' ? 1 : 0);

  /* ---- everything below renders either org ---- */
  const isEnergy = s.org === 'energy';
  const orgSpace = isEnergy ? energyOrg.space : space;

  const briefView = isEnergy
    ? {
        chipTone: 'neutral' as const,
        chipText: `v${energyOrg.brief.version} · confirmed by ${energyOrg.brief.confirmedBy}, ${energyOrg.brief.confirmedOn}`,
        lines: energyOrg.brief.lines,
        added: null as string | null,
      }
    : {
        chipTone: (v5 ? 'agent' : 'neutral') as 'agent' | 'neutral',
        chipText: `v${s.briefVersion} · ${
          v5
            ? 'confirmed by Maya, today'
            : `confirmed by ${brief.confirmedBy}, ${brief.confirmedOn}`
        }`,
        lines: brief.lines,
        added: v5 ? brief.draft.added : null,
      };

  /* ---- energy: live additions to the static story ---- */
  const rogerioPaid =
    s.eProposals.find((p) => p.id === PAY_ROGERIO_ID)?.state === 'passed';
  const energyNow: TlItem[] = [
    ...(s.eMuni === 'done'
      ? [
          {
            when: 'today',
            title: 'Two municipalities onboarded',
            short: 'Municipalities',
            detail: 'Rogerio signed both councils — Iberia pilots grows.',
            kind: 'now' as const,
          },
        ]
      : []),
    ...(rogerioPaid
      ? [
          {
            when: 'today',
            title: 'Rogerio paid 1,500 EURC',
            short: 'Rogerio paid',
            detail: 'All three Shapers agreed. Receipt on the proposal.',
            kind: 'now' as const,
          },
        ]
      : []),
    ...(s.eCarbon === 'held'
      ? [
          {
            when: 'today',
            title: 'Carbon credits approved',
            short: 'Carbon: go',
            detail: 'Rowan holds it.',
            kind: 'now' as const,
          },
        ]
      : []),
  ];
  const energyFutureIdx = energyOrg.timeline.findIndex(
    (i) => i.kind === 'future',
  );
  const energyTimeline: TlItem[] = [
    ...energyOrg.timeline.slice(0, energyFutureIdx),
    ...energyNow,
    ...energyOrg.timeline.slice(energyFutureIdx),
  ];

  const tl = isEnergy ? energyTimeline : timeline;

  // same four numbers for every org — comparable at a glance
  const statsView = isEnergy
    ? [
        { n: '12', label: 'projects completed' },
        {
          n: String(
            148 +
              (s.eSummary === 'done' ? 1 : 0) +
              (s.eMuni === 'done' ? 1 : 0),
          ),
          label: 'tickets done',
        },
        { n: String(18 + (s.eJoin ? 1 : 0)), label: 'active contributors' },
        {
          n: rogerioPaid ? '87,500' : '86,000',
          label: 'EURC distributed',
        },
      ]
    : [
        { n: s.review === 'closed' ? '4' : '3', label: 'projects completed' },
        { n: String(ticketsDone), label: 'tickets done' },
        { n: String(members), label: 'active contributors' },
        { n: leaPaid ? '1,950' : '1,800', label: 'USDC distributed' },
      ];

  const healthView = isEnergy
    ? energyOrg.health
    : {
        pct: s.weekday === 'held' ? 88 : 80,
        label: 'Healthy',
        text:
          'The stall has held every Saturday since March, growers are paid the week they sell, and money has only ever moved through proposals. ' +
          (s.covers === 'done'
            ? 'The covers are found and confirmed — the stall no longer depends on one person. '
            : '') +
          (s.weekday === 'held'
            ? 'The one open objective — a weekday hall — now has Rafi holding it.'
            : 'The one thing keeping this short of the far right: the weekday hall has no DRI yet, and the licence is unsigned.'),
      };

  const treasuryView = isEnergy ? energyOrg.treasury : treasury;

  return (
    <Workspace>
      <Page kicker="Who we are" title="Organization overview" wide>
        <div className="space-y-2.5">
          {/* the brief — L3, versioned, human-confirmed */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <Kicker>The brief — what this org believes</Kicker>
              <Chip tone={briefView.chipTone}>{briefView.chipText}</Chip>
            </div>
            <div className="mt-3 space-y-1.5">
              {briefView.lines.map((line) => (
                <p key={line} className="text-[15px] leading-relaxed">
                  {line}
                </p>
              ))}
              {briefView.added && (
                <p className="rise text-[15px] font-medium leading-relaxed text-agent">
                  {briefView.added}
                </p>
              )}
            </div>
            <p className="mt-3 text-[12px] text-faint">
              Every version was confirmed by a Shaper. Everything the agent
              drafts reads from the latest one.
            </p>
          </Card>

          {/* highlights — horizontal timeline on desktop, vertical on mobile */}
          <Card className="p-5" delay={1}>
            <Kicker>
              Highlights — where this org has been, and where it is going
            </Kicker>
            <HorizontalTimeline items={tl} />
            <div className="md:hidden">
              <Timeline items={tl} />
            </div>
          </Card>

          <>
            <Card className="p-5" delay={2}>
              <Kicker>At a glance</Kicker>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {statsView.map((st) => (
                  <Stat key={st.label} n={st.n} label={st.label} />
                ))}
              </div>

              <div className="mt-5 grid gap-x-6 md:grid-cols-2">
                <div>
                  <p className="pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                    Shapers
                  </p>
                  <div className="flex flex-col gap-1">
                    {orgSpace.shapers.map((name) => (
                      <div
                        key={name}
                        className="flex items-center gap-2.5 rounded-xl px-2 py-2"
                      >
                        <Avatar name={name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">
                            {name}
                            {name === orgSpace.founder && ' · founder'}
                          </span>
                          <span className="block text-[12px] text-faint">
                            shapes projects and money —{' '}
                            {orgSpace.shapers.length > 2
                              ? 'all must agree'
                              : 'both must agree'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 md:mt-0">
                  <p className="pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                    Who holds a project
                  </p>
                  <div className="flex flex-col gap-1">
                    {isEnergy ? (
                      <>
                        {(
                          ['iberia', 'ems', 'islands', 'playbook'] as const
                        ).map((id) => (
                          <DriRow
                            key={id}
                            name={energyOrg.projects[id].dri ?? 'open'}
                            project={energyOrg.projects[id].title}
                            onOpen={() => s.openProject(id)}
                          />
                        ))}
                        {s.eCarbon === 'held' ? (
                          <DriRow
                            name="Rowan"
                            project={energyOrg.projects.carbon.title}
                            onOpen={() => s.openProject('carbon')}
                          />
                        ) : (
                          <OpenDriRow
                            project={energyOrg.projects.carbon.title}
                            onOpen={() => s.openProject('carbon')}
                          />
                        )}
                        <OpenDriRow
                          project={energyOrg.projects.hardware.title}
                          onOpen={() => s.openProject('hardware')}
                        />
                      </>
                    ) : (
                      <>
                        <DriRow
                          name="Sam"
                          project="Saturday stall"
                          onOpen={() => s.openProject('stall')}
                        />
                        <DriRow
                          name="Jun"
                          project={projectsData.growers.title}
                          onOpen={() => s.openProject('growers')}
                        />
                        <DriRow
                          name="Maya"
                          project={projectsData.currency.title}
                          onOpen={() => s.openProject('currency')}
                        />
                        {s.weekday === 'held' ? (
                          <DriRow
                            name="Rafi"
                            project="Weekday hall"
                            onOpen={() => s.openProject('weekday')}
                          />
                        ) : (
                          <OpenDriRow
                            project="Weekday hall"
                            onOpen={() => s.openProject('weekday')}
                          />
                        )}
                        <OpenDriRow
                          project={projectsData.harvest.title}
                          onOpen={() => s.openProject('harvest')}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[12px] leading-relaxed text-faint">
                Every number comes from the ledger — click through and check the
                receipts.
              </p>
            </Card>

            {/* org health — the agent's read on how the org is doing */}
            <HealthCard
              delay={3}
              health={healthView}
              kicker="Org health — the agent’s read"
              footnote="Read from the activity ledger and the brief — what was said vs what actually happened. Receipts, not vibes. Every project has its own bar on its page."
            />
          </>

          <Card className="p-5" delay={3}>
            <Kicker>Treasury</Kicker>
            <div className="mt-2">
              {treasuryView.crypto.map((c) => (
                <CurrencyRow
                  key={c.symbol}
                  symbol={c.symbol}
                  name={c.name}
                  amount={c.amount}
                />
              ))}
            </div>

            <p className="mt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
              Org currencies
            </p>
            <div>
              {treasuryView.orgCurrencies.map((c) => (
                <CurrencyRow
                  key={c.symbol}
                  symbol={c.symbol}
                  name={c.name}
                  amount={c.amount}
                  note={c.note}
                />
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              Nothing here moves without a proposal{' '}
              {isEnergy ? 'all three' : 'both'} Shapers agreed to — every
              movement is on the Proposals page.
            </p>
          </Card>
        </div>

        <p className="pt-5 text-[13px] leading-relaxed text-faint">
          Anyone can look — members, investors, newcomers. Ask the agent
          anything about this page and it answers with receipts.
        </p>
      </Page>
    </Workspace>
  );
}

/* ---------- horizontal timeline (desktop) ---------- */

function HorizontalTimeline({ items }: { items: TlItem[] }) {
  const futureIdx = items.findIndex((i) => i.kind === 'future');
  const n = items.length;
  // rail switches from solid to dashed halfway between the last real event
  // and the first planned one
  const splitPct =
    futureIdx <= 0 ? 0 : ((futureIdx - 0.5) / (n - 0.5)) * 100 + 100 / (2 * n);

  return (
    <div className="relative mt-3 hidden h-[230px] md:block">
      {/* rail */}
      <div className="absolute inset-x-2 top-1/2 h-[2px]">
        <span
          className="tl-rail-x absolute inset-y-0 left-0 rounded-full bg-ink/25"
          style={{ width: `${splitPct}%` }}
        />
        <span
          className="tl-fade absolute inset-y-0 right-0 border-t-2 border-dotted border-faint/70"
          style={{ left: `${splitPct}%` }}
        />
        {/* sits on the rail, between two dots — never in the label rows */}
        <span
          className="tl-fade absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-full border border-hair bg-paper px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-faint"
          style={{ left: `${splitPct}%` }}
        >
          planned
        </span>
      </div>

      <div className="flex h-full items-stretch px-2">
        {items.map((item, i) => {
          const above = i % 2 === 0;
          return (
            <div key={item.title} className="group relative flex-1">
              {/* dot on the rail */}
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <span
                  className={cn(
                    'tl-dot block rounded-full',
                    item.kind === 'past' && 'h-3 w-3 bg-ink',
                    item.kind === 'now' && 'tl-now h-3.5 w-3.5 bg-agent',
                    item.kind === 'future' &&
                      'h-3 w-3 border-[2px] border-dashed border-faint bg-paper',
                  )}
                  style={{ animationDelay: `${i * 110 + 250}ms` }}
                />
              </span>

              {/* connector from dot to label */}
              <span
                className={cn(
                  'tl-fade absolute left-1/2 w-px bg-hair',
                  above ? 'bottom-1/2 mb-2.5 h-4' : 'top-1/2 mt-2.5 h-4',
                )}
                style={{ animationDelay: `${i * 110 + 350}ms` }}
              />

              {/* label */}
              <div
                className={cn(
                  'tl-item absolute left-1/2 w-[110px] -translate-x-1/2 text-center',
                  above ? 'bottom-1/2 mb-7' : 'top-1/2 mt-7',
                )}
                style={{ animationDelay: `${i * 110 + 320}ms` }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
                  {item.when}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-[13px] font-semibold leading-tight tracking-[-0.01em]',
                    item.kind === 'future' && 'font-medium text-sub',
                    item.kind === 'now' && 'text-agent',
                  )}
                >
                  {item.short}
                </p>
              </div>

              {/* hover detail */}
              <div
                className={cn(
                  'pointer-events-none absolute left-1/2 z-10 w-56 -translate-x-1/2 rounded-xl border border-hair bg-paper p-3 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.10)] transition-all duration-200 group-hover:opacity-100',
                  above
                    ? 'top-1/2 mt-4 translate-y-1 group-hover:translate-y-0'
                    : 'bottom-1/2 mb-4 -translate-y-1 group-hover:translate-y-0',
                )}
              >
                <p className="text-[12px] font-semibold">{item.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-sub">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- vertical timeline (mobile) ---------- */

function Timeline({ items }: { items: TlItem[] }) {
  const firstFuture = items.findIndex((i) => i.kind === 'future');
  return (
    <div className="relative mt-4 pl-1">
      {/* the rail — solid through the past, drawn in on load */}
      <span className="tl-line absolute bottom-2 left-[8.5px] top-1 w-px bg-hair" />
      <div className="flex flex-col gap-4">
        {items.map((item, i) => (
          <div key={item.title}>
            {i === firstFuture && (
              <p
                className="tl-item mb-4 pl-8 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint"
                style={{ animationDelay: `${i * 90 + 150}ms` }}
              >
                Planned
              </p>
            )}
            <div
              className="tl-item relative flex gap-4 pl-8"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span
                className={cn(
                  'absolute left-0 top-[3px] flex h-[17px] w-[17px] items-center justify-center rounded-full bg-paper',
                )}
                style={{ animationDelay: `${i * 90 + 120}ms` }}
              >
                <span
                  className={cn(
                    'tl-dot h-[11px] w-[11px] rounded-full',
                    item.kind === 'past' && 'bg-ink',
                    item.kind === 'now' && 'tl-now bg-agent',
                    item.kind === 'future' &&
                      'border-[1.5px] border-dashed border-faint bg-paper',
                  )}
                  style={{ animationDelay: `${i * 90 + 120}ms` }}
                />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {item.when}
                  {item.kind === 'now' && (
                    <span className="ml-1.5 text-agent">· new</span>
                  )}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-[15px] font-semibold leading-snug tracking-[-0.015em]',
                    item.kind === 'future' && 'text-sub',
                  )}
                >
                  {item.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-sub">
                  {item.detail}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- stats ---------- */

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-xl bg-wash px-3 py-3">
      <p className="text-[22px] font-semibold leading-none tabular-nums tracking-[-0.02em]">
        {n}
      </p>
      <p className="mt-1.5 text-[12px] leading-tight text-sub">{label}</p>
    </div>
  );
}

function DriRow({
  name,
  project,
  onOpen,
}: {
  name: string;
  project: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-wash"
    >
      <Avatar name={name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">
          {name} · {project} →
        </span>
        <span className="block text-[12px] text-faint">DRI — holds it</span>
      </span>
    </button>
  );
}

function OpenDriRow({
  project,
  onOpen,
}: {
  project: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-wash"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-faint text-[13px] text-faint">
        ?
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-sub">
          {project} →
        </span>
        <span className="block text-[12px] text-faint">needs a DRI</span>
      </span>
    </button>
  );
}

/** brand glyph + colour per token; anything unknown falls back to a letter chip */
const coinStyles: Record<string, { glyph: string; bg: string; fg: string }> = {
  BTC: { glyph: '₿', bg: '#F7931A', fg: '#ffffff' },
  ETH: { glyph: 'Ξ', bg: '#627EEA', fg: '#ffffff' },
  USDC: { glyph: '$', bg: '#2775CA', fg: '#ffffff' },
  EURC: { glyph: '€', bg: '#2775CA', fg: '#ffffff' },
  RIVER: { glyph: '~', bg: '#0c7a68', fg: '#ffffff' },
  KWH: { glyph: '⚡', bg: '#e5a50a', fg: '#ffffff' },
};

export function CurrencyRow({
  symbol,
  name,
  amount,
  note,
}: {
  symbol: string;
  name: string;
  amount: string;
  note?: string;
}) {
  const coin = coinStyles[symbol];
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hair py-2.5 last:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {coin ? (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
            style={{ background: coin.bg, color: coin.fg }}
          >
            {coin.glyph}
          </span>
        ) : (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chip text-[11px] font-semibold">
            {symbol.slice(0, 2)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">
            {name} <span className="ml-1 text-[12px] text-faint">{symbol}</span>
          </p>
          {note && <p className="truncate text-[12px] text-sub">{note}</p>}
        </div>
      </div>
      <span className="shrink-0 text-[14px] font-semibold tabular-nums">
        {amount}
      </span>
    </div>
  );
}
