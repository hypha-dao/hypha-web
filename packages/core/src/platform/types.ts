export type PayingSpaceMonthSpacePoint = {
  web3SpaceId: number;
  paying: boolean;
  paymentCount: number;
  paymentUsd: number;
};

export type PayingSpaceMonthBucket = {
  month: string;
  payingSpaces: number;
  paymentCount: number;
  paymentUsd: number;
  spaces: PayingSpaceMonthSpacePoint[];
};

export type PayingSpaceStatus = {
  web3SpaceId: number;
  spaceId: number | null;
  slug: string | null;
  title: string;
  currentlyPaying: boolean;
  hasPaid: boolean;
  expiryTime: number | null;
  freeTrialUsed: boolean;
};

export type PayingSpacesDashboardData = {
  generatedAt: string;
  fromMonth: string | null;
  summary: {
    currentlyPaying: number;
    everPaid: number;
    trackedSpaces: number;
    paymentEvents: number;
    paymentUsd: number;
  };
  monthly: PayingSpaceMonthBucket[];
  spaces: PayingSpaceStatus[];
};
