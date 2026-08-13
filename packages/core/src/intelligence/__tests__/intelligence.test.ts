import { describe, expect, it } from 'vitest';
import {
  parseIntelligenceMarkdown,
  serializeIntelligenceMarkdown,
} from '../parse-markdown';
import { buildIntelligenceRelatedGraph } from '../graph';
import {
  artifactCurrentPath,
  spaceManifestPath,
  spaceIntelligencePrefix,
} from '../paths';
import type { IntelligenceManifestEntry } from '../types';

const SAMPLE = `---
id: stakeholder-assessment-belica-2026-07
type: assessment
title: Stakeholder Assessment — Belica 5.0
space: belica-5-0
source_app: stakeholder-protocol
status: current
created_at: 2026-07-18
updated_at: 2026-07-18
tags:
  - stakeholders
  - governance
related:
  - case-study-belica
version: 1
supersedes: null
---

# Stakeholder Assessment

The village board is an anchor ally.
`;

describe('intelligence paths', () => {
  it('builds space-scoped private prefix', () => {
    expect(spaceIntelligencePrefix('belica-5-0')).toBe(
      'intelligence/spaces/belica-5-0/',
    );
    expect(spaceManifestPath('belica-5-0')).toBe(
      'intelligence/spaces/belica-5-0/_manifest.json',
    );
    expect(
      artifactCurrentPath({
        spaceSlug: 'belica-5-0',
        type: 'assessment',
        id: 'stakeholder-assessment-belica-2026-07',
      }),
    ).toBe(
      'intelligence/spaces/belica-5-0/assessments/stakeholder-assessment-belica-2026-07.md',
    );
  });

  it('rejects unsafe slugs', () => {
    expect(() => spaceIntelligencePrefix('../etc')).toThrow();
  });
});

describe('parseIntelligenceMarkdown', () => {
  it('parses core frontmatter and body', () => {
    const parsed = parseIntelligenceMarkdown(SAMPLE);
    expect(parsed.frontmatter.id).toBe('stakeholder-assessment-belica-2026-07');
    expect(parsed.frontmatter.type).toBe('assessment');
    expect(parsed.frontmatter.related).toEqual(['case-study-belica']);
    expect(parsed.body).toContain('village board');
    expect(parsed.sha).toMatch(/^[a-f0-9]{64}$/);
  });

  it('round-trips serialize → parse', () => {
    const once = parseIntelligenceMarkdown(SAMPLE);
    const raw = serializeIntelligenceMarkdown({
      frontmatter: once.frontmatter,
      body: once.body,
    });
    const twice = parseIntelligenceMarkdown(raw);
    expect(twice.frontmatter).toEqual(once.frontmatter);
    expect(twice.sha).toBe(once.sha);
  });
});

describe('buildIntelligenceRelatedGraph', () => {
  it('links related artifacts and marks missing targets', () => {
    const artifacts: IntelligenceManifestEntry[] = [
      {
        id: 'a',
        type: 'assessment',
        title: 'A',
        space: 'demo',
        status: 'current',
        tags: [],
        related: ['b', 'missing-x'],
        source_app: 'hypha',
        path: 'intelligence/spaces/demo/assessments/a.md',
        sha: 'abc1234',
        version: 1,
        updated_at: '2026-07-18',
      },
      {
        id: 'b',
        type: 'context',
        title: 'B',
        space: 'demo',
        status: 'current',
        tags: [],
        related: [],
        source_app: 'hypha',
        path: 'intelligence/spaces/demo/context/b.md',
        sha: 'def5678',
        version: 1,
        updated_at: '2026-07-18',
      },
    ];
    const graph = buildIntelligenceRelatedGraph(artifacts);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes.find((n) => n.id === 'missing-x')?.kind).toBe(
      'related-missing',
    );
  });
});
