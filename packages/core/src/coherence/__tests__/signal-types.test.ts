import { describe, expect, it } from 'vitest';
import {
  canonicalSignalType,
  COHERENCE_SIGNAL_TYPES,
  COHERENCE_TYPE_OPTIONS,
  storedSignalTypes,
} from '../coherence-types';
import { signalTypeSchema } from '../validation';

describe('signal types', () => {
  it('keeps proof of action, impact evidence, and bug as separate types', () => {
    expect(COHERENCE_SIGNAL_TYPES).toEqual([
      'Need',
      'Resource',
      'Opportunity',
      'Insight',
      'Tension',
      'Risk',
      'Action',
      'Impact',
      'Bug',
    ]);
    const action = COHERENCE_TYPE_OPTIONS.find(
      (option) => option.type === 'Action',
    );
    const impact = COHERENCE_TYPE_OPTIONS.find(
      (option) => option.type === 'Impact',
    );
    expect(action).toMatchObject({
      title: 'Proof of Action',
      description: 'Where the money went',
    });
    expect(impact).toMatchObject({
      title: 'Impact Evidence',
      description: 'Stories and real-world outcomes',
    });
  });

  it('does not fold impact evidence into proof of action', () => {
    expect(canonicalSignalType('Impact')).toBe('Impact');
    expect(canonicalSignalType('Action')).toBe('Action');
    expect(canonicalSignalType('Bug')).toBe('Bug');
    expect(storedSignalTypes(['Action', 'Need'])).toEqual(['Action', 'Need']);
    expect(storedSignalTypes(['Impact'])).toEqual(['Impact']);
  });

  it('stores impact evidence and bug as themselves', () => {
    expect(signalTypeSchema.parse('Impact')).toBe('Impact');
    expect(signalTypeSchema.parse('Action')).toBe('Action');
    expect(signalTypeSchema.parse('Bug')).toBe('Bug');
  });
});
