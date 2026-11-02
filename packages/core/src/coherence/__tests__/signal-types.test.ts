import { describe, expect, it } from 'vitest';
import {
  canonicalSignalType,
  COHERENCE_SIGNAL_TYPES,
  storedSignalTypes,
} from '../coherence-types';
import { signalTypeSchema } from '../validation';

describe('signal types', () => {
  it('keeps proof of action and adds bug, without a separate impact type', () => {
    expect(COHERENCE_SIGNAL_TYPES).toContain('Action');
    expect(COHERENCE_SIGNAL_TYPES).toContain('Bug');
    expect(COHERENCE_SIGNAL_TYPES).not.toContain('Impact');
  });

  it('reads a stored impact evidence signal as proof of action', () => {
    expect(canonicalSignalType('Impact')).toBe('Action');
    expect(canonicalSignalType('Bug')).toBe('Bug');
    expect(storedSignalTypes(['Action', 'Need'])).toEqual([
      'Action',
      'Impact',
      'Need',
    ]);
  });

  it('stores a legacy impact evidence write as proof of action', () => {
    expect(signalTypeSchema.parse('Impact')).toBe('Action');
    expect(signalTypeSchema.parse('Bug')).toBe('Bug');
  });
});
