import { describe, it, expect } from 'vitest';
import { encodeFunctionData } from 'viem';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { decodeJoinRequestProposal } from '../decode-join-request-proposal';

const factoryAddress = daoSpaceFactoryImplementationAddress[8453];
const requesterAddress = '0x1111111111111111111111111111111111111111';
const walletAddress = '0x2222222222222222222222222222222222222222';

const addMemberExecutionData = encodeFunctionData({
  abi: daoSpaceFactoryImplementationAbi,
  functionName: 'addMember',
  args: [42n, requesterAddress],
});

describe('decodeJoinRequestProposal', () => {
  it('returns the requester address for a join-request proposal created by the space factory', () => {
    expect(
      decodeJoinRequestProposal({
        creator: factoryAddress,
        executionData: addMemberExecutionData,
      }),
    ).toBe(requesterAddress);
  });

  it('matches the factory creator address case-insensitively', () => {
    expect(
      decodeJoinRequestProposal({
        creator: factoryAddress.toUpperCase().replace('0X', '0x'),
        executionData: addMemberExecutionData,
      }),
    ).toBe(requesterAddress);
  });

  it('returns null when the creator is a regular wallet, even for addMember calldata', () => {
    expect(
      decodeJoinRequestProposal({
        creator: walletAddress,
        executionData: addMemberExecutionData,
      }),
    ).toBeNull();
  });

  it('returns null for factory-created proposals executing a different function', () => {
    const joinSpaceExecutionData = encodeFunctionData({
      abi: daoSpaceFactoryImplementationAbi,
      functionName: 'joinSpace',
      args: [42n],
    });

    expect(
      decodeJoinRequestProposal({
        creator: factoryAddress,
        executionData: joinSpaceExecutionData,
      }),
    ).toBeNull();
  });

  it('returns null for calldata that does not match the factory ABI', () => {
    expect(
      decodeJoinRequestProposal({
        creator: factoryAddress,
        executionData: '0xdeadbeef',
      }),
    ).toBeNull();
  });

  it('returns null for empty or missing executionData', () => {
    expect(
      decodeJoinRequestProposal({
        creator: factoryAddress,
        executionData: '0x',
      }),
    ).toBeNull();
    expect(
      decodeJoinRequestProposal({
        creator: factoryAddress,
        executionData: undefined,
      }),
    ).toBeNull();
  });
});
