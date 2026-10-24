import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIPELINE_CONFIG,
  findStageName,
  findTrackName,
  mergePipelineConfig,
  normalizePipelineConfig,
  normalizeProbabilityMatrix,
} from '../pipeline-config';
import { schemaPipelineConfig } from '../validation';
import {
  DEFAULT_PIPELINE_ITEM_PLURAL,
  DEFAULT_PIPELINE_ITEM_SINGULAR,
  DEFAULT_PIPELINE_PAGE_TITLE,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_PIPELINE_TRACKS,
  effectiveSuccessRate,
  PIPELINE_PROBABILITY,
  PIPELINE_STATUSES,
  PIPELINE_SWIMLANES,
  resolveDefaultStageSlug,
  resolveDefaultTrackSlug,
} from '../constants';

describe('normalizeProbabilityMatrix', () => {
  it('falls back to seed defaults for missing input', () => {
    const matrix = normalizeProbabilityMatrix(undefined);
    expect(matrix).toEqual(PIPELINE_PROBABILITY);
  });

  it('keeps valid overrides and clamps out-of-range values', () => {
    const matrix = normalizeProbabilityMatrix({
      Sales: { Identified: 10, Qualified: 250, Engaged: -5 },
    });
    expect(matrix.Sales?.Identified).toBe(10);
    expect(matrix.Sales?.Qualified).toBe(100);
    expect(matrix.Sales?.Engaged).toBe(0);
    // Untouched cells keep seed defaults.
    expect(matrix.Sales?.Proposal).toBe(PIPELINE_PROBABILITY.Sales.Proposal);
    expect(matrix.Grants).toEqual(PIPELINE_PROBABILITY.Grants);
  });

  it('forces terminal stages to 100 (Won) and 0 (Lost)', () => {
    const matrix = normalizeProbabilityMatrix({
      Sales: { Won: 90, Lost: 15 },
    });
    expect(matrix.Sales?.Won).toBe(100);
    expect(matrix.Sales?.Lost).toBe(0);
  });

  it('sizes the matrix to custom tracks and stages', () => {
    const matrix = normalizeProbabilityMatrix(
      { Sales: { Identified: 12 } },
      [{ slug: 'Sales', name: 'Sales', position: 0 }],
      [
        { slug: 'Identified', name: 'Identified', position: 0 },
        { slug: 'Won', name: 'Won', position: 1, terminal: 'won' },
      ],
    );
    expect(Object.keys(matrix)).toEqual(['Sales']);
    expect(matrix.Sales).toEqual({ Identified: 12, Won: 100 });
  });
});

describe('normalizePipelineConfig', () => {
  it('defaults empty storage to current stages, tracks and opportunity labels', () => {
    const config = normalizePipelineConfig({});
    expect(config.pageTitle).toBe(DEFAULT_PIPELINE_PAGE_TITLE);
    expect(config.itemSingular).toBe(DEFAULT_PIPELINE_ITEM_SINGULAR);
    expect(config.itemPlural).toBe(DEFAULT_PIPELINE_ITEM_PLURAL);
    expect(config.tracks.map((track) => track.slug)).toEqual([
      ...PIPELINE_SWIMLANES,
    ]);
    expect(config.stages.map((stage) => stage.slug)).toEqual([
      ...PIPELINE_STATUSES,
    ]);
    expect(config.probabilities).toEqual(PIPELINE_PROBABILITY);
  });

  it('keeps existing Title-Case slugs so stored deals stay valid', () => {
    const config = normalizePipelineConfig({
      tracks: DEFAULT_PIPELINE_TRACKS,
      stages: DEFAULT_PIPELINE_STAGES,
    });
    expect(config.tracks[0]?.slug).toBe('Sales');
    expect(config.stages[0]?.slug).toBe('Identified');
    expect(config.stages.find((stage) => stage.slug === 'Won')?.terminal).toBe(
      'won',
    );
  });

  it('accepts a shorter custom track and stage list', () => {
    const config = normalizePipelineConfig({
      pageTitle: 'Funding',
      itemSingular: 'Grant',
      itemPlural: 'Grants',
      tracks: [{ slug: 'Grants', name: 'Grants', position: 0 }],
      stages: [
        { slug: 'Identified', name: 'Sourced', position: 0 },
        { slug: 'Won', name: 'Awarded', position: 1, terminal: 'won' },
      ],
    });
    expect(config.pageTitle).toBe('Funding');
    expect(config.itemSingular).toBe('Grant');
    expect(config.tracks).toHaveLength(1);
    expect(config.stages).toHaveLength(2);
    expect(findStageName(config.stages, 'Identified')).toBe('Sourced');
    expect(findTrackName(config.tracks, 'Grants')).toBe('Grants');
    expect(config.probabilities.Grants?.Identified).toBe(
      PIPELINE_PROBABILITY.Grants?.Identified,
    );
    expect(config.probabilities.Grants?.Won).toBe(100);
  });
});

describe('mergePipelineConfig', () => {
  it('preserves regions when only probabilities are patched', () => {
    const current = {
      regions: ['DACH', 'Nordics'],
      defaultRegion: 'DACH',
    };
    const merged = mergePipelineConfig(current, {
      probabilities: { Sales: { Identified: 15 } },
    });
    expect(merged.regions).toEqual(['DACH', 'Nordics']);
    expect(merged.defaultRegion).toBe('DACH');
    expect(merged.probabilities.Sales?.Identified).toBe(15);
    expect(merged.tracks.map((track) => track.slug)).toEqual([
      ...PIPELINE_SWIMLANES,
    ]);
  });

  it('preserves probabilities when only regions are patched', () => {
    const current = normalizePipelineConfig({
      probabilities: { Investors: { Engaged: 33 } },
    });
    const merged = mergePipelineConfig(current, { regions: ['Global'] });
    expect(merged.regions).toEqual(['Global']);
    expect(merged.probabilities.Investors?.Engaged).toBe(33);
  });

  it('preserves labels when only tracks are patched', () => {
    const current = normalizePipelineConfig({
      pageTitle: 'Pipeline',
      itemSingular: 'Opportunity',
    });
    const merged = mergePipelineConfig(current, {
      tracks: [{ slug: 'Sales', name: 'Core sales', position: 0 }],
    });
    expect(merged.pageTitle).toBe('Pipeline');
    expect(merged.itemSingular).toBe('Opportunity');
    expect(merged.tracks).toEqual([
      { slug: 'Sales', name: 'Core sales', position: 0 },
    ]);
    expect(Object.keys(merged.probabilities)).toEqual(['Sales']);
  });
});

describe('effectiveSuccessRate', () => {
  const matrix = normalizeProbabilityMatrix({ Sales: { Proposal: 45 } });

  it('uses the deal override when set', () => {
    expect(
      effectiveSuccessRate(
        {
          successRate: 80,
          pipelineSwimlane: 'Sales',
          pipelineStatus: 'Proposal',
        },
        matrix,
      ),
    ).toBe(80);
  });

  it('falls back to the configured stage default', () => {
    expect(
      effectiveSuccessRate(
        {
          successRate: null,
          pipelineSwimlane: 'Sales',
          pipelineStatus: 'Proposal',
        },
        matrix,
      ),
    ).toBe(45);
  });

  it('falls back to seed defaults without a matrix', () => {
    expect(
      effectiveSuccessRate({
        successRate: null,
        pipelineSwimlane: 'Grants',
        pipelineStatus: 'Engaged',
      }),
    ).toBe(PIPELINE_PROBABILITY.Grants?.Engaged);
  });
});

describe('default slugs', () => {
  it('picks the first open stage and first track', () => {
    expect(resolveDefaultTrackSlug(DEFAULT_PIPELINE_CONFIG.tracks)).toBe(
      'Sales',
    );
    expect(resolveDefaultStageSlug(DEFAULT_PIPELINE_CONFIG.stages)).toBe(
      'Identified',
    );
  });
});

describe('schemaPipelineConfig', () => {
  it('rejects a pipeline that has only terminal stages', () => {
    const result = schemaPipelineConfig.safeParse({
      stages: [
        { slug: 'Won', name: 'Won', terminal: 'won' },
        { slug: 'Lost', name: 'Lost', terminal: 'lost' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === 'stages'),
      ).toBe(true);
    }
  });
});
