'use client';

const WALLET_SESSION_ACTIVE_KEY = 'hypha:onboarding-wallet-session:active:v1';

export function isOnboardingWalletSessionActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(WALLET_SESSION_ACTIVE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingWalletSessionActive(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(WALLET_SESSION_ACTIVE_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

export function clearOnboardingWalletSessionActive(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(WALLET_SESSION_ACTIVE_KEY);
  } catch {
    // ignore
  }
}
