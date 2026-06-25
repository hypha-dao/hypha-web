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

  it('accepts structured map selections and explicit skips', () => {
    expect(
      isAnsweredLocationStep({
        latitude: 18.1851,
        longitude: -77.3948,
        locationLabel: 'Jamaica',
        locationSource: 'geocode',
      }),
    ).toBe(true);
    expect(isAnsweredLocationStep({ skipped: true })).toBe(true);
  });

  it('does not treat plain place names as answered without the map UI', () => {
    expect(isAnsweredLocationStep('Lisbon, Portugal')).toBe(false);
    expect(isAnsweredLocationStep('Jamaica')).toBe(false);
    expect(isSkippedLocationAnswer('Lisbon, Portugal')).toBe(false);
  });

  it('does not treat place names containing "skip" as skipped', () => {
    expect(isSkippedLocationAnswer('Skippack, Pennsylvania')).toBe(false);
    expect(isAnsweredLocationStep('Skippack, Pennsylvania')).toBe(false);
  });
});
