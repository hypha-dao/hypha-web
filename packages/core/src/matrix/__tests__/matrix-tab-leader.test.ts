import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MatrixTabLeaderCoordinator } from '../client/matrix-tab-leader';

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public readonly name: string) {
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void {
    for (const channel of MockBroadcastChannel.instances) {
      if (channel === this) continue;
      channel.onmessage?.({ data } as MessageEvent);
    }
  }

  close(): void {
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter(
      (channel) => channel !== this,
    );
  }
}

describe('MatrixTabLeaderCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('elects a single leader across tabs', () => {
    const leaderA = new MatrixTabLeaderCoordinator();
    const leaderB = new MatrixTabLeaderCoordinator();

    const snapshotsA: boolean[] = [];
    const snapshotsB: boolean[] = [];
    leaderA.subscribe((snapshot) => {
      snapshotsA.push(snapshot.isSyncLeader);
    });
    leaderB.subscribe((snapshot) => {
      snapshotsB.push(snapshot.isSyncLeader);
    });

    vi.advanceTimersByTime(1_000);

    const leaders = [leaderA.getSnapshot(), leaderB.getSnapshot()].filter(
      (snapshot) => snapshot.isSyncLeader,
    );
    expect(leaders).toHaveLength(1);

    leaderA.dispose();
    leaderB.dispose();
    expect(snapshotsA.some(Boolean)).toBe(true);
    expect(snapshotsB.some(Boolean)).toBe(true);
  });

  it('allows forced leadership claim in follower tab', () => {
    const leaderA = new MatrixTabLeaderCoordinator();
    const leaderB = new MatrixTabLeaderCoordinator();
    vi.advanceTimersByTime(1_000);

    leaderB.claimSyncLeadership();
    expect(leaderB.getSnapshot().isSyncLeader).toBe(true);
    expect(leaderA.getSnapshot().isSyncLeader).toBe(false);

    leaderA.dispose();
    leaderB.dispose();
  });

  it('force claim dethrones leader even while holdLeadershipWhile is active', () => {
    const leaderA = new MatrixTabLeaderCoordinator({
      holdLeadershipWhile: () => true,
    });
    const leaderB = new MatrixTabLeaderCoordinator();
    vi.advanceTimersByTime(1_000);

    expect(leaderA.getSnapshot().isSyncLeader).toBe(true);

    leaderB.claimSyncLeadership();
    expect(leaderB.getSnapshot().isSyncLeader).toBe(true);
    expect(leaderA.getSnapshot().isSyncLeader).toBe(false);

    leaderA.dispose();
    leaderB.dispose();
  });

  it('blocks stale leadership claims while holdLeadershipWhile is active', () => {
    const leaderA = new MatrixTabLeaderCoordinator({
      holdLeadershipWhile: () => true,
    });
    const leaderB = new MatrixTabLeaderCoordinator();
    vi.advanceTimersByTime(1_000);
    expect(leaderA.getSnapshot().isSyncLeader).toBe(true);

    vi.advanceTimersByTime(8_000);
    expect(leaderA.getSnapshot().isSyncLeader).toBe(true);
    expect(leaderB.getSnapshot().isSyncLeader).toBe(false);

    leaderA.dispose();
    leaderB.dispose();
  });
});
