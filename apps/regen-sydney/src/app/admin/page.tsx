'use client';

import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '../_lib/cn';

import {
  Field,
  Pill,
  RsButton,
  SectionHeading,
  ShareBar,
  inputClass,
} from '../_components/ui';
import { formatAud, formatNumber, useCampaign } from '../_lib/campaign-store';
import {
  ADMIN_EMAILS,
  GROUP_LABELS,
  type ProjectGroup,
} from '../_lib/mock-data';

type Tab = 'projects' | 'cycle' | 'contributions' | 'distribution';

const TABS: { id: Tab; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'contributions', label: 'Contributions' },
  { id: 'distribution', label: 'Distribution' },
];

export default function RegenSydneyAdminPage() {
  const { user, hydrated, signIn } = useCampaign();
  const [tab, setTab] = useState<Tab>('projects');

  if (hydrated && !user?.isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md text-center">
          <h1 className="rs-heading text-3xl">Admins only</h1>
          <p className="rs-prose mt-4 text-[var(--rs-ink-soft)]">
            This area is limited to the Regen Sydney team. Access is checked
            server-side against the email on your Hypha login —{' '}
            {ADMIN_EMAILS.join(' and ')}.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <RsButton onClick={() => signIn({ asAdmin: true })}>
              Mockup: sign in as admin
            </RsButton>
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
          {user ? (
            <Pill tone="outline">
              {user.name} &middot; {user.email}
            </Pill>
          ) : null}
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
        </div>
      </div>
    </main>
  );
}

function ProjectsTab() {
  const { projects, addProject, removeProject, toggleProject } = useCampaign();
  const [title, setTitle] = useState('');
  const [program, setProgram] = useState('');
  const [group, setGroup] = useState<ProjectGroup>('initiative');
  const [summary, setSummary] = useState('');
  const [team, setTeam] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const canSubmit = title.trim().length > 2 && summary.trim().length > 10;

  const handleAdd = () => {
    addProject({
      title,
      program: program || 'Regen Sydney',
      group,
      summary,
      team,
      videoUrl,
    });
    setTitle('');
    setProgram('');
    setSummary('');
    setTeam('');
    setVideoUrl('');
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <h2 className="rs-heading text-xl">Ballot projects</h2>
        <p className="rs-prose mt-2 text-sm text-[var(--rs-ink-soft)]">
          Hiding a project removes it from the ballot without deleting the votes
          already cast for it.
        </p>

        <ul className="mt-6 divide-y divide-[var(--rs-line)]">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-start justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="rs-heading text-sm leading-snug">
                  {project.title}
                </p>
                <p className="rs-ui mt-1 text-xs text-[var(--rs-ink-faint)]">
                  {project.program} &middot; {formatNumber(project.baseVotes)}{' '}
                  votes
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleProject(project.id)}
                  aria-label={project.active ? 'Hide project' : 'Show project'}
                  className="rs-focus rounded-full p-2 text-[var(--rs-ink-faint)] transition-colors hover:text-[var(--rs-ink)]"
                >
                  {project.active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => removeProject(project.id)}
                  aria-label="Remove project"
                  className="rs-focus rounded-full p-2 text-[var(--rs-ink-faint)] transition-colors hover:text-[var(--rs-clay)]"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
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
          <RsButton
            onClick={handleAdd}
            disabled={!canSubmit}
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
  const { cycle, setCycleDuration, startNewCycle, totalPotAud } = useCampaign();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <h2 className="rs-heading text-xl">Current round</h2>
        <dl className="mt-6 space-y-4">
          {[
            ['Round', `#${cycle.number} — ${cycle.name}`],
            ['Closes', new Date(cycle.endsAt).toISOString().slice(0, 10)],
            ['Community raised', formatAud(cycle.communityPotAud)],
            ['Total pot with match', formatAud(totalPotAud)],
            ['Contributors', formatNumber(cycle.contributors)],
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
      </div>

      <div className="rounded-2xl bg-[var(--rs-cream)] p-6">
        <h2 className="rs-heading text-lg">Settings</h2>
        <div className="mt-5">
          <Field
            label="Voting cycle length"
            hint="Applies from the next round onwards."
          >
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={180}
                className={inputClass}
                value={cycle.durationDays}
                onChange={(event) =>
                  setCycleDuration(Number(event.target.value))
                }
              />
              <span className="rs-ui shrink-0 text-sm text-[var(--rs-ink-soft)]">
                days
              </span>
            </div>
          </Field>
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
                onClick={() => {
                  startNewCycle();
                  setConfirming(false);
                }}
              >
                <Check size={14} /> Yes, start round {cycle.number + 1}
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
  const { contributions, cycle } = useCampaign();

  return (
    <div>
      <h2 className="rs-heading text-xl">Contributions this round</h2>
      <p className="rs-prose mt-2 text-sm text-[var(--rs-ink-soft)]">
        Payments settle through Paddle. Each settled contribution mints RSUT to
        the contributor at A$1 = 1 RSUT.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--rs-line)]">
              {['Contributor', 'Date', 'Amount', 'RSUT', 'Status'].map(
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
            {contributions.map((contribution) => (
              <tr
                key={contribution.id}
                className="border-b border-[var(--rs-line)]"
              >
                <td className="py-3.5">
                  <span className="rs-heading block text-sm">
                    {contribution.who}
                  </span>
                  <span className="rs-ui text-xs text-[var(--rs-ink-faint)]">
                    {contribution.email}
                  </span>
                </td>
                <td className="rs-ui rs-tabular py-3.5 text-sm text-[var(--rs-ink-soft)]">
                  {contribution.at}
                </td>
                <td className="rs-heading rs-tabular py-3.5 text-sm">
                  {formatAud(contribution.amountAud)}
                </td>
                <td className="rs-ui rs-tabular py-3.5 text-sm text-[var(--rs-ink-soft)]">
                  {formatNumber(contribution.rsut)}
                </td>
                <td className="py-3.5">
                  <Pill
                    tone={
                      contribution.status === 'settled' ? 'aqua' : 'outline'
                    }
                  >
                    {contribution.status}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="rs-ui mt-6 text-sm text-[var(--rs-ink-soft)]">
        <span className="rs-heading rs-tabular mr-1.5 text-base">
          {formatAud(cycle.communityPotAud)}
        </span>
        raised from {formatNumber(cycle.contributors)} contributors.
      </p>
    </div>
  );
}

function DistributionTab() {
  const { tally, totalPotAud, paidOut, markPaid } = useCampaign();
  const paidTotal = tally
    .filter((row) => paidOut.includes(row.project.id))
    .reduce((sum, row) => sum + row.projectedAud, 0);

  return (
    <div>
      <h2 className="rs-heading text-xl">Allocation worksheet</h2>
      <p className="rs-prose mt-2 max-w-2xl text-sm text-[var(--rs-ink-soft)]">
        Funds land in the admin account and are transferred to each project
        manually. Tick a project once you have paid it, so the worksheet stays
        an accurate record.
      </p>

      <div className="mt-6 space-y-4">
        {tally.map((row) => {
          const paid = paidOut.includes(row.project.id);
          return (
            <div
              key={row.project.id}
              className={cn(
                'rounded-2xl border p-5 transition-colors',
                paid
                  ? 'border-[var(--rs-aqua)] bg-[var(--rs-aqua-soft)]'
                  : 'border-[var(--rs-line)]',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="rs-heading text-sm">{row.project.title}</p>
                  <p className="rs-ui mt-1 text-xs text-[var(--rs-ink-faint)]">
                    {formatNumber(row.votes)} votes &middot;{' '}
                    {(row.share * 100).toFixed(1)}% of the pot
                  </p>
                  <div className="mt-3 max-w-sm">
                    <ShareBar share={row.share} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="rs-heading rs-tabular text-lg">
                    {formatAud(row.projectedAud)}
                  </span>
                  <RsButton
                    size="sm"
                    variant={paid ? 'quiet' : 'ghost'}
                    onClick={() => markPaid(row.project.id)}
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
      </div>

      <div className="mt-8 flex flex-wrap justify-between gap-4 border-t border-[var(--rs-line)] pt-6">
        <span className="rs-ui text-sm text-[var(--rs-ink-soft)]">
          Paid out so far
        </span>
        <span className="rs-heading rs-tabular text-lg">
          {formatAud(paidTotal)} of {formatAud(totalPotAud)}
        </span>
      </div>
    </div>
  );
}
