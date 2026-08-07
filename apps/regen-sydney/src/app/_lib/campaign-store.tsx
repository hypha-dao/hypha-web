'use client';

import { useLogin, useLogout, usePrivy } from '@privy-io/react-auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  CampaignProjectDto,
  CampaignStateDto,
  CheckoutSessionDto,
  CycleDto,
  ViewerDto,
} from '@rs/lib/campaign-types';
import { formatAud, formatNumber } from '@rs/lib/campaign-types';

import { ApiRequestError, api } from './api';

export { formatAud, formatNumber };
export { GROUP_LABELS, GROUP_ORDER } from '@rs/lib/campaign-types';
export type { CampaignProjectDto, ProjectGroup } from '@rs/lib/campaign-types';

/**
 * Single client-side view of the campaign.
 *
 * Vote allocations are held locally while you drag the sliders and only sent
 * to the server when you press save, so the ballot is one atomic write rather
 * than a request per nudge. Everything else — balance, tally, totals — is read
 * back from the API.
 */

export type CycleView = {
  id: number | null;
  number: number;
  name: string;
  status: 'open' | 'closed';
  endsAt: string;
  durationDays: number;
  communityPotAud: number;
  contributors: number;
  matchMultiplier: number;
};

export type TallyRow = {
  project: CampaignProjectDto;
  votes: number;
  yourVotes: number;
  share: number;
  projectedAud: number;
};

export type CampaignUser = {
  name: string;
  email: string;
  wallet: string;
  isAdmin: boolean;
  joinedNow: boolean;
  mintStatus: ViewerDto['mint']['status'];
};

const EMPTY_CYCLE: CycleView = {
  id: null,
  number: 0,
  name: 'Not open yet',
  status: 'closed',
  endsAt: new Date(0).toISOString(),
  durationDays: 21,
  communityPotAud: 0,
  contributors: 0,
  matchMultiplier: 1,
};

type CampaignContextValue = {
  hydrated: boolean;
  loading: boolean;
  error: string | null;

  user: CampaignUser | null;
  balance: number;
  cycle: CycleView;
  projects: CampaignProjectDto[];
  tally: TallyRow[];
  totalPotAud: number;
  votesCast: number;
  economics: CampaignStateDto['economics'];

  signIn: () => void;
  signOut: () => void;
  dismissJoinNotice: () => void;

  allocations: Record<number, number>;
  allocated: number;
  remaining: number;
  dirty: boolean;
  saving: boolean;
  setAllocation: (projectId: number, value: number) => void;
  adjustAllocation: (projectId: number, delta: number) => void;
  resetAllocations: () => void;
  saveVotes: () => Promise<boolean>;

  contribute: (amountAud: number) => Promise<CheckoutSessionDto>;
  refresh: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

const CampaignContext = createContext<CampaignContextValue | null>(null);

/** Server-supplied messages are written for members, so prefer them. */
function describe(caught: unknown, fallback: string): string {
  return caught instanceof ApiRequestError ? caught.message : fallback;
}

function toCycleView(
  cycle: CycleDto | null,
  totals: CampaignStateDto['totals'],
): CycleView {
  if (!cycle) return EMPTY_CYCLE;
  return {
    id: cycle.id,
    number: cycle.number,
    name: cycle.name,
    status: cycle.status,
    endsAt: cycle.endsAt,
    durationDays: cycle.durationDays,
    communityPotAud: totals.communityAud,
    contributors: totals.contributors,
    matchMultiplier: cycle.matchMultiplier,
  };
}

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();

  const [state, setState] = useState<CampaignStateDto | null>(null);
  const [viewer, setViewer] = useState<ViewerDto | null>(null);
  const [localAllocations, setLocalAllocations] = useState<Record<
    number,
    number
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinDismissed, setJoinDismissed] = useState(false);

  /**
   * Privy reports `authenticated` before `getAccessToken()` can produce a
   * token, so the first call after sign-in usually comes back empty. Sending
   * that request without a bearer earns a 401 that nothing retries — the
   * effect's dependencies have already settled — and the member stays signed
   * out for the rest of the visit while Privy insists they are signed in.
   *
   * The same wait is in `@hypha-platform/authentication`, which hit this on the
   * platform; the campaign cannot import it without depending on Hypha's
   * runtime, so the retry lives here instead. Backoff is bounded: after roughly
   * eight seconds, give up and let the server report a real 401.
   */
  const getToken = useCallback(async () => {
    if (!authenticated) return null;

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const token = await getAccessToken();
        if (token) return token;
      } catch (caught) {
        // Worth saying out loud: returning null quietly turns a refresh
        // failure into an unexplained 401 several layers away.
        console.warn('Privy access token unavailable:', caught);
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }

    console.warn('Privy never produced an access token for this session');
    return null;
  }, [authenticated, getAccessToken]);

  const loadPublicState = useCallback(async () => {
    const next = await api.get<CampaignStateDto>('/api/campaign', getToken);
    setState(next);
    return next;
  }, [getToken]);

  /**
   * Establishing the session is a POST because it creates the member record
   * and grants the joining bonus. It runs once per sign-in; a second call is
   * harmless but would report `joinedNow: false`.
   */
  const establishSession = useCallback(async () => {
    // Email and wallet deliberately are not sent — the server reads those from
    // Privy, since admin access is decided by email.
    const next = await api.post<ViewerDto>(
      '/api/me',
      { name: privyUser?.google?.name ?? null },
      getToken,
    );
    setViewer(next);
    setLocalAllocations(next.allocations);
    return next;
  }, [getToken, privyUser]);

  const signedInRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (authenticated && privyUser?.id) {
          // Re-run whenever the Privy user changes so a wallet that finishes
          // provisioning after login still gets recorded.
          if (signedInRef.current !== privyUser.id) {
            signedInRef.current = privyUser.id;
            setJoinDismissed(false);
          }
          try {
            await establishSession();
          } catch (caught) {
            // The round, the projects and the tally are all public. Letting a
            // failed sign-in abort the load as well turns one broken thing
            // into a page that claims there is no round at all.
            if (!cancelled) setError(describe(caught, 'Could not sign you in'));
          }
        } else {
          signedInRef.current = null;
          setViewer(null);
          setLocalAllocations(null);
        }
        await loadPublicState();
      } catch (caught) {
        if (!cancelled) {
          setError(describe(caught, 'Could not load the campaign'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, privyUser?.id, establishSession, loadPublicState]);

  const refresh = useCallback(async () => {
    try {
      if (authenticated) {
        const next = await establishSession();
        setLocalAllocations(next.allocations);
      }
      await loadPublicState();
    } catch (caught) {
      setError(describe(caught, 'Could not refresh the campaign'));
    }
  }, [authenticated, establishSession, loadPublicState]);

  const projects = state?.projects ?? [];
  const balance = viewer?.votingPower ?? 0;
  const emptyAllocations = useMemo<Record<number, number>>(() => ({}), []);
  const allocations = localAllocations ?? emptyAllocations;

  const allocated = useMemo(
    () => Object.values(allocations).reduce((sum, n) => sum + n, 0),
    [allocations],
  );
  const remaining = Math.max(0, balance - allocated);

  const dirty = useMemo(() => {
    if (!viewer) return false;
    const saved = viewer.allocations;
    const ids = new Set([
      ...Object.keys(saved).map(Number),
      ...Object.keys(allocations).map(Number),
    ]);
    for (const id of ids) {
      if ((saved[id] ?? 0) !== (allocations[id] ?? 0)) return true;
    }
    return false;
  }, [viewer, allocations]);

  /**
   * Tally rows are recomputed locally against the unsaved allocation so the
   * projected split moves as you drag, then replaced by the server's numbers
   * on save. Other members' votes come from the server either way.
   */
  const tally = useMemo<TallyRow[]>(() => {
    if (!state) return [];
    const byId = new Map(state.projects.map((p) => [p.id, p]));
    const serverRows = new Map(state.tally.map((row) => [row.projectId, row]));

    const rows = state.projects.map((project) => {
      const server = serverRows.get(project.id);
      const othersVotes = (server?.votes ?? 0) - (server?.yourVotes ?? 0);
      const yourVotes = allocations[project.id] ?? 0;
      return { project, votes: othersVotes + yourVotes, yourVotes };
    });

    const total = rows.reduce((sum, row) => sum + row.votes, 0);
    const potAud = state.totals.potAud;

    return rows
      .map((row) => {
        const share = total > 0 ? row.votes / total : 0;
        return {
          ...row,
          project: byId.get(row.project.id) ?? row.project,
          share,
          projectedAud: Math.round(share * potAud),
        };
      })
      .sort((a, b) => b.votes - a.votes || a.project.id - b.project.id);
  }, [state, allocations]);

  const setAllocation = useCallback(
    (projectId: number, value: number) => {
      setLocalAllocations((prev) => {
        const current = prev ?? {};
        const others = Object.entries(current).reduce(
          (sum, [id, n]) => (Number(id) === projectId ? sum : sum + n),
          0,
        );
        const capped = Math.max(0, Math.min(value, balance - others));
        return { ...current, [projectId]: Math.round(capped) };
      });
    },
    [balance],
  );

  const adjustAllocation = useCallback(
    (projectId: number, delta: number) => {
      setLocalAllocations((prev) => {
        const current = prev ?? {};
        const others = Object.entries(current).reduce(
          (sum, [id, n]) => (Number(id) === projectId ? sum : sum + n),
          0,
        );
        const next = (current[projectId] ?? 0) + delta;
        const capped = Math.max(0, Math.min(next, balance - others));
        return { ...current, [projectId]: Math.round(capped) };
      });
    },
    [balance],
  );

  const resetAllocations = useCallback(() => setLocalAllocations({}), []);

  const saveVotes = useCallback(async () => {
    if (!viewer) return false;
    setSaving(true);
    setError(null);
    try {
      const payload = Object.entries(allocations)
        .map(([projectId, weight]) => ({
          projectId: Number(projectId),
          weight,
        }))
        .filter((entry) => entry.weight > 0);

      const result = await api.put<{
        allocations: Record<number, number>;
      }>('/api/votes', { allocations: payload }, getToken);

      setViewer((prev) =>
        prev ? { ...prev, allocations: result.allocations } : prev,
      );
      setLocalAllocations(result.allocations);
      await loadPublicState();
      return true;
    } catch (caught) {
      setError(describe(caught, 'Could not save your votes'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [viewer, allocations, getToken, loadPublicState]);

  const contribute = useCallback(
    async (amountAud: number) => {
      return api.post<CheckoutSessionDto>(
        '/api/checkout',
        { amountAud },
        getToken,
      );
    },
    [getToken],
  );

  const signIn = useCallback(() => login(), [login]);

  const signOut = useCallback(async () => {
    await logout();
    setViewer(null);
    setLocalAllocations(null);
    await loadPublicState();
  }, [logout, loadPublicState]);

  const user = useMemo<CampaignUser | null>(() => {
    if (!viewer) return null;
    const wallet = viewer.walletAddress;
    return {
      name: viewer.name || viewer.email?.split('@')[0] || 'Member',
      email: viewer.email ?? '',
      wallet: wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'pending',
      isAdmin: viewer.isAdmin,
      joinedNow: viewer.joinedNow && !joinDismissed,
      mintStatus: viewer.mint.status,
    };
  }, [viewer, joinDismissed]);

  const cycle = toCycleView(
    state?.cycle ?? null,
    state?.totals ?? {
      communityAud: 0,
      matchAud: 0,
      potAud: 0,
      contributors: 0,
      votesCast: 0,
    },
  );

  const value: CampaignContextValue = {
    hydrated: ready && !loading,
    loading,
    error,
    user,
    balance,
    cycle,
    projects,
    tally,
    totalPotAud: state?.totals.potAud ?? 0,
    votesCast: state?.totals.votesCast ?? 0,
    economics: state?.economics ?? {
      joinBonusRsut: 50,
      rsutPerAud: 1,
      minContributionAud: 5,
    },
    signIn,
    signOut,
    dismissJoinNotice: () => setJoinDismissed(true),
    allocations,
    allocated,
    remaining,
    dirty,
    saving,
    setAllocation,
    adjustAllocation,
    resetAllocations,
    saveVotes,
    contribute,
    refresh,
    getToken,
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
