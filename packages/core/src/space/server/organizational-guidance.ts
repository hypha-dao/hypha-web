import { sql } from 'drizzle-orm';
import { spaces } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';

export type EcosystemSpaceRole =
  | 'community_hub'
  | 'core_team'
  | 'functional_domain'
  | 'liquidity_bridge'
  | 'ip_registry'
  | 'governance'
  | 'other';

export type NetworkEcosystemSample = {
  root_slug: string;
  root_title: string;
  space_count: number;
  child_titles: string[];
  categories: string[];
  inferred_roles: EcosystemSpaceRole[];
};

export type NetworkEcosystemPatterns = {
  sampled_ecosystem_count: number;
  total_ecosystems_with_children: number;
  average_child_count: number;
  common_role_counts: Partial<Record<EcosystemSpaceRole, number>>;
  frequent_child_title_keywords: string[];
  samples: NetworkEcosystemSample[];
};

export type OrganisationBlueprintNode = {
  key: string;
  role: EcosystemSpaceRole;
  title: string;
  description: string;
  status: 'planned';
  inspired_by?: string[];
};

export type OrganisationBlueprint = {
  root_slug: string;
  root_title: string;
  nodes: OrganisationBlueprintNode[];
  network_context: {
    sampled_ecosystem_count: number;
    frequent_child_title_keywords: string[];
  };
};

const ROLE_KEYWORDS: Array<{ role: EcosystemSpaceRole; patterns: RegExp[] }> = [
  {
    role: 'governance',
    patterns: [/\bgovern/i, /\bcouncil/i, /\bdao\b/i, /\bvoting/i],
  },
  {
    role: 'liquidity_bridge',
    patterns: [/\btreasury/i, /\bliquidity/i, /\bfinance/i, /\bfund/i],
  },
  {
    role: 'community_hub',
    patterns: [/\bcommunity/i, /\bhub/i, /\bpublic/i, /\bopen\b/i],
  },
  {
    role: 'core_team',
    patterns: [/\bcore\b/i, /\bteam/i, /\bops\b/i, /\boperations/i],
  },
  {
    role: 'ip_registry',
    patterns: [/\bip\b/i, /\bintellectual/i, /\blegal/i, /\bregistry/i],
  },
  {
    role: 'functional_domain',
    patterns: [
      /\bgrowth/i,
      /\bmarketing/i,
      /\beducation/i,
      /\bmedia/i,
      /\btech/i,
      /\bproduct/i,
      /\bdesign/i,
    ],
  },
];

function inferRoleFromTitle(title: string): EcosystemSpaceRole {
  for (const entry of ROLE_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(title))) {
      return entry.role;
    }
  }
  return 'other';
}

function parseCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === 'string');
}

function extractTitleKeywords(titles: string[]): string[] {
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'space',
    'team',
    'hub',
    'dao',
    'org',
    'organisation',
    'organization',
  ]);
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const token of title.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length < 3 || stopWords.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);
}

function slugifyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

type GetNetworkEcosystemPatternsInput = {
  limit?: number;
  minChildCount?: number;
  omitSandbox?: boolean;
};

export async function getNetworkEcosystemPatterns(
  {
    limit = 40,
    minChildCount = 2,
    omitSandbox = true,
  }: GetNetworkEcosystemPatternsInput,
  { db }: DbConfig,
): Promise<NetworkEcosystemPatterns> {
  const query = sql`
WITH RECURSIVE org_tree AS (
  SELECT
    id,
    id AS root_id,
    slug,
    title,
    categories,
    flags,
    parent_id,
    0 AS depth
  FROM ${spaces}
  WHERE parent_id IS NULL
    AND is_archived = false
    AND NOT (COALESCE(flags, '[]'::jsonb) @> '["archived"]'::jsonb)
  UNION ALL
  SELECT
    s.id,
    ot.root_id,
    s.slug,
    s.title,
    s.categories,
    s.flags,
    s.parent_id,
    ot.depth + 1
  FROM ${spaces} s
  INNER JOIN org_tree ot ON s.parent_id = ot.id
  WHERE s.is_archived = false
    AND NOT (COALESCE(s.flags, '[]'::jsonb) @> '["archived"]'::jsonb)
)
SELECT
  root_id,
  MAX(CASE WHEN depth = 0 THEN slug END) AS root_slug,
  MAX(CASE WHEN depth = 0 THEN title END) AS root_title,
  MAX(CASE WHEN depth = 0 THEN categories END) AS root_categories,
  COUNT(*) FILTER (WHERE depth > 0) AS child_count,
  ARRAY_AGG(title ORDER BY depth, title) FILTER (WHERE depth > 0) AS child_titles
FROM org_tree
GROUP BY root_id
HAVING COUNT(*) FILTER (WHERE depth > 0) >= ${minChildCount}
ORDER BY child_count DESC, root_title ASC
LIMIT ${limit};
`;

  const results = await db.execute(query);
  const rows = results.rows as Array<{
    root_slug: string | null;
    root_title: string | null;
    child_count: number | string | null;
    child_titles: string[] | null;
    root_categories: unknown;
  }>;

  const roleCounts: Partial<Record<EcosystemSpaceRole, number>> = {};
  const allChildTitles: string[] = [];
  const samples: NetworkEcosystemSample[] = [];

  for (const row of rows) {
    const rootSlug = row.root_slug?.trim() ?? '';
    const rootTitle = row.root_title?.trim() ?? '';
    if (!rootSlug || !rootTitle) continue;

    const childTitles = (row.child_titles ?? []).filter(Boolean);
    if (omitSandbox) {
      // Root sandbox ecosystems are still useful patterns; keep all for now.
    }

    const inferredRoles = childTitles.map((title) => inferRoleFromTitle(title));
    for (const role of inferredRoles) {
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }
    allChildTitles.push(...childTitles);

    samples.push({
      root_slug: rootSlug,
      root_title: rootTitle,
      space_count: Number(row.child_count ?? 0) + 1,
      child_titles: childTitles,
      categories: parseCategories(row.root_categories),
      inferred_roles: inferredRoles,
    });
  }

  const childCounts = samples.map((sample) => sample.space_count - 1);
  const averageChildCount =
    childCounts.length > 0
      ? childCounts.reduce((sum, count) => sum + count, 0) / childCounts.length
      : 0;

  return {
    sampled_ecosystem_count: samples.length,
    total_ecosystems_with_children: samples.length,
    average_child_count: Math.round(averageChildCount * 10) / 10,
    common_role_counts: roleCounts,
    frequent_child_title_keywords: extractTitleKeywords(allChildTitles),
    samples,
  };
}

type ProposeOrganisationBlueprintInput = {
  organisation_name: string;
  purpose: string;
  root_slug: string;
  functional_domains?: string[];
  include_liquidity_bridge?: boolean;
  include_ip_registry?: boolean;
  include_governance_space?: boolean;
  pattern_limit?: number;
};

export async function proposeOrganisationBlueprint(
  input: ProposeOrganisationBlueprintInput,
  { db }: DbConfig,
): Promise<OrganisationBlueprint> {
  const patterns = await getNetworkEcosystemPatterns(
    { limit: input.pattern_limit ?? 40, minChildCount: 2 },
    { db },
  );

  const rootSlug =
    slugifyKey(input.root_slug) || slugifyKey(input.organisation_name);
  const nodes: OrganisationBlueprintNode[] = [
    {
      key: `${rootSlug}-community`,
      role: 'community_hub',
      title: 'Community Hub',
      description:
        'Open collaboration space for contributors, members, and public coordination.',
      status: 'planned',
      inspired_by: findInspiredBy(patterns.samples, 'community_hub'),
    },
    {
      key: `${rootSlug}-core-team`,
      role: 'core_team',
      title: 'Core Team',
      description:
        'Operator space for day-to-day execution, staffing, and internal decisions.',
      status: 'planned',
      inspired_by: findInspiredBy(patterns.samples, 'core_team'),
    },
  ];

  const domains =
    input.functional_domains && input.functional_domains.length > 0
      ? input.functional_domains
      : inferDefaultDomains(patterns);

  for (const domain of domains) {
    const domainKey = slugifyKey(`${rootSlug}-${domain}`);
    nodes.push({
      key: domainKey || `${rootSlug}-domain`,
      role: 'functional_domain',
      title: `${domain} Domain`,
      description: `Functional domain for ${domain.toLowerCase()} proposals, agreements, and stewardship.`,
      status: 'planned',
      inspired_by: findInspiredBy(patterns.samples, 'functional_domain'),
    });
  }

  if (input.include_liquidity_bridge !== false) {
    nodes.push({
      key: `${rootSlug}-liquidity-bridge`,
      role: 'liquidity_bridge',
      title: 'Liquidity Bridge',
      description:
        'Treasury coordination, token flows, and cross-space financial alignment.',
      status: 'planned',
      inspired_by: findInspiredBy(patterns.samples, 'liquidity_bridge'),
    });
  }

  if (input.include_ip_registry !== false) {
    nodes.push({
      key: `${rootSlug}-ip-registry`,
      role: 'ip_registry',
      title: 'IP Registry',
      description:
        'Intellectual property, licensing, and legal artifact governance.',
      status: 'planned',
      inspired_by: findInspiredBy(patterns.samples, 'ip_registry'),
    });
  }

  if (input.include_governance_space !== false) {
    nodes.push({
      key: `${rootSlug}-governance`,
      role: 'governance',
      title: 'Governance Council',
      description:
        'Cross-space standards, escalation, and ecosystem-wide governance.',
      status: 'planned',
      inspired_by: findInspiredBy(patterns.samples, 'governance'),
    });
  }

  return {
    root_slug: rootSlug,
    root_title: input.organisation_name.trim(),
    nodes,
    network_context: {
      sampled_ecosystem_count: patterns.sampled_ecosystem_count,
      frequent_child_title_keywords: patterns.frequent_child_title_keywords,
    },
  };
}

function findInspiredBy(
  samples: NetworkEcosystemSample[],
  role: EcosystemSpaceRole,
): string[] {
  const matches: string[] = [];
  for (const sample of samples) {
    for (let index = 0; index < sample.child_titles.length; index += 1) {
      if (sample.inferred_roles[index] !== role) continue;
      matches.push(`${sample.root_slug}/${sample.child_titles[index]}`);
      if (matches.length >= 3) return matches;
    }
  }
  return matches;
}

function inferDefaultDomains(patterns: NetworkEcosystemPatterns): string[] {
  const keywords = patterns.frequent_child_title_keywords;
  const candidates = ['Finance', 'Operations', 'Growth'];
  const fromNetwork = keywords
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return fromNetwork.length >= 2 ? fromNetwork : candidates;
}
