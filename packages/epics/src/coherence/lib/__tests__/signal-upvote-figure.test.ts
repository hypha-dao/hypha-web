import { describe, expect, it } from 'vitest';
import { formatUnits } from 'viem';
import {
  formatVotingPowerCompact,
  formatVotingPowerExact,
} from '../../utils/format-voting-power';
import { signalUpvoteFigureFontPx } from '../../utils/signal-upvote-figure';

describe('signalUpvoteFigureFontPx', () => {
  it('keeps short figures, including 1.5M, at the full 16px size', () => {
    expect(signalUpvoteFigureFontPx('0')).toBe(16);
    expect(signalUpvoteFigureFontPx('1.5M')).toBe(16);
    expect(signalUpvoteFigureFontPx('12.4K')).toBe(16);
    expect(signalUpvoteFigureFontPx('694.3K')).toBe(16);
    expect(signalUpvoteFigureFontPx('561.7K')).toBe(16);
    expect(signalUpvoteFigureFontPx('515.9K')).toBe(16);
    expect(signalUpvoteFigureFontPx('510.4K')).toBe(16);
  });

  it('shrinks longer locale and count strings without changing the characters', () => {
    const spanish = '694,3 mil';
    const count = '1,234,567';
    expect(signalUpvoteFigureFontPx(spanish)).toBeLessThan(16);
    expect(signalUpvoteFigureFontPx(count)).toBeLessThan(16);
    expect(signalUpvoteFigureFontPx(spanish)).toBeGreaterThanOrEqual(8);
    expect(spanish).toBe('694,3 mil');
    expect(count).toBe('1,234,567');
  });
});

describe('formatVotingPowerExact', () => {
  it('keeps the compact figure and exposes the unrounded units', () => {
    const raw = formatUnits(694300n * 10n ** 18n, 18);
    expect(raw).toBe('694300');
    const decimals = 18;
    const wei = (694300n * 10n ** 18n).toString();
    expect(formatVotingPowerCompact(wei, decimals, 'en')).toBe('694.3K');
    expect(formatVotingPowerExact(wei, decimals, 'en')).toBe('694,300');
    expect(formatVotingPowerExact(wei, decimals, 'de')).toContain('694');
  });
});
