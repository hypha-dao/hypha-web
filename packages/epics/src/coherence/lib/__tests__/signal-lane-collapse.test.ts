import { describe, expect, it } from 'vitest';
import {
  parseCollapsedSignalLanes,
  toggleCollapsedSignalLane,
} from '../signal-lane-collapse';

describe('parseCollapsedSignalLanes', () => {
  it('reads a stored slug list', () => {
    expect(parseCollapsedSignalLanes('["general","product"]')).toEqual([
      'general',
      'product',
    ]);
  });

  it('drops duplicates and non-slug entries', () => {
    expect(
      parseCollapsedSignalLanes('["general","general","",null,7,"product"]'),
    ).toEqual(['general', 'product']);
  });

  it('falls back to an empty list for missing or corrupt values', () => {
    expect(parseCollapsedSignalLanes(null)).toEqual([]);
    expect(parseCollapsedSignalLanes('')).toEqual([]);
    expect(parseCollapsedSignalLanes('not json')).toEqual([]);
    expect(parseCollapsedSignalLanes('{"general":true}')).toEqual([]);
  });
});

describe('toggleCollapsedSignalLane', () => {
  it('collapses a lane that is currently open', () => {
    expect(toggleCollapsedSignalLane(['product'], 'general')).toEqual([
      'product',
      'general',
    ]);
  });

  it('expands a lane that is currently collapsed', () => {
    expect(
      toggleCollapsedSignalLane(['product', 'general'], 'general'),
    ).toEqual(['product']);
  });

  it('leaves the source list untouched', () => {
    const collapsed = ['general'];
    toggleCollapsedSignalLane(collapsed, 'product');
    expect(collapsed).toEqual(['general']);
  });
});
