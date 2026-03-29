'use client';

import React from 'react';

export type RedeemSubmitGuardState = {
  canSubmit: boolean;
  blockMessage?: string;
};

const defaultState: RedeemSubmitGuardState = { canSubmit: true };

const RedeemSubmitGuardContext = React.createContext<{
  setGuard: (state: RedeemSubmitGuardState) => void;
} | null>(null);

const RedeemSubmitGuardReaderContext =
  React.createContext<RedeemSubmitGuardState>(defaultState);

export function RedeemSubmitGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [guard, setGuard] =
    React.useState<RedeemSubmitGuardState>(defaultState);

  const setGuardStable = React.useCallback((next: RedeemSubmitGuardState) => {
    setGuard((prev) => {
      if (
        prev.canSubmit === next.canSubmit &&
        prev.blockMessage === next.blockMessage
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  return (
    <RedeemSubmitGuardContext.Provider value={{ setGuard: setGuardStable }}>
      <RedeemSubmitGuardReaderContext.Provider value={guard}>
        {children}
      </RedeemSubmitGuardReaderContext.Provider>
    </RedeemSubmitGuardContext.Provider>
  );
}

export function useRedeemSubmitGuardSetter() {
  const ctx = React.useContext(RedeemSubmitGuardContext);
  if (!ctx) {
    return () => {};
  }
  return ctx.setGuard;
}

export function useRedeemSubmitGuard(): RedeemSubmitGuardState {
  return React.useContext(RedeemSubmitGuardReaderContext) ?? defaultState;
}
