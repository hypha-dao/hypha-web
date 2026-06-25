/**
 * Canonical proposal catalog for AI discovery + form preparation.
 *
 * When adding or updating an Agreements create route, update `entries.ts`
 * and run `.agents/skills/proposal-discovery` checklist.
 */

export type ProposalCatalogSource =
  | 'create_proposal'
  | 'space_settings'
  | 'both';

/** How the AI should complete this proposal after discovery. */
export type ProposalPrepareStrategy =
  | 'prepare_governance_proposal'
  | 'create_space_setup_proposal'
  | 'navigation_only';

export type CatalogFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'percent'
  | 'address'
  | 'enum';

export type CatalogDiscoveryField = {
  key: string;
  label: string;
  required: boolean;
  description?: string;
  fieldType: CatalogFieldType;
  /** Values for enum fields — also surfaced to the model in proposal_guidance. */
  enumValues?: readonly string[];
  /** UI section id for scroll/focus walkthrough (future: auto-scroll in form). */
  formSection?: string;
};

export type ProposalCatalogEntry = {
  /** Stable snake_case key used in tools and API. */
  key: string;
  documentLabel: string;
  /** Segment after `/agreements/create/` (empty string = collective agreement root). */
  templateSegment: string;
  createPath: string;
  summary: string;
  source: ProposalCatalogSource;
  prepareStrategy: ProposalPrepareStrategy;
  /** False for DB-only flows like space configuration. */
  onChain: boolean;
  discoveryIntro: string;
  requiredFields: CatalogDiscoveryField[];
  optionalFields: CatalogDiscoveryField[];
  doNotUse: string[];
};

export type PrepareGovernanceProposalInput = {
  space_slug: string;
  proposal_type: string;
  title: string;
  description: string;
  lang?: string;
  auto_execution?: boolean;
  /** Type-specific discovery answers keyed by CatalogDiscoveryField.key */
  proposal_fields?: Record<string, unknown>;
};
