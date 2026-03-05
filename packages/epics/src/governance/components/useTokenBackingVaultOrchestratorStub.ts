'use client';

/**
 * Stub for useCreateTokenBackingVaultOrchestrator.
 * Use this for UI-only demo without contract integration.
 * Replace with useCreateTokenBackingVaultOrchestrator from @hypha-platform/core/client when integrating.
 */
export function useCreateTokenBackingVaultOrchestratorStub() {
  return {
    createTokenBackingVault: async (_arg?: unknown) => {
      // No-op: form submit does nothing in UI-only mode
    },
    reset: () => {},
    currentAction: undefined as string | undefined,
    isError: false,
    isPending: false,
    progress: 0,
  };
}
