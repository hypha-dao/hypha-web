import { describe, expect, it } from 'vitest';
import { layoutCallRecordingTiles } from '../call-recording';

function fakeTrack(id: string): MediaStreamTrack {
  return { id, readyState: 'live' } as MediaStreamTrack;
}

describe('layoutCallRecordingTiles', () => {
  it('lays out two cameras side by side when there is no screenshare', () => {
    const tiles = layoutCallRecordingTiles(
      [
        { track: fakeTrack('a'), kind: 'camera' },
        { track: fakeTrack('b'), kind: 'camera' },
      ],
      640,
      360,
    );
    expect(tiles).toHaveLength(2);
    expect(tiles[0]?.w).toBe(320);
    expect(tiles[1]?.x).toBe(320);
  });

  it('gives screenshare the main area and cameras a strip', () => {
    const tiles = layoutCallRecordingTiles(
      [
        { track: fakeTrack('screen'), kind: 'screenshare' },
        { track: fakeTrack('cam'), kind: 'camera' },
      ],
      640,
      360,
    );
    expect(tiles[0]?.h).toBeGreaterThan(tiles[1]?.h ?? 0);
    expect(tiles[1]?.y).toBe(tiles[0]?.h);
  });
});
