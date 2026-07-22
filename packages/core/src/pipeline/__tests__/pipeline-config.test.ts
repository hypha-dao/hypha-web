import { describe, expect, it } from 'vitest';
import {
  mergePipelineConfig,
  normalizePipelineConfig,
  normalizeProbabilityMatrix,
} from '../pipeline-config';
import { effectiveSuccessRate, PIPELINE_PROBABILITY } from '../constants';

describe('normalizeProbabilityMatrix', () => {
  it('falls back to seed defaults for missing input', () => {
    const matrix = normalizeProbabilityMatrix(undefined);
    expect(matrix).toEqual(PIPELINE_PROBABILITY);
  });

  it('keeps valid overrides and clamps out-of-range values', () => {
    const matrix = normalizeProbabilityMatrix({
      Sales: { Identified: 10, Qualified: 250, Engaged: -5 },
    });
    expect(matrix.Sales.Identified).toBe(10);
    expect(matrix.Sales.Qualified).toBe(100);
    expect(matrix.Sales.Engaged).toBe(0);
    // Untouched cells keep seed defaults.
    expect(matrix.Sales.Proposal).toBe(PIPELINE_PROBABILITY.Sales.Proposal);
    expect(matrix.Grants).toEqual(PIPELINE_PROBABILITY.Grants);
  });

  it('forces terminal stages to 100 (Won) and 0 (Lost)', () => {
    const matrix = normalizeProbabilityMatrix({
      Sales: { Won: 90, Lost: 15 },
    });
    expect(matrix.Sales.Won).toBe(100);
    expect(matrix.Sales.Lost).toBe(0);
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
    expect(merged.probabilities.Sales.Identified).toBe(15);
  });

  it('preserves probabilities when only regions are patched', () => {
    const current = normalizePipelineConfig({
      probabilities: { Investors: { Engaged: 33 } },
    });
    const merged = mergePipelineConfig(current, { regions: ['Global'] });
    expect(merged.regions).toEqual(['Global']);
    expect(merged.probabilities.Investors.Engaged).toBe(33);
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
    ).toBe(PIPELINE_PROBABILITY.Grants.Engaged);
  });
});
