import { describe, expect, it } from 'vitest';
import {
  parseIntelligenceMarkdown,
  serializeIntelligenceMarkdown,
  stampIntelligenceSourceApp,
} from '../parse-markdown';
import {
  buildIntelligenceSignalGraph,
  graphSignalsFromCoherenceRows,
} from '../graph';
import {
  artifactCurrentPath,
  artifactPatchPath,
  frameworkPackPrefix,
  matchCallerIntelligencePath,
  spaceManifestPath,
  spaceIntelligencePrefix,
} from '../paths';
import {
  INTELLIGENCE_MARKDOWN_MAX_BYTES,
  assertIntelligenceMarkdownSize,
  resolveCanonicalSourceApp,
} from '../app-identity';
import {
  HYPHA_ENERGY_PACK_ID,
  HYPHA_ENERGY_PACK,
  HYPHA_ENERGY_TEMPLATES,
  renderPackTemplateMarkdown,
} from '../packs';
import type { IntelligenceManifestEntry } from '../types';
import {
  formatIntelligenceMarkdownError,
  manifestEntryFromFrontmatter,
  parseIntelligenceFrontmatter,
} from '../validation';
import { excerptIntelligenceBody } from '../excerpt';

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
    expect(
      artifactPatchPath({
        spaceSlug: 'belica-5-0',
        signalSlug: 'inbox-item-1',
      }),
    ).toBe('intelligence/spaces/belica-5-0/_patches/inbox-item-1.json');
    expect(frameworkPackPrefix('hypha-energy')).toBe(
      'intelligence/frameworks/hypha-energy/',
    );
  });

  it('rejects unsafe slugs', () => {
    expect(() => spaceIntelligencePrefix('../etc')).toThrow();
  });

  it('accepts matching caller .md paths and rejects traversal', () => {
    expect(
      matchCallerIntelligencePath({
        spaceSlug: 'belica-5-0',
        type: 'assessment',
        id: 'stakeholder-assessment-belica-2026-07',
      }).ok,
    ).toBe(true);
    expect(
      matchCallerIntelligencePath({
        spaceSlug: 'belica-5-0',
        type: 'assessment',
        id: 'stakeholder-assessment-belica-2026-07',
        callerPath:
          'intelligence/spaces/belica-5-0/assessments/stakeholder-assessment-belica-2026-07.md',
      }).ok,
    ).toBe(true);
    expect(
      matchCallerIntelligencePath({
        spaceSlug: 'belica-5-0',
        type: 'assessment',
        id: 'stakeholder-assessment-belica-2026-07',
        callerPath: 'intelligence/spaces/other/assessments/x.md',
      }).ok,
    ).toBe(false);
    expect(
      matchCallerIntelligencePath({
        spaceSlug: 'belica-5-0',
        type: 'assessment',
        id: 'stakeholder-assessment-belica-2026-07',
        callerPath: 'intelligence/spaces/belica-5-0/../etc/passwd.md',
      }).ok,
    ).toBe(false);
    expect(
      matchCallerIntelligencePath({
        spaceSlug: 'belica-5-0',
        type: 'assessment',
        id: 'stakeholder-assessment-belica-2026-07',
        callerPath:
          'intelligence/spaces/belica-5-0/assessments/stakeholder-assessment-belica-2026-07.json',
      }).ok,
    ).toBe(false);
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

  it('rejects executable ---js frontmatter fences', () => {
    expect(() =>
      parseIntelligenceMarkdown(`---js
module.exports = { id: 'x' }
---

body
`),
    ).toThrow(/Unsupported frontmatter fence/);
  });

  it('names missing date fields instead of a generic YAML failure', () => {
    try {
      parseIntelligenceFrontmatter({
        id: 'hypha-x-belica-5-0',
        type: 'insight',
        title: 'Hypha x Belica 5.0 Insight',
        space: 'belica-5-0',
        source_app: 'hypha-ai',
        status: 'draft',
        version: 1,
      });
      throw new Error('expected parse to fail');
    } catch (error) {
      const message = formatIntelligenceMarkdownError(error);
      expect(message).toContain('created_at');
      expect(message).toContain('updated_at');
    }
  });

  it('keeps an optional Matrix room_id on frontmatter and the manifest entry', () => {
    const frontmatter = parseIntelligenceFrontmatter({
      id: 'stakeholder-assessment-belica-2026-07',
      type: 'assessment',
      title: 'Stakeholder Assessment',
      space: 'belica-5-0',
      source_app: 'hypha',
      status: 'current',
      created_at: '2026-07-18',
      updated_at: '2026-07-18',
      tags: ['stakeholders'],
      related: [],
      version: 1,
      supersedes: null,
      room_id: '!abc:matrix.org',
    });
    expect(frontmatter.room_id).toBe('!abc:matrix.org');
    const raw = serializeIntelligenceMarkdown({
      frontmatter,
      body: 'The village board is an anchor ally.',
    });
    const parsed = parseIntelligenceMarkdown(raw);
    expect(parsed.frontmatter.room_id).toBe('!abc:matrix.org');
    const entry = manifestEntryFromFrontmatter({
      frontmatter: parsed.frontmatter,
      path: 'intelligence/spaces/belica-5-0/assessments/x.md',
      sha: parsed.sha,
    });
    expect(entry.room_id).toBe('!abc:matrix.org');
  });
});

describe('buildIntelligenceSignalGraph', () => {
  it('links artifacts to signals and ignores related ids', () => {
    const artifacts: IntelligenceManifestEntry[] = [
      {
        id: 'a',
        type: 'assessment',
        title: 'A',
        space: 'demo',
        status: 'current',
        tags: [],
        related: ['b'],
        linked_signals: ['inbox-item-1'],
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
    const graph = buildIntelligenceSignalGraph({
      artifacts,
      signals: [{ slug: 'inbox-item-1', title: 'Inbox item' }],
      patches: [
        {
          signal_slug: 'inbox-item-1',
          target_id: 'b',
          status: 'pending',
        },
      ],
    });
    expect(graph.nodes.map((n) => n.kind).sort()).toEqual([
      'artifact',
      'artifact',
      'signal',
    ]);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.some((e) => e.relation === 'linked-signal')).toBe(true);
    expect(graph.edges.some((e) => e.relation === 'proposed-patch')).toBe(true);
    expect(graph.nodes.some((n) => n.id === 'b')).toBe(true);
    const signalNode = graph.nodes.find((n) => n.kind === 'signal');
    expect(signalNode?.title).toBe('Inbox item');
    expect(signalNode?.slug).toBe('inbox-item-1');
  });

  it('includes artifacts that have no signal links', () => {
    const graph = buildIntelligenceSignalGraph({
      artifacts: [
        {
          id: 'solo',
          type: 'context',
          title: 'Solo',
          space: 'demo',
          status: 'current',
          tags: [],
          related: [],
          source_app: 'hypha',
          path: 'intelligence/spaces/demo/context/solo.md',
          sha: 'abc1234',
          version: 1,
          updated_at: '2026-07-18',
        },
      ],
    });
    expect(graph.nodes).toEqual([
      expect.objectContaining({ id: 'solo', kind: 'artifact' }),
    ]);
    expect(graph.edges).toHaveLength(0);
  });

  it('marks unknown signal slugs as missing', () => {
    const graph = buildIntelligenceSignalGraph({
      artifacts: [
        {
          id: 'a',
          type: 'assessment',
          title: 'A',
          space: 'demo',
          status: 'current',
          tags: [],
          related: [],
          linked_signals: ['ghost-signal'],
          source_app: 'hypha',
          path: 'intelligence/spaces/demo/assessments/a.md',
          sha: 'abc1234',
          version: 1,
          updated_at: '2026-07-18',
        },
      ],
    });
    expect(graph.nodes.find((n) => n.title === 'ghost-signal')?.kind).toBe(
      'signal-missing',
    );
    expect(graph.nodes.find((n) => n.slug === 'ghost-signal')?.kind).toBe(
      'signal-missing',
    );
  });

  it('resolves signal titles from slug or coh-{id} aliases', () => {
    const resolved = graphSignalsFromCoherenceRows(
      ['coh-nb3wojrgh', '42'],
      [
        {
          id: 7,
          slug: 'coh-nb3wojrgh',
          title: 'Village water repair',
        },
        {
          id: 42,
          slug: 'inbox-follow-up',
          title: 'Inbox follow-up',
        },
      ],
    );
    expect(resolved).toEqual([
      {
        slug: 'coh-nb3wojrgh',
        title: 'Village water repair',
        aliases: ['7', 'coh-7'],
      },
      {
        slug: 'inbox-follow-up',
        title: 'Inbox follow-up',
        aliases: ['42'],
      },
    ]);
    const graph = buildIntelligenceSignalGraph({
      artifacts: [
        {
          id: 'a',
          type: 'insight',
          title: 'A',
          space: 'demo',
          status: 'current',
          tags: [],
          related: [],
          linked_signals: ['coh-nb3wojrgh'],
          source_app: 'hypha',
          path: 'intelligence/spaces/demo/insights/a.md',
          sha: 'abc1234',
          version: 1,
          updated_at: '2026-07-18',
        },
      ],
      signals: resolved,
    });
    const signalNode = graph.nodes.find((node) => node.kind === 'signal');
    expect(signalNode?.title).toBe('Village water repair');
    expect(signalNode?.slug).toBe('coh-nb3wojrgh');
  });
});

describe('resolveCanonicalSourceApp', () => {
  it('stamps configured identity and rejects a mismatched claim', () => {
    expect(
      resolveCanonicalSourceApp({
        configured: 'stakeholder-protocol',
        fallback: 'hypha-mcp',
      }),
    ).toEqual({ ok: true, source_app: 'stakeholder-protocol' });
    expect(
      resolveCanonicalSourceApp({
        claimed: 'stakeholder-protocol',
        configured: 'stakeholder-protocol',
        fallback: 'hypha-mcp',
      }),
    ).toEqual({ ok: true, source_app: 'stakeholder-protocol' });
    expect(
      resolveCanonicalSourceApp({
        claimed: 'evil-app',
        configured: 'stakeholder-protocol',
        fallback: 'hypha-mcp',
      }).ok,
    ).toBe(false);
  });

  it('uses fallback when no installation identity is configured', () => {
    expect(
      resolveCanonicalSourceApp({
        fallback: 'hypha-mcp',
      }),
    ).toEqual({ ok: true, source_app: 'hypha-mcp' });
    expect(
      resolveCanonicalSourceApp({
        claimed: 'other-app',
        fallback: 'hypha-mcp',
      }).ok,
    ).toBe(false);
  });
});

describe('stampIntelligenceSourceApp', () => {
  it('overwrites source_app and changes the content SHA', () => {
    const stamped = stampIntelligenceSourceApp(SAMPLE, 'hypha-mcp');
    const parsed = parseIntelligenceMarkdown(stamped);
    expect(parsed.frontmatter.source_app).toBe('hypha-mcp');
    expect(parsed.sha).not.toBe(parseIntelligenceMarkdown(SAMPLE).sha);
  });
});

describe('assertIntelligenceMarkdownSize', () => {
  it('rejects payloads over the byte cap', () => {
    expect(() => assertIntelligenceMarkdownSize(SAMPLE)).not.toThrow();
    const oversized = 'x'.repeat(INTELLIGENCE_MARKDOWN_MAX_BYTES + 1);
    expect(() => assertIntelligenceMarkdownSize(oversized)).toThrow(/exceeds/);
  });
});

describe('hypha energy pack', () => {
  it('renders eight unique starters with pack-seed provenance', () => {
    const ids = HYPHA_ENERGY_TEMPLATES.map((template) => template.id);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(HYPHA_ENERGY_PACK.title).toBe('Hypha Energy Intelligence Pack');

    for (const template of HYPHA_ENERGY_TEMPLATES) {
      const markdown = renderPackTemplateMarkdown({
        template,
        packId: HYPHA_ENERGY_PACK_ID,
        spaceSlug: 'belica-5-0',
        today: '2026-08-13',
      });
      const parsed = parseIntelligenceMarkdown(markdown);
      expect(parsed.frontmatter.space).toBe('belica-5-0');
      expect(parsed.frontmatter.source_app).toBe('pack-seed');
      expect(parsed.frontmatter.status).toBe('draft');
      expect(parsed.frontmatter.pack_id).toBe('hypha-energy');
      expect(parsed.frontmatter.pack_alias).toMatch(/^ART-0[1-8]$/);
      expect(parsed.body.length).toBeGreaterThan(40);
    }
  });
});

describe('excerptIntelligenceBody', () => {
  it('strips markdown to a plain-text card preview', () => {
    expect(
      excerptIntelligenceBody(
        '# Hello\n\nA **bold** [link](http://x) and `code`.',
      ),
    ).toBe('Hello A bold link and code.');
  });

  it('drops fenced code and truncates long bodies', () => {
    expect(excerptIntelligenceBody('```js\nconst x = 1\n```\nVisible')).toBe(
      'Visible',
    );
    expect(excerptIntelligenceBody('a'.repeat(400)).endsWith('…')).toBe(false);
    const long = excerptIntelligenceBody('a'.repeat(700));
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(561);
  });
});
