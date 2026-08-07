'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { cn } from '../_lib/cn';

import type {
  CampaignProjectDto,
  ContributionDto,
  CycleDto,
  PayoutRowDto,
} from '@rs/lib/campaign-types';

import {
  Field,
  Pill,
  RsButton,
  SectionHeading,
  ShareBar,
  inputClass,
} from '../_components/ui';
import { api } from '../_lib/api';
import {
  GROUP_LABELS,
  formatAud,
  formatNumber,
  useCampaign,
  type ProjectGroup,
} from '../_lib/campaign-store';

type Tab = 'projects' | 'cycle' | 'contributions' | 'distribution' | 'status';

const TABS: { id: Tab; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'contributions', label: 'Contributions' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'status', label: 'Status' },
];

export default function RegenSydneyAdminPage() {
  const { user, hydrated, signIn } = useCampaign();
  const [tab, setTab] = useState<Tab>('projects');

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <p className="rs-ui text-[var(--rs-ink-faint)]">Checking access…</p>
      </main>
    );
  }

  if (!user?.isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md text-center">
          <h1 className="rs-heading text-3xl">Admins only</h1>
          <p className="rs-prose mt-4 text-[var(--rs-ink-soft)]">
            This area is limited to the Regen Sydney team. Access is checked
            server-side against the email on your Hypha login, so signing in
            with a different account will not open it.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            {user ? null : <RsButton onClick={signIn}>Sign in</RsButton>}
            <Link href="/">
              <RsButton variant="ghost">Back to the campaign</RsButton>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--rs-sand)] px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="rs-eyebrow rs-focus inline-flex items-center gap-2 rounded text-[var(--rs-ink-faint)] transition-colors hover:text-[var(--rs-ink)]"
        >
          <ArrowLeft size={14} /> Back to the campaign
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Regen Sydney" title="Campaign admin" />
          <Pill tone="outline">
            {user.name} &middot; {user.email}
          </Pill>
        </div>

        <nav className="mt-10 flex flex-wrap gap-2 border-b border-[var(--rs-line)] pb-px">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
              className={cn(
                'rs-eyebrow rs-focus rounded-t-lg px-4 py-3 transition-colors',
                tab === item.id
                  ? 'bg-[var(--rs-white)] text-[var(--rs-ink)]'
                  : 'text-[var(--rs-ink-faint)] hover:text-[var(--rs-ink)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="rounded-b-3xl rounded-tr-3xl bg-[var(--rs-white)] p-6 sm:p-8">
          {tab === 'projects' ? <ProjectsTab /> : null}
          {tab === 'cycle' ? <CycleTab /> : null}
          {tab === 'contributions' ? <ContributionsTab /> : null}
          {tab === 'distribution' ? <DistributionTab /> : null}
          {tab === 'status' ? <StatusTab /> : null}
        </div>
      </div>
    </main>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rs-ui mt-4 flex items-start gap-2 rounded-xl bg-[var(--rs-peach-soft)] p-3 text-sm text-[var(--rs-clay)]">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

function ProjectsTab() {
  const { getToken, refresh } = useCampaign();
  const [projects, setProjects] = useState<CampaignProjectDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [program, setProgram] = useState('');
  const [group, setGroup] = useState<ProjectGroup>('initiative');
  const [summary, setSummary] = useState('');
  const [team, setTeam] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [payoutAddress, setPayoutAddress] = useState('');

  const load = useCallback(async () => {
    try {
      setProjects(
        await api.get<CampaignProjectDto[]>('/api/admin/projects', getToken),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load');
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const canSubmit = title.trim().length > 2 && summary.trim().length > 10;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = () =>
    run(async () => {
      await api.post(
        '/api/admin/projects',
        {
          title,
          program: program || undefined,
          group,
          summary,
          team: team || undefined,
          videoUrl: videoUrl || null,
          imageUrl: imageUrl || null,
          payoutAddress: payoutAddress || null,
        },
        getToken,
      );
      setTitle('');
      setProgram('');
      setSummary('');
      setTeam('');
      setVideoUrl('');
      setImageUrl('');
      setPayoutAddress('');
    });

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <h2 className="rs-heading text-xl">Ballot projects</h2>
        <p className="rs-prose mt-2 text-sm text-[var(--rs-ink-soft)]">
          Hiding a project takes it off the current ballot but keeps its
          history. Deleting is permanent and clears any votes cast for it.
        </p>
        <ErrorNote message={error} />

        <ul className="mt-6 divide-y divide-[var(--rs-line)]">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-start justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="rs-heading text-sm leading-snug">
                  {project.title}
                  {project.active ? null : (
                    <span className="rs-ui ml-2 text-xs text-[var(--rs-ink-faint)]">
                      (hidden)
                    </span>
                  )}
                </p>
                <p className="rs-ui mt-1 text-xs text-[var(--rs-ink-faint)]">
                  {project.program} &middot; {GROUP_LABELS[project.group]}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api.patch(
                        `/api/admin/projects/${project.id}`,
                        { active: !project.active },
                        getToken,
                      ),
                    )
                  }
                  aria-label={project.active ? 'Hide project' : 'Show project'}
                  className="rs-focus rounded-full p-2 text-[var(--rs-ink-faint)] transition-colors hover:text-[var(--rs-ink)] disabled:opacity-40"
                >
                  {project.active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete "${project.title}"? Any votes for it are removed too.`,
                      )
                    ) {
                      return;
                    }
                    void run(() =>
                      api.delete(`/api/admin/projects/${project.id}`, getToken),
                    );
                  }}
                  aria-label="Remove project"
                  className="rs-focus rounded-full p-2 text-[var(--rs-ink-faint)] transition-colors hover:text-[var(--rs-clay)] disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
          {projects.length === 0 ? (
            <li className="rs-ui py-6 text-sm text-[var(--rs-ink-faint)]">
              No projects yet. Add the first one on the right.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-2xl bg-[var(--rs-cream)] p-6">
        <h2 className="rs-heading text-lg">Add a project</h2>
        <div className="mt-5 space-y-4">
          <Field label="Title">
            <input
              className={inputClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Regen Waverley phase two"
            />
          </Field>
          <Field label="Program area">
            <input
              className={inputClass}
              value={program}
              onChange={(event) => setProgram(event.target.value)}
              placeholder="Civic Neighbourhoods"
            />
          </Field>
          <Field label="Group">
            <select
              className={inputClass}
              value={group}
              onChange={(event) => setGroup(event.target.value as ProjectGroup)}
            >
              {(Object.keys(GROUP_LABELS) as ProjectGroup[]).map((key) => (
                <option key={key} value={key}>
                  {GROUP_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Summary">
            <textarea
              className={cn(inputClass, 'min-h-24 resize-y')}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="What the project does and what the money would fund."
            />
          </Field>
          <Field label="Team or partners">
            <input
              className={inputClass}
              value={team}
              onChange={(event) => setTeam(event.target.value)}
              placeholder="Regen Sydney with…"
            />
          </Field>
          <Field label="Video link" hint="YouTube, Vimeo or Loom">
            <input
              className={inputClass}
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://vimeo.com/…"
            />
          </Field>
          <Field label="Card image" hint="Path under /media or a full URL">
            <input
              className={inputClass}
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="/media/community.webp"
            />
          </Field>
          <Field
            label="Payout details"
            hint="Where the grant is sent. Distribution is manual."
          >
            <input
              className={inputClass}
              value={payoutAddress}
              onChange={(event) => setPayoutAddress(event.target.value)}
              placeholder="Bank account or wallet"
            />
          </Field>
          <RsButton
            onClick={handleAdd}
            disabled={!canSubmit || busy}
            className="w-full"
          >
            <Plus size={14} /> Add to ballot
          </RsButton>
        </div>
      </div>
    </div>
  );
}

function CycleTab() {
  const { getToken, refresh, totalPotAud } = useCampaign();
  const [cycle, setCycle] = useState<CycleDto | null>(null);
  const [totals, setTotals] = useState<{
    communityAud: number;
    contributors: number;
  } | null>(null);
  const [duration, setDuration] = useState(21);
  const [match, setMatch] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<{
      cycle: CycleDto | null;
      totals: { communityAud: number; contributors: number } | null;
    }>('/api/admin/cycle', getToken);
    setCycle(data.cycle);
    setTotals(data.totals);
    if (data.cycle) {
      setDuration(data.cycle.durationDays);
      setMatch(data.cycle.matchMultiplier);
    }
  }, [getToken]);

  useEffect(() => {
    void load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not load'),
    );
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <h2 className="rs-heading text-xl">Current round</h2>
        <ErrorNote message={error} />
        {cycle ? (
          <dl className="mt-6 space-y-4">
            {[
              ['Round', `#${cycle.number} — ${cycle.name}`],
              ['Status', cycle.status],
              ['Closes', cycle.endsAt.slice(0, 10)],
              ['Community raised', formatAud(totals?.communityAud ?? 0)],
              ['Total pot with match', formatAud(totalPotAud)],
              ['Contributors', formatNumber(totals?.contributors ?? 0)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between border-b border-[var(--rs-line)] pb-3"
              >
                <dt className="rs-ui text-sm text-[var(--rs-ink-soft)]">
                  {label}
                </dt>
                <dd className="rs-heading rs-tabular text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rs-prose mt-6 text-sm text-[var(--rs-ink-soft)]">
            No round has been opened yet. Starting one below opens round 1.
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-[var(--rs-cream)] p-6">
        <h2 className="rs-heading text-lg">Settings</h2>
        <div className="mt-5 space-y-4">
          <Field
            label="Voting cycle length"
            hint="Saved against this round and inherited by the next."
          >
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={365}
                className={inputClass}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
              <span className="rs-ui shrink-0 text-sm text-[var(--rs-ink-soft)]">
                days
              </span>
            </div>
          </Field>
          <Field
            label="Philanthropic match"
            hint="1 means every community dollar is matched by one more."
          >
            <input
              type="number"
              min={0}
              step={0.1}
              className={inputClass}
              value={match}
              onChange={(event) => setMatch(Number(event.target.value))}
            />
          </Field>
          <RsButton
            size="sm"
            disabled={busy || !cycle}
            onClick={() =>
              run(() =>
                api.patch(
                  '/api/admin/cycle',
                  { durationDays: duration, matchMultiplier: match },
                  getToken,
                ),
              )
            }
          >
            Save settings
          </RsButton>
        </div>

        <div className="mt-8 border-t border-[var(--rs-line)] pt-6">
          <p className="rs-prose text-sm text-[var(--rs-ink-soft)]">
            Starting a new round closes voting on the current one, freezes the
            tally and produces the allocation worksheet.
          </p>
          {confirming ? (
            <div className="mt-4 flex gap-2">
              <RsButton
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api.post(
                      '/api/admin/cycle/close',
                      { durationDays: duration },
                      getToken,
                    );
                    setConfirming(false);
                  })
                }
              >
                <Check size={14} /> Yes, start round {(cycle?.number ?? 0) + 1}
              </RsButton>
              <RsButton
                size="sm"
                variant="quiet"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </RsButton>
            </div>
          ) : (
            <RsButton
              variant="secondary"
              className="mt-4"
              onClick={() => setConfirming(true)}
            >
              <RefreshCw size={14} /> Start a new round
            </RsButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ContributionsTab() {
  const { getToken } = useCampaign();
  const [rows, setRows] = useState<ContributionDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ContributionDto[]>('/api/admin/contributions', getToken)
      .then(setRows)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Could not load'),
      );
  }, [getToken]);

  const settled = rows.filter(
    (row) => row.kind === 'contribution' && row.status === 'settled',
  );
  const raised = settled.reduce((sum, row) => sum + row.amountAud, 0);
  const contributors = new Set(settled.map((row) => row.email)).size;

  return (
    <div>
      <h2 className="rs-heading text-xl">Grants ledger</h2>
      <p className="rs-prose mt-2 text-sm text-[var(--rs-ink-soft)]">
        Every joining bonus and settled contribution, with the state of its
        on-chain mint. The ledger is what voting power is read from, so a mint
        that has not landed yet does not hold anyone up.
      </p>
      <ErrorNote message={error} />

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--rs-line)]">
              {['Member', 'Date', 'Kind', 'Amount', 'RSUT', 'Mint'].map(
                (heading) => (
                  <th
                    key={heading}
                    className="rs-eyebrow py-3 text-[var(--rs-ink-faint)]"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--rs-line)]">
                <td className="py-3.5">
                  <span className="rs-heading block text-sm">{row.who}</span>
                  <span className="rs-ui text-xs text-[var(--rs-ink-faint)]">
                    {row.email}
                  </span>
                  {row.hypha ? (
                    <a
                      href={row.hypha.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rs-ui mt-0.5 block text-xs text-[var(--rs-ink-faint)] underline"
                    >
                      Hypha profile
                    </a>
                  ) : null}
                </td>
                <td className="rs-ui rs-tabular py-3.5 text-sm text-[var(--rs-ink-soft)]">
                  {row.at.slice(0, 10)}
                </td>
                <td className="rs-ui py-3.5 text-sm text-[var(--rs-ink-soft)]">
                  {row.kind}
                </td>
                <td className="rs-heading rs-tabular py-3.5 text-sm">
                  {row.amountAud > 0 ? formatAud(row.amountAud) : '—'}
                </td>
                <td className="rs-ui rs-tabular py-3.5 text-sm text-[var(--rs-ink-soft)]">
                  {formatNumber(row.rsut)}
                </td>
                <td className="py-3.5">
                  <Pill
                    tone={row.mintStatus === 'confirmed' ? 'aqua' : 'outline'}
                  >
                    {row.mintStatus}
                  </Pill>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="rs-ui py-6 text-sm text-[var(--rs-ink-faint)]"
                >
                  Nothing granted yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="rs-ui mt-6 text-sm text-[var(--rs-ink-soft)]">
        <span className="rs-heading rs-tabular mr-1.5 text-base">
          {formatAud(raised)}
        </span>
        raised from {formatNumber(contributors)} contributors.
      </p>
    </div>
  );
}

function DistributionTab() {
  const { getToken } = useCampaign();
  const [rows, setRows] = useState<PayoutRowDto[]>([]);
  const [frozen, setFrozen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<{ frozen: boolean; rows: PayoutRowDto[] }>(
      '/api/admin/distribution',
      getToken,
    );
    setRows(data.rows);
    setFrozen(data.frozen);
  }, [getToken]);

  useEffect(() => {
    void load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not load'),
    );
  }, [load]);

  const total = rows.reduce((sum, row) => sum + row.amountAud, 0);
  const paidTotal = rows
    .filter((row) => row.paidAt)
    .reduce((sum, row) => sum + row.amountAud, 0);

  const markPaid = async (projectId: number, paid: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/admin/distribution', { projectId, paid }, getToken);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="rs-heading text-xl">Allocation worksheet</h2>
      <p className="rs-prose mt-2 max-w-2xl text-sm text-[var(--rs-ink-soft)]">
        {frozen
          ? 'This round is closed and these amounts are final. Funds land in the admin account and are transferred to each project manually — tick each one off as you pay it.'
          : 'This round is still open, so these amounts are a live projection and will keep moving. Close the round to freeze them before paying anyone.'}
      </p>
      <ErrorNote message={error} />

      <div className="mt-6 space-y-4">
        {rows.map((row) => {
          const paid = Boolean(row.paidAt);
          return (
            <div
              key={row.projectId}
              className={cn(
                'rounded-2xl border p-5 transition-colors',
                paid
                  ? 'border-[var(--rs-aqua)] bg-[var(--rs-aqua-soft)]'
                  : 'border-[var(--rs-line)]',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="rs-heading text-sm">{row.title}</p>
                  <p className="rs-ui mt-1 text-xs text-[var(--rs-ink-faint)]">
                    {formatNumber(row.votes)} votes &middot;{' '}
                    {(row.share * 100).toFixed(1)}% of the pot
                    {row.payoutAddress ? ` · ${row.payoutAddress}` : ''}
                  </p>
                  <div className="mt-3 max-w-sm">
                    <ShareBar share={row.share} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="rs-heading rs-tabular text-lg">
                    {formatAud(row.amountAud)}
                  </span>
                  <RsButton
                    size="sm"
                    variant={paid ? 'quiet' : 'ghost'}
                    disabled={!frozen || busy}
                    onClick={() => markPaid(row.projectId, !paid)}
                  >
                    {paid ? (
                      <>
                        <Check size={14} /> Paid
                      </>
                    ) : (
                      'Mark as paid'
                    )}
                  </RsButton>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 ? (
          <p className="rs-ui text-sm text-[var(--rs-ink-faint)]">
            Nothing to distribute yet.
          </p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap justify-between gap-4 border-t border-[var(--rs-line)] pt-6">
        <span className="rs-ui text-sm text-[var(--rs-ink-soft)]">
          Paid out so far
        </span>
        <span className="rs-heading rs-tabular text-lg">
          {formatAud(paidTotal)} of {formatAud(total)}
        </span>
      </div>
    </div>
  );
}

type StatusPayload = {
  relayer: {
    configured: boolean;
    address: string | null;
    authorised: boolean | null;
    tokenAddress: string | null;
    error: string | null;
  };
  payments: { provider: string; configured: boolean };
  economics: { joinBonusRsut: number; rsutPerAud: number };
};

function StatusTab() {
  const { getToken } = useCampaign();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus(await api.get<StatusPayload>('/api/admin/status', getToken));
  }, [getToken]);

  useEffect(() => {
    void load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not load'),
    );
  }, [load]);

  const retry = async () => {
    setBusy(true);
    setRetryResult(null);
    try {
      const result = await api.post<{
        attempted: number;
        confirmed: number;
        failed: number;
      }>('/api/admin/status', undefined, getToken);
      setRetryResult(
        `Retried ${result.attempted}: ${result.confirmed} confirmed, ${result.failed} failed.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <h2 className="rs-heading text-xl">RSUT relayer</h2>
        <p className="rs-prose mt-2 text-sm text-[var(--rs-ink-soft)]">
          Minting only works once the RS Core Team executor has authorised the
          relayer address on the token contract. Until then grants are still
          recorded and votes still count — only the on-chain mirror waits.
        </p>
        <ErrorNote message={error} />

        {status ? (
          <dl className="mt-6 space-y-4">
            {[
              ['Configured', status.relayer.configured ? 'yes' : 'no'],
              ['Relayer address', status.relayer.address ?? '—'],
              ['Token', status.relayer.tokenAddress ?? '—'],
              [
                'Authorised to mint',
                status.relayer.authorised === null
                  ? 'unknown'
                  : status.relayer.authorised
                  ? 'yes'
                  : 'no — run batchSetAuthorizedMinters',
              ],
              ['RPC error', status.relayer.error ?? 'none'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-b border-[var(--rs-line)] pb-3"
              >
                <dt className="rs-ui shrink-0 text-sm text-[var(--rs-ink-soft)]">
                  {label}
                </dt>
                <dd className="rs-ui rs-tabular break-all text-right text-xs">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-6">
          <RsButton size="sm" onClick={retry} disabled={busy}>
            <RefreshCw size={14} /> Retry pending mints
          </RsButton>
          {retryResult ? (
            <p className="rs-ui mt-3 text-sm text-[var(--rs-teal)]">
              {retryResult}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--rs-cream)] p-6">
        <h2 className="rs-heading text-lg">Checkout &amp; economics</h2>
        {status ? (
          <dl className="mt-5 space-y-4">
            {[
              ['Payment provider', status.payments.provider],
              [
                'Credentials present',
                status.payments.configured ? 'yes' : 'no',
              ],
              ['Joining bonus', `${status.economics.joinBonusRsut} RSUT`],
              ['Rate', `A$1 = ${status.economics.rsutPerAud} RSUT`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between border-b border-[var(--rs-line)] pb-3"
              >
                <dt className="rs-ui text-sm text-[var(--rs-ink-soft)]">
                  {label}
                </dt>
                <dd className="rs-heading rs-tabular text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className="rs-prose mt-5 text-xs text-[var(--rs-ink-faint)]">
          Switch provider with CAMPAIGN_PAYMENTS_PROVIDER (mock, paddle or
          stripe) and restart.
        </p>
      </div>
    </div>
  );
}
