// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaleDeploymentError } from '../stale-deployment';

const web2 = vi.hoisted(() => ({
  createAgreement: vi.fn(),
  deleteAgreementBySlug: vi.fn(),
  updateAgreementBySlug: vi.fn(),
  resetCreateAgreementMutation: vi.fn(),
  createdAgreement: null as { id?: number; slug?: string | null } | null,
  errorCreateAgreementMutation: null,
}));

const web3 = vi.hoisted(() => ({
  createAgreement: vi.fn(),
  resetCreateAgreementMutation: vi.fn(),
  createdAgreement: null as { proposalId?: number } | null,
  errorCreateAgreement: null,
  errorWaitAgreementFromTransaction: null,
}));

vi.mock('../hooks/useAgreementMutations.web2.rsc', () => ({
  useAgreementMutationsWeb2Rsc: () => web2,
}));

vi.mock('../hooks/useAgreementMutations.web3.rsc', () => ({
  useAgreementMutationsWeb3Rpc: () => web3,
}));

vi.mock('../hooks/useAgreementFileUploads', () => ({
  useAgreementFileUploads: () => ({ upload: vi.fn() }),
}));

import { useCreateAgreementOrchestrator } from '../hooks/useCreateAgreementOrchestrator';

const proposal = {
  title: 'Quest test',
  description: 'Verify the quest flow.',
  creatorId: 7,
  spaceId: 3,
  web3SpaceId: 11,
};

describe('create agreement after a replaced deploy', () => {
  beforeEach(() => {
    web2.createAgreement.mockReset();
    web2.deleteAgreementBySlug.mockReset();
    web2.updateAgreementBySlug.mockReset();
    web2.resetCreateAgreementMutation.mockReset();
    web2.createdAgreement = null;
    web3.createAgreement.mockReset();
    web3.resetCreateAgreementMutation.mockReset();
    web3.createdAgreement = null;
  });

  it('does not insert or delete an agreement when the Web2 action is gone', async () => {
    web2.createAgreement.mockRejectedValue(
      new Error(
        'Server Action "60967ca92bbb289600c8c9651e2f62137cd7bf1011" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action',
      ),
    );
    const { result } = renderHook(() =>
      useCreateAgreementOrchestrator({
        authToken: 'token',
        skipWeb3Proposal: true,
      }),
    );

    await act(async () => {
      await expect(result.current.createAgreement(proposal)).rejects.toEqual(
        expect.objectContaining({
          name: 'StaleDeploymentError',
          agreement: null,
        }),
      );
    });

    expect(web2.deleteAgreementBySlug).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    act(() => {
      result.current.reset();
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.currentAction).toBeUndefined();
  });

  it('keeps the Web2 agreement when a later step loads a missing chunk', async () => {
    web2.createAgreement.mockResolvedValue({
      id: 44,
      slug: 'quest-test-proposal',
    });
    const chunk = new Error('Loading chunk 75964 failed.');
    chunk.name = 'ChunkLoadError';
    web3.createAgreement.mockRejectedValue(chunk);
    const { result } = renderHook(() =>
      useCreateAgreementOrchestrator({
        authToken: 'token',
        config: {} as never,
      }),
    );

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.createAgreement(proposal);
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(StaleDeploymentError);
    expect((caught as StaleDeploymentError).agreement).toEqual({
      id: 44,
      slug: 'quest-test-proposal',
    });
    expect(web2.deleteAgreementBySlug).not.toHaveBeenCalled();
  });

  it('still removes the Web2 agreement when a later step fails for another reason', async () => {
    web2.createAgreement.mockResolvedValue({
      id: 44,
      slug: 'quest-test-proposal',
    });
    web2.deleteAgreementBySlug.mockResolvedValue(undefined);
    web3.createAgreement.mockRejectedValue(new Error('wallet rejected'));
    const { result } = renderHook(() =>
      useCreateAgreementOrchestrator({
        authToken: 'token',
        config: {} as never,
      }),
    );

    await act(async () => {
      await expect(result.current.createAgreement(proposal)).rejects.toThrow(
        'wallet rejected',
      );
    });

    expect(web2.deleteAgreementBySlug).toHaveBeenCalledWith({
      slug: 'quest-test-proposal',
    });
  });
});
