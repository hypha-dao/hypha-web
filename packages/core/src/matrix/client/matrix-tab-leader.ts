const CHANNEL_NAME = 'hypha-matrix-sync-leader-v1';
const HEARTBEAT_INTERVAL_MS = 2_000;
const LEADER_STALE_MS = 6_000;
const INITIAL_CLAIM_DELAY_MS = 750;

type LeaderMessage =
  | { type: 'heartbeat'; tabId: string; at: number }
  | { type: 'claim'; tabId: string; at: number; force?: boolean }
  | { type: 'resign'; tabId: string; at: number };

export type MatrixTabLeaderSnapshot = {
  isSyncLeader: boolean;
  leaderTabId: string | null;
};

type MatrixTabLeaderListener = (snapshot: MatrixTabLeaderSnapshot) => void;

function createTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isLeaderMessage(value: unknown): value is LeaderMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return type === 'heartbeat' || type === 'claim' || type === 'resign';
}

/**
 * Ensures only one browser tab runs Matrix `/sync` at a time. Follower tabs stay
 * idle until they claim leadership (for example when the leader tab is suspended).
 */
export class MatrixTabLeaderCoordinator {
  private readonly tabId = createTabId();
  private channel: BroadcastChannel | null = null;
  private readonly holdLeadershipWhile: () => boolean;
  private readonly listeners = new Set<MatrixTabLeaderListener>();

  private isSyncLeader = false;
  private leaderTabId: string | null = null;
  private lastLeaderSignalAt = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private initialClaimTimer: ReturnType<typeof setTimeout> | null = null;
  private staleCheckTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(options?: { holdLeadershipWhile?: () => boolean }) {
    this.holdLeadershipWhile = options?.holdLeadershipWhile ?? (() => false);

    if (typeof BroadcastChannel === 'undefined') {
      this.isSyncLeader = true;
      this.leaderTabId = this.tabId;
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel = channel;
    channel.onmessage = (event) => {
      if (isLeaderMessage(event.data)) {
        this.handleMessage(event.data);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener(
        'visibilitychange',
        this.handleVisibilityChange,
      );
    }

    this.initialClaimTimer = setTimeout(() => {
      this.evaluateLeadership({ force: false });
    }, INITIAL_CLAIM_DELAY_MS);

    this.staleCheckTimer = setInterval(() => {
      this.evaluateLeadership({ force: false });
    }, HEARTBEAT_INTERVAL_MS);
  }

  getSnapshot(): MatrixTabLeaderSnapshot {
    return {
      isSyncLeader: this.isSyncLeader,
      leaderTabId: this.leaderTabId,
    };
  }

  subscribe(listener: MatrixTabLeaderListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  claimSyncLeadership(): void {
    this.evaluateLeadership({ force: true, userInitiated: true });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.initialClaimTimer) {
      clearTimeout(this.initialClaimTimer);
      this.initialClaimTimer = null;
    }
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
    this.stopHeartbeat();

    if (this.isSyncLeader) {
      this.broadcast({ type: 'resign', tabId: this.tabId, at: Date.now() });
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener(
        'visibilitychange',
        this.handleVisibilityChange,
      );
    }

    this.channel?.close();
    this.isSyncLeader = false;
    this.leaderTabId = null;
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private broadcast(message: LeaderMessage): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // Ignore BroadcastChannel post failures during unload.
    }
  }

  private handleBeforeUnload = (): void => {
    if (!this.isSyncLeader) return;
    this.broadcast({ type: 'resign', tabId: this.tabId, at: Date.now() });
  };

  private handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    this.evaluateLeadership({ force: false });
  };

  private handleMessage(message: LeaderMessage): void {
    if (message.tabId === this.tabId) return;

    if (message.type === 'heartbeat' || message.type === 'claim') {
      const remoteWins =
        !this.isSyncLeader ||
        message.at > this.lastLeaderSignalAt ||
        (message.at === this.lastLeaderSignalAt &&
          message.tabId < (this.leaderTabId ?? this.tabId));

      if (remoteWins) {
        this.leaderTabId = message.tabId;
        this.lastLeaderSignalAt = message.at;
      }

      if (this.isSyncLeader && message.type === 'claim') {
        if (
          message.force &&
          message.tabId !== this.tabId &&
          (remoteWins || this.leaderTabId === this.tabId)
        ) {
          this.relinquishLeadership();
          return;
        }
        if (this.holdLeadershipWhile()) return;
        if (message.tabId !== this.tabId && remoteWins) {
          this.relinquishLeadership();
        }
      } else if (!this.isSyncLeader && remoteWins) {
        this.notify();
      }
      return;
    }

    if (message.type === 'resign' && this.leaderTabId === message.tabId) {
      this.leaderTabId = null;
      this.lastLeaderSignalAt = 0;
      this.evaluateLeadership({ force: false });
    }
  }

  private leaderIsStale(now = Date.now()): boolean {
    if (!this.leaderTabId) return true;
    if (this.leaderTabId === this.tabId) return false;
    return now - this.lastLeaderSignalAt > LEADER_STALE_MS;
  }

  private evaluateLeadership(options: {
    force: boolean;
    userInitiated?: boolean;
  }): void {
    if (this.disposed) return;

    const now = Date.now();
    const stale = this.leaderIsStale(now);
    const shouldClaim =
      options.force ||
      stale ||
      (this.leaderTabId === this.tabId && !this.isSyncLeader);

    if (!shouldClaim) return;
    if (this.isSyncLeader) return;
    if (
      !options.force &&
      !stale &&
      this.leaderTabId &&
      this.leaderTabId !== this.tabId
    ) {
      return;
    }

    this.becomeLeader(now, Boolean(options.userInitiated));
  }

  private becomeLeader(now: number, force = false): void {
    this.isSyncLeader = true;
    this.leaderTabId = this.tabId;
    this.lastLeaderSignalAt = now;
    this.broadcast({ type: 'claim', tabId: this.tabId, at: now, force });
    this.startHeartbeat();
    this.notify();
  }

  private relinquishLeadership(): void {
    this.stopHeartbeat();
    this.isSyncLeader = false;
    this.notify();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const sendHeartbeat = () => {
      if (!this.isSyncLeader || this.disposed) return;
      const at = Date.now();
      this.lastLeaderSignalAt = at;
      this.broadcast({ type: 'heartbeat', tabId: this.tabId, at });
    };
    sendHeartbeat();
    this.heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
