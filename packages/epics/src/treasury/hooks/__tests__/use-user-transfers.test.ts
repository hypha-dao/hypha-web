import { describe, expect, it } from 'vitest';
import { buildUserTransfersEndpoint } from '../build-user-transfers-endpoint';

describe('buildUserTransfersEndpoint', () => {
  it('omits token= when no filter is supplied (unscoped)', () => {
    expect(buildUserTransfersEndpoint({ personSlug: 'vladhram' })).toBe(
      '/api/v1/people/vladhram/transactions',
    );
  });

  it('forwards an invalid token= so the route stays scoped empty', () => {
    expect(
      buildUserTransfersEndpoint({
        personSlug: 'vladhram',
        token: 'not-a-valid-address',
      }),
    ).toBe('/api/v1/people/vladhram/transactions?token=not-a-valid-address');
  });

  it('forwards a present empty token= instead of dropping it', () => {
    expect(
      buildUserTransfersEndpoint({ personSlug: 'vladhram', token: '' }),
    ).toBe('/api/v1/people/vladhram/transactions?token=');
  });

  it('combines sort and token query params', () => {
    expect(
      buildUserTransfersEndpoint({
        personSlug: 'vladhram',
        sort: 'incoming',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      }),
    ).toBe(
      '/api/v1/people/vladhram/transactions?sort=incoming&token=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    );
  });
});
