'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ADMIN_EMAILS,
  IMAGE_BASE,
  JOIN_BONUS_RSUT,
  MATCH_MULTIPLIER,
  SEED_CONTRIBUTIONS,
  SEED_CYCLE,
  SEED_PROJECTS,
  type CampaignProject,
  type MockContribution,
  type ProjectGroup,
} from './mock-data';

/**
 * Everything here lives in memory (mirrored to sessionStorage so navigating
 * between the public page and the admin area keeps your state). There is no
 * backend behind any of it — this exists purely to make the design clickable.
 */

export type MockUser = {
  name: string;
  email: string;
  wallet: string;
  isAdmin: boolean;
  /** Whether the joining bonus was minted this session. */
  joinedNow: boolean;
};

export type Cycle = {
  number: number;
  name: string;
  durationDays: number;
  endsAt: string;
  communityPotAud: number;
  contributors: number;
};

type State = {
  user: MockUser | null;
  balance: number;
  allocations: Record<string, number>;
  projects: CampaignProject[];
  cycle: Cycle;
  contributions: MockContribution[];
  paidOut: string[];
};

const STORAGE_KEY = 'rs-campaign-mockup-v1';

const initialState: State = {
  user: null,
  balance: 0,
  allocations: {},
  projects: SEED_PROJECTS,
  cycle: SEED_CYCLE,
  contributions: SEED_CONTRIBUTIONS,
  paidOut: [],
};

type CampaignContextValue = State & {
  hydrated: boolean;
  signIn: (options: { asAdmin: boolean }) => void;
  signOut: () => void;
  dismissJoinNotice: () => void;
  allocated: number;
  remaining: number;
  setAllocation: (projectId: string, value: number) => void;
  adjustAllocation: (projectId: string, delta: number) => void;
  resetAllocations: () => void;
  contribute: (amountAud: number) => void;
  totalPotAud: number;
  tally: TallyRow[];
  addProject: (
    project: Pick<
      CampaignProject,
      'title' | 'program' | 'group' | 'summary' | 'team' | 'videoUrl'
    >,
  ) => void;
  removeProject: (projectId: string) => void;
  toggleProject: (projectId: string) => void;
  setCycleDuration: (days: number) => void;
  startNewCycle: () => void;
  markPaid: (projectId: string) => void;
};

const CampaignContext = createContext<CampaignContextValue | null>(null);

export type TallyRow = {
  project: CampaignProject;
  votes: number;
  yourVotes: number;
  share: number;
  projectedAud: number;
};

const MEMBER: MockUser = {
  name: 'Ada Mercer',
  email: 'ada.mercer@gmail.com',
  wallet: '0x7A3f…9C21',
  isAdmin: false,
  joinedNow: true,
};

const ADMIN: MockUser = {
  name: 'Kiran Kashyap',
  email: ADMIN_EMAILS[0],
  wallet: '0xE41b…7Df0',
  isAdmin: true,
  joinedNow: false,
};

function readStored(): State | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...initialState, ...parsed };
  } catch {
    return null;
  }
}

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sessionStorage can be unavailable in private browsing; the mockup still works.
    }
  }, [state, hydrated]);

  const signIn = useCallback(({ asAdmin }: { asAdmin: boolean }) => {
    setState((prev) => ({
      ...prev,
      user: asAdmin ? ADMIN : MEMBER,
      balance: asAdmin ? 1250 : JOIN_BONUS_RSUT,
      allocations: {},
    }));
  }, []);

  const signOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      user: null,
      balance: 0,
      allocations: {},
    }));
  }, []);

  const dismissJoinNotice = useCallback(() => {
    setState((prev) =>
      prev.user ? { ...prev, user: { ...prev.user, joinedNow: false } } : prev,
    );
  }, []);

  const allocated = useMemo(
    () => Object.values(state.allocations).reduce((sum, n) => sum + n, 0),
    [state.allocations],
  );
  const remaining = Math.max(0, state.balance - allocated);

  const setAllocation = useCallback((projectId: string, value: number) => {
    setState((prev) => {
      const others = Object.entries(prev.allocations).reduce(
        (sum, [id, n]) => (id === projectId ? sum : sum + n),
        0,
      );
      const capped = Math.max(0, Math.min(value, prev.balance - others));
      return {
        ...prev,
        allocations: { ...prev.allocations, [projectId]: Math.round(capped) },
      };
    });
  }, []);

  const adjustAllocation = useCallback((projectId: string, delta: number) => {
    setState((prev) => {
      const current = prev.allocations[projectId] ?? 0;
      const others = Object.entries(prev.allocations).reduce(
        (sum, [id, n]) => (id === projectId ? sum : sum + n),
        0,
      );
      const capped = Math.max(
        0,
        Math.min(current + delta, prev.balance - others),
      );
      return {
        ...prev,
        allocations: { ...prev.allocations, [projectId]: Math.round(capped) },
      };
    });
  }, []);

  const resetAllocations = useCallback(() => {
    setState((prev) => ({ ...prev, allocations: {} }));
  }, []);

  const contribute = useCallback((amountAud: number) => {
    setState((prev) => ({
      ...prev,
      balance: prev.balance + amountAud,
      cycle: {
        ...prev.cycle,
        communityPotAud: prev.cycle.communityPotAud + amountAud,
        contributors: prev.cycle.contributors + 1,
      },
      contributions: [
        {
          id: `txn_${Math.random().toString(16).slice(2, 6)}`,
          who: prev.user?.name ?? 'You',
          email: prev.user?.email ?? 'you@example.com',
          amountAud,
          rsut: amountAud,
          at: new Date().toISOString().slice(0, 10),
          status: 'settled' as const,
        },
        ...prev.contributions,
      ],
    }));
  }, []);

  const totalPotAud =
    state.cycle.communityPotAud +
    state.cycle.communityPotAud * MATCH_MULTIPLIER;

  const tally = useMemo<TallyRow[]>(() => {
    const active = state.projects.filter((p) => p.active);
    const rows = active.map((project) => {
      const yourVotes = state.allocations[project.id] ?? 0;
      return { project, votes: project.baseVotes + yourVotes, yourVotes };
    });
    const total = rows.reduce((sum, r) => sum + r.votes, 0) || 1;
    return rows
      .map((r) => ({
        ...r,
        share: r.votes / total,
        projectedAud: Math.round((r.votes / total) * totalPotAud),
      }))
      .sort((a, b) => b.votes - a.votes);
  }, [state.projects, state.allocations, totalPotAud]);

  const addProject = useCallback<CampaignContextValue['addProject']>(
    (project) => {
      setState((prev) => ({
        ...prev,
        projects: [
          ...prev.projects,
          {
            ...project,
            id: `custom-${Date.now()}`,
            image: `${IMAGE_BASE}/indicators.webp`,
            baseVotes: 0,
            active: true,
          },
        ],
      }));
    },
    [],
  );

  const removeProject = useCallback((projectId: string) => {
    setState((prev) => {
      const allocations = Object.fromEntries(
        Object.entries(prev.allocations).filter(([id]) => id !== projectId),
      );
      return {
        ...prev,
        projects: prev.projects.filter((p) => p.id !== projectId),
        allocations,
      };
    });
  }, []);

  const toggleProject = useCallback((projectId: string) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId ? { ...p, active: !p.active } : p,
      ),
    }));
  }, []);

  const setCycleDuration = useCallback((days: number) => {
    setState((prev) => ({
      ...prev,
      cycle: { ...prev.cycle, durationDays: Math.max(1, Math.round(days)) },
    }));
  }, []);

  const startNewCycle = useCallback(() => {
    setState((prev) => ({
      ...prev,
      allocations: {},
      paidOut: [],
      cycle: {
        ...prev.cycle,
        number: prev.cycle.number + 1,
        name: `Round ${prev.cycle.number + 1}`,
        endsAt: new Date(
          Date.now() + prev.cycle.durationDays * 24 * 60 * 60 * 1000,
        ).toISOString(),
        communityPotAud: 0,
        contributors: 0,
      },
    }));
  }, []);

  const markPaid = useCallback((projectId: string) => {
    setState((prev) => ({
      ...prev,
      paidOut: prev.paidOut.includes(projectId)
        ? prev.paidOut.filter((id) => id !== projectId)
        : [...prev.paidOut, projectId],
    }));
  }, []);

  const value: CampaignContextValue = {
    ...state,
    hydrated,
    signIn,
    signOut,
    dismissJoinNotice,
    allocated,
    remaining,
    setAllocation,
    adjustAllocation,
    resetAllocations,
    contribute,
    totalPotAud,
    tally,
    addProject,
    removeProject,
    toggleProject,
    setCycleDuration,
    startNewCycle,
    markPaid,
  };

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) {
    throw new Error('useCampaign must be used inside CampaignProvider');
  }
  return ctx;
}

export const GROUP_ORDER: ProjectGroup[] = [
  'initiative',
  'program',
  'enabling',
];

export function formatAud(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number) {
  return new Intl.NumberFormat('en-AU').format(Math.round(amount));
}
