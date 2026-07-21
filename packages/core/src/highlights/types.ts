export const HIGHLIGHTS_BLOCK_TYPES = [
  'about',
  'mission',
  'needs',
  'useOfFunds',
  'whyNow',
  'gallery',
  'location',
  'links',
  'cta',
  'stories',
] as const;

export type HighlightsBlockType = (typeof HIGHLIGHTS_BLOCK_TYPES)[number];

export type HighlightsBlockItem = {
  id: string;
  text?: string;
  imageUrl?: string;
  caption?: string;
  url?: string;
  label?: string;
};

export type HighlightsBlock = {
  id: string;
  type: HighlightsBlockType;
  order: number;
  visible: boolean;
  title?: string;
  body?: string;
  items?: HighlightsBlockItem[];
  metadata?: Record<string, unknown>;
};

export type HighlightsSupportAction = {
  id: string;
  label: 'donate' | 'invest' | 'support' | 'custom';
  customLabel?: string;
  enabled: boolean;
  destination: 'wallet' | 'iban' | 'bank_rail' | 'external_url';
  walletAddress?: string;
  bankingRail?: 'eur' | 'usd-ach' | 'usd-wire' | 'gbp' | string;
  externalUrl?: string;
  copyInstructions?: string;
};

export type HighlightsProfile = {
  published: boolean;
  publishedAt: string | null;
  summary: string | null;
  coverImageUrl: string | null;
  goalAmount: string | null;
  goalCurrency: string | null;
  blocks: HighlightsBlock[];
  supportActions: HighlightsSupportAction[];
};

export type HighlightsStory = {
  id: number;
  slug: string;
  title: string;
  description: string;
  createdAt: string;
  eventDate: string | null;
  attachments: Array<{ url: string; caption?: string }>;
};

export type HighlightsProfileResponse = {
  found: boolean;
  space: {
    slug: string;
    title: string;
    logoUrl: string | null;
    leadImage: string | null;
    locationLabel: string | null;
  };
  profile: HighlightsProfile | null;
  stories: HighlightsStory[];
  canEdit: boolean;
};

export type MarketplaceListingItem = {
  spaceSlug: string;
  spaceTitle: string;
  logoUrl: string | null;
  leadImage: string | null;
  locationLabel: string | null;
  summary: string | null;
  coverImageUrl: string | null;
  goalAmount: string | null;
  goalCurrency: string | null;
  publishedAt: string | null;
};
