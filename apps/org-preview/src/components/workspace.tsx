'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { energyOrg, personaList, space, threads } from '@/lib/data';
import { useStore, type Route } from '@/lib/store';
import { AgentMark, Avatar, cn } from './primitives';

/* ---------- one nav for everyone — contents differ, doors do not ---------- */

type NavItem = {
  key: string;
  label: string;
  badge?: number;
  open: () => void;
  isActive: boolean;
  group: 'org' | 'mine';
};

function useNav(): NavItem[] {
  const s = useStore();

  // one card per thing that actually needs this persona, in the org on screen
  let needsMe = 0;
  if (s.org === 'river') {
    if (s.persona === 'you')
      needsMe =
        (s.setup === 'offered' ? 1 : 0) +
        (s.offers.photo === 'offered' ? 1 : 0);
    if (s.persona === 'lea') needsMe = s.covers === 'draftDone' ? 1 : 0;
    if (s.persona === 'sam')
      needsMe = s.covers === 'done' && !s.payDraft ? 1 : 0;
    if (s.persona === 'maya')
      needsMe =
        (s.weekday !== 'held' ? 1 : 0) +
        (s.rafiJoined ? 0 : 1) +
        (s.strategyPending ? 1 : 0) +
        (s.review === 'due' ? 1 : 0) +
        s.proposals.filter((p) => p.state === 'open' && !s.myVotes[p.id])
          .length;
  } else {
    if (s.persona === 'you') needsMe = s.offers['e-faq'] === 'offered' ? 1 : 0;
    if (s.persona === 'lea') needsMe = s.eMuni === 'draftDone' ? 1 : 0;
    if (s.persona === 'sam')
      needsMe = s.eMuni === 'done' && !s.ePayDraft ? 1 : 0;
    if (s.persona === 'maya')
      needsMe =
        (s.eCarbon !== 'held' ? 1 : 0) +
        (s.eJoin ? 0 : 1) +
        s.eProposals.filter((p) => p.state === 'open' && !s.eVotes[p.id])
          .length;
  }

  const openProposals =
    s.org === 'river'
      ? s.proposals.filter((p) => p.state === 'open' && !s.myVotes[p.id]).length
      : s.eProposals.filter((p) => p.state === 'open' && !s.eVotes[p.id])
          .length;

  const goRoute = (r: Route) => () => s.go(r);

  return [
    {
      key: 'org',
      label: 'Overview',
      open: goRoute('org'),
      isActive: s.route === 'org' || s.route === 'direction',
      group: 'org',
    },
    {
      key: 'all',
      label: 'Projects',
      open: goRoute('all'),
      isActive:
        s.route === 'all' || s.route === 'project' || s.route === 'ticket-view',
      group: 'org',
    },
    {
      key: 'proposals',
      label: 'Decisions',
      badge: s.persona === 'eli' ? 0 : openProposals,
      open: goRoute('proposals'),
      isActive: s.route === 'proposals' || s.route === 'proposal',
      group: 'org',
    },
    {
      key: 'my',
      label: 'My Work',
      badge: needsMe,
      open: goRoute('my'),
      isActive: s.route === 'my' || s.route === 'ticket' || s.route === 'offer',
      group: 'mine',
    },
    {
      key: 'profile',
      label: 'My Profile',
      open: goRoute('profile'),
      isActive: s.route === 'profile',
      group: 'mine',
    },
  ];
}

/* ---------- shell ---------- */

export function Workspace({ children }: { children: ReactNode }) {
  const s = useStore();
  const items = useNav();

  return (
    <div className="flex h-dvh bg-wash">
      {/* rail — one avatar per org you can see */}
      <div className="hidden w-16 shrink-0 flex-col items-center gap-3 py-4 md:flex">
        <AgentMark size={16} />
        <button
          type="button"
          onClick={() => s.switchOrg('river')}
          aria-label="River Commons"
          className={cn(
            'mt-1 rounded-xl p-0.5 transition-all',
            s.org === 'river'
              ? 'ring-2 ring-ink/80'
              : 'opacity-55 hover:opacity-100',
          )}
        >
          <Avatar name={space.short} square size="md" />
        </button>
        <button
          type="button"
          onClick={() => s.switchOrg('energy')}
          aria-label="Hypha Energy"
          className={cn(
            'rounded-xl p-0.5 transition-all',
            s.org === 'energy'
              ? 'ring-2 ring-ink/80'
              : 'opacity-55 hover:opacity-100',
          )}
        >
          <Avatar name={energyOrg.space.short} square size="md" />
        </button>
        <div className="flex-1" />
        <PersonaSwitch />
      </div>

      {/* sidebar */}
      <div className="hidden w-60 shrink-0 flex-col py-4 pr-2 md:flex">
        <div className="px-3 pb-4">
          <p className="text-[15px] font-semibold tracking-[-0.02em]">
            {s.org === 'river' ? space.name : energyOrg.space.name}
          </p>
          <p className="text-[12px] text-faint">
            <RoleLabel />
          </p>
        </div>
        <nav className="px-1.5">
          <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Organization
          </p>
          <div className="flex flex-col gap-0.5">
            {items
              .filter((i) => i.group === 'org')
              .map((item) => (
                <NavButton key={item.key} item={item} />
              ))}
          </div>

          <p className="px-1.5 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Mine
          </p>
          <div className="flex flex-col gap-0.5">
            {items
              .filter((i) => i.group === 'mine')
              .map((item) => (
                <NavButton key={item.key} item={item} />
              ))}
          </div>
        </nav>

        <ChatsSection />

        <div className="mt-auto px-3 pt-4">
          <button
            type="button"
            onClick={() => s.go('about')}
            className={cn(
              'text-[12px] transition-colors',
              s.route === 'about' ? 'text-ink' : 'text-faint hover:text-sub',
            )}
          >
            About this prototype
          </button>
        </div>
      </div>

      {/* main */}
      <main className="relative m-0 flex min-w-0 flex-1 flex-col overflow-hidden bg-paper md:my-2 md:mr-2 md:rounded-2xl md:border md:border-hair">
        {children}
        <MobileBar items={items} />
      </main>

      <Toast />
    </div>
  );
}

function RoleLabel() {
  const s = useStore();
  const p = personaList(s.org).find((x) => x.id === s.persona)!;
  return <>{p.id === 'you' ? p.role : `${p.name} · ${p.role}`}</>;
}

function NavButton({ item }: { item: NavItem }) {
  return (
    <button
      type="button"
      onClick={item.open}
      className={cn(
        'flex items-center justify-between rounded-xl px-3 py-2 text-left text-[14px] font-medium transition-colors',
        item.isActive
          ? 'bg-paper text-ink shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
          : 'text-sub hover:bg-paper/60 hover:text-ink',
      )}
    >
      {item.label}
      {item.badge ? (
        <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {item.badge}
        </span>
      ) : null}
    </button>
  );
}

/* ---------- sidebar chats — DMs and groups, separately ---------- */

type ChatRow = { id: string; kind: string; title: string };

function ChatLink({
  id,
  title,
  kind,
}: {
  id: string;
  title: string;
  kind: string;
}) {
  const s = useStore();
  return (
    <button
      type="button"
      onClick={() => s.openThread(id)}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
        s.route === 'thread' && s.threadId === id
          ? 'bg-paper font-medium text-ink'
          : 'text-sub hover:text-ink',
      )}
    >
      {kind === 'agent' ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-agent" />
      ) : kind === 'shapers' ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-agent" />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-hair" />
      )}
      <span className="truncate">{title}</span>
    </button>
  );
}

function ChatsSection() {
  const s = useStore();
  const [drafting, setDrafting] = useState(false);
  const [name, setName] = useState('');

  const listed: ChatRow[] = [
    ...(s.org === 'energy'
      ? energyOrg.threads
      : threads.filter(
          (t) =>
            t.kind !== 'agent' &&
            (t.kind !== 'shapers' ||
              s.persona === 'maya' ||
              s.persona === 'sam'),
        )),
    ...s.customChats
      .filter((c) => c.org === s.org)
      .map((c) => ({
        id: c.id,
        kind: 'group' as const,
        title: c.title,
      })),
  ];

  const groups = listed.filter((t) => t.kind !== 'dm');
  const dms = listed.filter((t) => t.kind === 'dm');

  return (
    <div className="mt-6 min-h-0 px-3">
      <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
        DMs
      </p>
      <div className="flex flex-col gap-0.5">
        <ChatLink id="agent" title="Personal Assistant" kind="agent" />
        {dms.map((t) => (
          <ChatLink key={t.id} id={t.id} title={t.title} kind={t.kind} />
        ))}
      </div>

      <p className="pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
        Group chats
      </p>
      <div className="flex flex-col gap-0.5">
        {groups.map((t) => (
          <ChatLink key={t.id} id={t.id} title={t.title} kind={t.kind} />
        ))}

        {drafting ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                s.createChat(name.trim());
                setName('');
                setDrafting(false);
              }
              if (e.key === 'Escape') {
                setName('');
                setDrafting(false);
              }
            }}
            onBlur={() => {
              setName('');
              setDrafting(false);
            }}
            placeholder="Room name — Enter to open"
            className="mt-0.5 rounded-lg border border-hair bg-paper px-2 py-1.5 text-[13px] outline-none placeholder:text-faint"
          />
        ) : (
          <button
            type="button"
            onClick={() => setDrafting(true)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-faint transition-colors hover:text-ink"
          >
            <span className="text-[15px] leading-none">+</span> New chat
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- pre-space frame (onboarding, public) ---------- */

export function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-dvh flex-col bg-paper">
      {children}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-4">
        <div className="pointer-events-auto">
          <PersonaSwitch horizontal />
        </div>
      </div>
      <Toast />
    </div>
  );
}

/* ---------- persona switcher ---------- */

function PersonaSwitch({ horizontal }: { horizontal?: boolean }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const people = personaList(s.org);
  const current = people.find((p) => p.id === s.persona)!;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 rounded-full border border-hair bg-paper p-1 pr-1 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-transform hover:scale-[1.03]',
          horizontal && 'pr-3',
        )}
        aria-label="Switch persona"
      >
        <Avatar name={current.name} size="sm" />
        {horizontal && (
          <span className="text-[12px] font-medium text-sub">
            Viewing as {current.name}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'rise absolute z-50 w-64 rounded-2xl border border-hair bg-paper p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.10)]',
            horizontal
              ? 'bottom-12 left-1/2 -translate-x-1/2'
              : 'bottom-0 left-12',
          )}
        >
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            View {s.org === 'energy' ? 'Hypha Energy' : 'the same world'} as
          </p>
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                s.switchPersona(p.id);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-wash',
                p.id === s.persona && 'bg-wash',
              )}
            >
              <Avatar name={p.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-tight">
                  {p.name}
                  <span className="ml-1.5 font-normal text-faint">
                    {p.role}
                  </span>
                </span>
                <span className="block truncate text-[12px] text-sub">
                  {p.line}
                </span>
              </span>
            </button>
          ))}
          <div className="mx-2.5 my-1 border-t border-hair" />
          <button
            type="button"
            onClick={() => {
              s.reset();
              setOpen(false);
            }}
            className="w-full rounded-xl px-2.5 py-2 text-left text-[13px] text-sub transition-colors hover:bg-wash hover:text-ink"
          >
            Reset the world
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- mobile bottom bar ---------- */

function MobileBar({ items }: { items: NavItem[] }) {
  const s = useStore();
  const mobile = ['my', 'all', 'proposals'];
  return (
    <nav className="flex shrink-0 items-center justify-around border-t border-hair bg-paper pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 md:hidden">
      {items
        .filter((i) => mobile.includes(i.key))
        .map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.open}
            className={cn(
              'relative rounded-full px-3 py-2 text-[12px] font-medium',
              item.isActive ? 'text-ink' : 'text-faint',
            )}
          >
            {item.label}
            {item.badge ? (
              <span className="absolute -right-0.5 top-1 h-1.5 w-1.5 rounded-full bg-ink" />
            ) : null}
          </button>
        ))}
      <button
        type="button"
        onClick={() => s.openThread('agent')}
        className={cn(
          'relative rounded-full px-3 py-2 text-[12px] font-medium',
          s.route === 'thread' && s.threadId === 'agent'
            ? 'text-ink'
            : 'text-faint',
        )}
      >
        Assistant
      </button>
      <PersonaSwitch horizontal />
    </nav>
  );
}

/* ---------- toast ---------- */

function Toast() {
  const { notice } = useStore();
  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex justify-center px-4 md:bottom-8">
      <div className="rise max-w-md rounded-full bg-ink px-5 py-2.5 text-center text-[13px] font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
        {notice}
      </div>
    </div>
  );
}

/* ---------- shared page scaffold ---------- */

export function Page({
  kicker,
  title,
  children,
  wide,
}: {
  kicker?: string;
  title?: string;
  children: ReactNode;
  wide?: boolean | 'board';
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div
        className={cn(
          'mx-auto px-5 py-8 md:px-10 md:py-12',
          wide === 'board' ? 'max-w-5xl' : wide ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        {kicker && (
          <p className="rise mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            {kicker}
          </p>
        )}
        {title && (
          <h1 className="rise mb-8 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em]">
            {title}
          </h1>
        )}
        {children}
      </div>
    </div>
  );
}
