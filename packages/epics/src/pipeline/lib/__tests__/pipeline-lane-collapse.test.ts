import { describe, expect, it } from 'vitest';
import {
  parseCollapsedPipelineLanes,
  toggleCollapsedPipelineLane,
} from '../pipeline-lane-collapse';

describe('parseCollapsedPipelineLanes', () => {
  it('reads a stored slug list', () => {
    expect(parseCollapsedPipelineLanes('["Sales","Grants"]')).toEqual([
      'Sales',
      'Grants',
    ]);
  });

  it('drops duplicates and non-slug entries', () => {
    expect(
      parseCollapsedPipelineLanes('["Sales","Sales","",null,7,"Grants"]'),
    ).toEqual(['Sales', 'Grants']);
  });

  it('falls back to an empty list for missing or corrupt values', () => {
    expect(parseCollapsedPipelineLanes(null)).toEqual([]);
    expect(parseCollapsedPipelineLanes('')).toEqual([]);
    expect(parseCollapsedPipelineLanes('not json')).toEqual([]);
    expect(parseCollapsedPipelineLanes('{"Sales":true}')).toEqual([]);
  });
});

describe('toggleCollapsedPipelineLane', () => {
  it('collapses a lane that is currently open', () => {
    expect(toggleCollapsedPipelineLane(['Grants'], 'Sales')).toEqual([
      'Grants',
      'Sales',
    ]);
  });

  it('expands a lane that is currently collapsed', () => {
    expect(toggleCollapsedPipelineLane(['Grants', 'Sales'], 'Sales')).toEqual([
      'Grants',
    ]);
  });

  it('leaves the source list untouched', () => {
    const collapsed = ['Sales'];
    toggleCollapsedPipelineLane(collapsed, 'Grants');
    expect(collapsed).toEqual(['Sales']);
  });
});
