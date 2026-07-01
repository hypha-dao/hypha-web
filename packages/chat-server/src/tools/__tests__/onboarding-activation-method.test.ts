import { describe, expect, it } from 'vitest';

import { isAnsweredActivationMethod } from '../onboarding-activation-method';

describe('isAnsweredActivationMethod', () => {
  it('accepts structured activation values and card submit messages', () => {
    expect(isAnsweredActivationMethod('sandbox')).toBe(true);
    expect(isAnsweredActivationMethod('pilot')).toBe(true);
    expect(isAnsweredActivationMethod('deployment')).toBe(true);
    expect(isAnsweredActivationMethod('Activation mode: Sandbox Mode')).toBe(
      true,
    );
    expect(isAnsweredActivationMethod('Activation mode: Pilot Mode')).toBe(
      true,
    );
    expect(isAnsweredActivationMethod('Activation mode: Live Mode')).toBe(true);
    expect(isAnsweredActivationMethod('Sandbox Mode')).toBe(true);
    expect(isAnsweredActivationMethod('Pilot Mode')).toBe(true);
    expect(isAnsweredActivationMethod('Live Mode')).toBe(true);
  });

  it('rejects entry method answers and loose purpose text', () => {
    expect(isAnsweredActivationMethod('open access')).toBe(false);
    expect(isAnsweredActivationMethod('Entry method: Open access')).toBe(false);
    expect(isAnsweredActivationMethod('invite only')).toBe(false);
    expect(isAnsweredActivationMethod('token based')).toBe(false);
    expect(
      isAnsweredActivationMethod('A community for live music events'),
    ).toBe(false);
    expect(
      isAnsweredActivationMethod('We want to deploy funds carefully'),
    ).toBe(false);
    expect(isAnsweredActivationMethod('go live soon')).toBe(false);
  });
});
