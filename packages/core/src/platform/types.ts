export type PlatformDashboardData = {
  generatedAt: string;
  payingSpaces: {
    summary: {
      totalSpaces: number;
      hyphaPaidSpaces: number;
      activePaidSpaces: number;
      expiredPaidSpaces: number;
      freeTrialOnly: number;
      totalHyphaBurned: string;
      paymentEventsInRange: number;
    };
    monthly: Array<{
      month: string;
      paymentCount: number;
      spacesActivated: number;
      totalHypha: string;
    }>;
    spaces: Array<{
      spaceId: number;
      web3SpaceId: number;
      slug: string;
      title: string;
      hasPaidWithHypha: boolean;
      isActive: boolean;
      expiryTime: number | null;
      freeTrialUsed: boolean;
      totalHyphaPaid: string;
    }>;
  };
  assets: {
    totalBalanceUsd: number;
    spaceCount: number;
    spaces: Array<{
      spaceId: number;
      slug: string;
      title: string;
      balanceUsd: number;
      assetCount: number;
      topAssets: Array<{
        symbol: string;
        name: string;
        value: number;
        usdEqual: number;
      }>;
    }>;
  };
  signals: {
    summary: {
      totalSignals: number;
      createdLast24h: number;
      createdLast7d: number;
      spacesWithSignals: number;
    };
    byType: Array<{ type: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
    bySpace: Array<{
      spaceId: number | null;
      slug: string;
      title: string;
      count: number;
    }>;
    orchestrator: {
      queue_pending: number;
      queue_failed: number;
      signals_emitted_last_24h: number;
      relays_emitted_last_24h: number;
      latest_errors: Array<{
        queue_id: number;
        space_id: number;
        error: string | null;
        updated_at: string;
      }>;
    };
  };
  spaceMemory: {
    summary: {
      spacesWithChat: number;
      summariesTotal: number;
      transcriptsTotal: number;
      recordingsTotal: number;
      summariesLast24h: number;
      summariesLast7d: number;
    };
    bySpace: {
      summaries: Array<{
        spaceId: number;
        slug: string;
        title: string;
        count: number;
      }>;
      transcripts: Array<{
        spaceId: number;
        slug: string;
        title: string;
        count: number;
      }>;
      recordings: Array<{
        spaceId: number;
        slug: string;
        title: string;
        count: number;
      }>;
    };
  };
};

export type SpaceOverviewSignalsData = {
  found: boolean;
  space_slug: string;
  asOf: string;
  summary: {
    totalSignals: number;
    createdLast24h: number;
    createdLast7d: number;
  };
  byType: Array<{ type: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  weekly: Array<{ week: string; count: number }>;
  orchestrator: {
    queue_pending: number;
    queue_failed: number;
    signals_emitted_last_24h: number;
    relays_emitted_last_24h: number;
  };
};

export type SpaceOverviewMemoryData = {
  found: boolean;
  space_slug: string;
  asOf: string;
  summary: {
    hasChat: boolean;
    summariesTotal: number;
    transcriptsTotal: number;
    recordingsTotal: number;
    summariesLast24h: number;
    summariesLast7d: number;
  };
};

export type SpaceOverviewFlowsData = {
  found: boolean;
  space_slug: string;
  asOf: string;
  summary: {
    totalSpaces: number;
    hyphaPaidSpaces: number;
    activePaidSpaces: number;
    expiredPaidSpaces: number;
    freeTrialOnly: number;
    totalHyphaBurned: string;
    paymentEventsInRange: number;
  };
  monthly: Array<{
    month: string;
    paymentCount: number;
    spacesActivated: number;
    totalHypha: string;
  }>;
  spaces: Array<{
    spaceId: number;
    web3SpaceId: number;
    slug: string;
    title: string;
    hasPaidWithHypha: boolean;
    isActive: boolean;
    expiryTime: number | null;
    freeTrialUsed: boolean;
    totalHyphaPaid: string;
  }>;
};
