export const INTELLIGENCE_ROOT = 'intelligence' as const;

export const INTELLIGENCE_CORE_TYPES = [
  'context',
  'signal',
  'assessment',
  'insight',
  'recommendation',
  'decision',
  'proposal',
  'report',
  'framework',
] as const;

export type IntelligenceCoreType = (typeof INTELLIGENCE_CORE_TYPES)[number];

export const INTELLIGENCE_STATUSES = [
  'draft',
  'current',
  'contested',
  'superseded',
  'archived',
] as const;

export type IntelligenceStatus = (typeof INTELLIGENCE_STATUSES)[number];

/** Folder segment under spaces/{slug}/ for a core type (pluralized path). */
export const INTELLIGENCE_TYPE_FOLDERS: Record<IntelligenceCoreType, string> = {
  context: 'context',
  signal: 'signals',
  assessment: 'assessments',
  insight: 'insights',
  recommendation: 'recommendations',
  decision: 'decisions',
  proposal: 'proposals',
  report: 'reports',
  framework: 'frameworks',
};

export type IntelligenceFrontmatter = {
  id: string;
  type: string;
  title: string;
  space: string;
  source_app: string;
  status: IntelligenceStatus;
  created_at: string;
  updated_at: string;
  tags: string[];
  related: string[];
  version: number;
  supersedes: string | null;
};

export type IntelligenceManifestEntry = {
  id: string;
  type: string;
  title: string;
  space: string;
  status: IntelligenceStatus;
  tags: string[];
  related: string[];
  source_app: string;
  path: string;
  sha: string;
  version: number;
  updated_at: string;
};

export type IntelligenceManifest = {
  version: 1;
  space: string;
  updated_at: string;
  artifacts: IntelligenceManifestEntry[];
};

export type IntelligenceArtifact = {
  frontmatter: IntelligenceFrontmatter;
  body: string;
  /** Full markdown including frontmatter. */
  raw: string;
  path: string;
  sha: string;
};
