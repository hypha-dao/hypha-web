import { isSpaceLocationSource } from '../../geo/location';
import type { Space } from '../types';

function parseLocationSource(
  value: string | null | undefined,
): Space['locationSource'] {
  if (value == null) {
    return null;
  }
  return isSpaceLocationSource(value) ? value : null;
}

export function mapDbSpaceToSpace<T extends { locationSource?: string | null }>(
  row: T,
): Omit<T, 'locationSource'> & Pick<Space, 'locationSource'> {
  const { locationSource, ...rest } = row;
  return {
    ...rest,
    locationSource: parseLocationSource(locationSource),
  };
}
