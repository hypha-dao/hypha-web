import { describe, expect, it } from 'vitest';
import { filterDeals } from '../filter-deals';
import type { Deal } from '../types';

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 1,
    spaceId: 1,
    ownerId: 1,
    title: 'Acme deal',
    pipelineSwimlane: 'Sales',
    pipelineStatus: 'Identified',
    status: 'active',
    priority: 'medium',
    value: 1000,
    currency: '€',
    country: 'NL',
    region: 'Benelux',
    contacts: [],
    contactPerson: null,
    contactEmail: null,
    linkedinUrl: null,
    contactUrl: null,
    teamMemberIds: [],
    accountManagerId: null,
    nextAction: null,
    nextActionDate: null,
    notes: null,
    tags: ['pilot'],
    blocked: false,
    blockerReason: null,
    submissionDeadline: '2026-08-01',
    fundingRateSme: null,
    maxProjectSize: null,
    expectedPartners: null,
    isConsortiumLead: null,
    eligibleCountries: [],
    callReference: null,
    programme: null,
    eligibilityNotes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('filterDeals', () => {
  const deals = [
    makeDeal({ id: 1, title: 'NL sales', country: 'NL', region: 'Benelux' }),
    makeDeal({
      id: 2,
      title: 'UK grant',
      pipelineSwimlane: 'Grants',
      country: 'GB',
      region: 'UK',
      status: 'on_hold',
      priority: 'high',
      submissionDeadline: null,
      tags: ['urgent'],
    }),
    makeDeal({
      id: 3,
      title: 'Global partner',
      pipelineSwimlane: 'Partners',
      country: null,
      region: 'Global',
      status: 'won',
    }),
  ];

  it('returns all deals when filters are empty', () => {
    expect(filterDeals(deals, {})).toHaveLength(3);
  });

  it('filters by swimlane', () => {
    expect(filterDeals(deals, { swimlane: 'Sales' }).map((d) => d.id)).toEqual([
      1,
    ]);
  });

  it('filters by region', () => {
    expect(filterDeals(deals, { region: 'UK' }).map((d) => d.id)).toEqual([2]);
  });

  it('filters by country case-insensitively', () => {
    expect(filterDeals(deals, { country: 'nl' }).map((d) => d.id)).toEqual([1]);
    expect(filterDeals(deals, { country: 'GB' }).map((d) => d.id)).toEqual([2]);
  });

  it('filters by deal status', () => {
    expect(filterDeals(deals, { status: 'on_hold' }).map((d) => d.id)).toEqual([
      2,
    ]);
  });

  it('filters by priority', () => {
    expect(filterDeals(deals, { priority: 'high' }).map((d) => d.id)).toEqual([
      2,
    ]);
  });

  it('filters by hasDeadline', () => {
    expect(filterDeals(deals, { hasDeadline: true }).map((d) => d.id)).toEqual([
      1, 3,
    ]);
    expect(filterDeals(deals, { hasDeadline: false }).map((d) => d.id)).toEqual(
      [2],
    );
  });

  it('filters by tag', () => {
    expect(filterDeals(deals, { tag: 'urgent' }).map((d) => d.id)).toEqual([2]);
  });

  it('filters by search query across title and country', () => {
    expect(filterDeals(deals, { q: 'grant' }).map((d) => d.id)).toEqual([2]);
    expect(filterDeals(deals, { q: 'nl' }).map((d) => d.id)).toEqual([1]);
  });

  it('combines multiple filters', () => {
    expect(
      filterDeals(deals, {
        swimlane: 'Sales',
        region: 'Benelux',
        country: 'NL',
        status: 'active',
      }).map((d) => d.id),
    ).toEqual([1]);
  });
});
