import type { IntelligenceCoreType, IntelligenceFrontmatter } from '../types';
import { serializeIntelligenceMarkdown } from '../parse-markdown';
import { HYPHA_ENERGY_PACK_ID, PACK_SEED_SOURCE_APP } from './ids';

export { HYPHA_ENERGY_PACK_ID, PACK_SEED_SOURCE_APP } from './ids';

export type IntelligencePackTemplateDef = {
  id: string;
  type: IntelligenceCoreType;
  title: string;
  pack_alias: string;
  tags: string[];
  related: string[];
  body: string;
};

export type IntelligencePackCatalog = {
  id: string;
  title: string;
  version: 1;
  description: string;
  ontology: string;
  templates: IntelligencePackTemplateDef[];
};

function energyTemplate(
  def: IntelligencePackTemplateDef,
): IntelligencePackTemplateDef {
  return def;
}

/** Minimum viable eight Energy ontology starters (not the full ART-01…19 set). */
export const HYPHA_ENERGY_TEMPLATES: IntelligencePackTemplateDef[] = [
  energyTemplate({
    id: 'energy-identity-strategic-intent',
    type: 'context',
    title: 'Identity & Strategic Intent',
    pack_alias: 'ART-01',
    tags: ['hypha-energy', 'identity', 'strategy'],
    related: ['energy-community-profile', 'energy-governance-charter'],
    body: `# Identity & Strategic Intent

Starter template — fill with this space's purpose, not production data.

## Who we are

- Community / organization name:
- Geography / service area:
- Mandate in one paragraph:

## Strategic intent (3–5 years)

- Outcomes we are organizing energy around:
- What we will not do:

## Success signals

- How we will know this identity still fits:
`,
  }),
  energyTemplate({
    id: 'energy-community-profile',
    type: 'assessment',
    title: 'Community Energy Profile',
    pack_alias: 'ART-02',
    tags: ['hypha-energy', 'community', 'demand'],
    related: ['energy-identity-strategic-intent', 'energy-stakeholder-map'],
    body: `# Community Energy Profile

Starter template for demand, resources, and constraints.

## Demand snapshot

- Current energy uses (heat, power, mobility, productive):
- Seasonal peaks:

## Local resources

- Generation, storage, efficiency, or fuel options already in play:
- Gaps:

## Equity and access

- Who is underserved today:
`,
  }),
  energyTemplate({
    id: 'energy-stakeholder-map',
    type: 'assessment',
    title: 'Stakeholder Map',
    pack_alias: 'ART-03',
    tags: ['hypha-energy', 'stakeholders', 'governance'],
    related: ['energy-community-profile', 'energy-anchor-site-pipeline'],
    body: `# Stakeholder Map

Starter template for allies, stewards, and tensions.

## Anchor allies

- Who must stay in the room for decisions to stick:

## Operators and implementers

- Who can actually build / run / maintain:

## Contested or missing voices

- Who is affected but not represented:
`,
  }),
  energyTemplate({
    id: 'energy-anchor-site-pipeline',
    type: 'assessment',
    title: 'Anchor & Site Pipeline',
    pack_alias: 'ART-04',
    tags: ['hypha-energy', 'sites', 'pipeline'],
    related: ['energy-stakeholder-map', 'energy-project-portfolio'],
    body: `# Anchor & Site Pipeline

Starter template for places that can host projects.

## Anchor sites

| Site | Owner / steward | Why it matters | Readiness |
| --- | --- | --- | --- |
|  |  |  |  |

## Pipeline notes

- Permissions, grid, and community consent still open:
`,
  }),
  energyTemplate({
    id: 'energy-project-portfolio',
    type: 'report',
    title: 'Project Portfolio',
    pack_alias: 'ART-05',
    tags: ['hypha-energy', 'portfolio', 'projects'],
    related: ['energy-anchor-site-pipeline', 'energy-risk-register'],
    body: `# Project Portfolio

Starter template for the living set of energy projects.

## Active / proposed

| Project | Site | Stage | Owner |
| --- | --- | --- | --- |
|  |  |  |  |

## Dependencies

- Shared infrastructure, finance, or governance that several projects need:
`,
  }),
  energyTemplate({
    id: 'energy-governance-charter',
    type: 'framework',
    title: 'Governance Charter',
    pack_alias: 'ART-06',
    tags: ['hypha-energy', 'governance', 'charter'],
    related: [
      'energy-identity-strategic-intent',
      'energy-signal-inbox-decision-log',
    ],
    body: `# Governance Charter

Starter template for how this space decides about energy.

## Decision rights

- Who proposes, who advises, who decides:

## Cadence

- Review rhythm for portfolio, risk, and signals:

## Conflict

- How contested artifacts move from draft → current → superseded:
`,
  }),
  energyTemplate({
    id: 'energy-risk-register',
    type: 'assessment',
    title: 'Risk Register',
    pack_alias: 'ART-07',
    tags: ['hypha-energy', 'risk'],
    related: ['energy-project-portfolio', 'energy-community-profile'],
    body: `# Risk Register

Starter template — capture risks, not a finished assessment.

## Risks

| Risk | Likelihood | Impact | Owner | Mitigation |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Watch items

- External dependencies (policy, grid, finance, weather):
`,
  }),
  energyTemplate({
    id: 'energy-signal-inbox-decision-log',
    type: 'decision',
    title: 'Signal Inbox / Decision Log',
    pack_alias: 'ART-08',
    tags: ['hypha-energy', 'signals', 'decisions'],
    related: ['energy-governance-charter', 'energy-identity-strategic-intent'],
    body: `# Signal Inbox / Decision Log

Starter template linking Coherence signals to memory.

## Inbox

- Incoming signals that should patch an intelligence artifact:

## Decisions

| Date | Decision | Related artifact | Signal |
| --- | --- | --- | --- |
|  |  |  |  |

Fill \`linked_signals\` in frontmatter when a signal informed a change.
`,
  }),
];

export const HYPHA_ENERGY_ONTOLOGY = `# Hypha Energy Org Memory — MVP pack

This pack seeds **eight starter artifacts** (ART-01…08). It is not the full Energy ontology (ART-01…19).

Templates are empty on purpose: members and IBAs fill meaning; Hypha does not auto-fill production data.

| Alias | Slug-id | Type |
| --- | --- | --- |
| ART-01 | energy-identity-strategic-intent | context |
| ART-02 | energy-community-profile | assessment |
| ART-03 | energy-stakeholder-map | assessment |
| ART-04 | energy-anchor-site-pipeline | assessment |
| ART-05 | energy-project-portfolio | report |
| ART-06 | energy-governance-charter | framework |
| ART-07 | energy-risk-register | assessment |
| ART-08 | energy-signal-inbox-decision-log | decision |

Enabling the pack for a space copies starters into \`intelligence/spaces/{slug}/…\` as \`status: draft\` with \`source_app: pack-seed\`.
`;

export const HYPHA_ENERGY_PACK: IntelligencePackCatalog = {
  id: HYPHA_ENERGY_PACK_ID,
  title: 'Hypha Energy Intelligence Pack',
  version: 1,
  description:
    'Eight starter artifacts for community energy identity, sites, portfolio, governance, and signal-driven decisions.',
  ontology: HYPHA_ENERGY_ONTOLOGY,
  templates: HYPHA_ENERGY_TEMPLATES,
};

export function getIntelligencePackCatalog(
  packId: string,
): IntelligencePackCatalog | null {
  if (packId === HYPHA_ENERGY_PACK_ID) return HYPHA_ENERGY_PACK;
  return null;
}

export function listIntelligencePackCatalogs(): IntelligencePackCatalog[] {
  return [HYPHA_ENERGY_PACK];
}

export function renderPackTemplateMarkdown(input: {
  template: IntelligencePackTemplateDef;
  packId: string;
  spaceSlug: string;
  today?: string;
}): string {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const frontmatter: IntelligenceFrontmatter = {
    id: input.template.id,
    type: input.template.type,
    title: input.template.title,
    space: input.spaceSlug,
    source_app: PACK_SEED_SOURCE_APP,
    status: 'draft',
    created_at: today,
    updated_at: today,
    tags: input.template.tags,
    related: input.template.related,
    version: 1,
    supersedes: null,
    pack_id: input.packId,
    pack_alias: input.template.pack_alias,
    maturity: 'starter',
    linked_signals: [],
  };
  return serializeIntelligenceMarkdown({
    frontmatter,
    body: input.template.body,
  });
}
