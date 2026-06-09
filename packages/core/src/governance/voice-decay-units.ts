/**
 * DecayingSpaceToken stores `decayPercentage` as basis points (10000 = 100%).
 * The UI uses whole-number percent (1–100). Convert at the chain boundary only.
 */
export const DECAY_BASIS_POINTS = 10_000;

/** Form / DB percent (1–100) → uint256 arg for `setDecayPercentage` / deploy. */
export function decayPercentToBasisPoints(percent: number): number {
  if (!Number.isFinite(percent)) {
    throw new RangeError('decay percent must be finite');
  }
  const bp = Math.round(percent * 100);
  if (bp < 1 || bp > DECAY_BASIS_POINTS) {
    throw new RangeError(
      `decay percent out of range for chain (expected 1–100% → 1–${DECAY_BASIS_POINTS} bp)`,
    );
  }
  return bp;
}

/** On-chain basis points → form percent for display / RHF (100 bp = 1%). */
export function decayBasisPointsToFormPercent(basisPoints: number): number {
  if (!Number.isFinite(basisPoints) || basisPoints <= 0) {
    return 1;
  }
  return Math.min(100, Math.max(1, Math.round(basisPoints / 100)));
}
