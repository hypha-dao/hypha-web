import { Alchemy } from '@hypha-platform/core/server';
import { daoSpaceFactoryImplementationAbi } from '@hypha-platform/core/generated';

export const POST = Alchemy.newHandler(
  {
    signingKey: process.env.WH_SPACE_CREATED_SIGN_KEY ?? '',
    abi: daoSpaceFactoryImplementationAbi,
    event: 'SpaceCreated',
  },
  async () => {},
);
