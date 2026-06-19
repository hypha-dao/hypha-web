import { describe, expect, it } from 'vitest';
import {
  isAnsweredLocationStep,
  isSkippedLocationAnswer,
} from '../onboarding-location';

describe('onboarding location helpers', () => {
  it('treats skip answers as answered location step', () => {
    expect(isSkippedLocationAnswer('skip')).toBe(true);
    expect(isAnsweredLocationStep('prefer not to add a location')).toBe(true);
  });

  it('accepts concrete place names', () => {
    expect(isAnsweredLocationStep('Lisbon, Portugal')).toBe(true);
    expect(isSkippedLocationAnswer('Lisbon, Portugal')).toBe(false);
  });
});
