import { describe, expect, it } from 'vitest';
import {
  isMatrixCallDebugEnabled,
  isMatrixCallDebugLocalStorageEnabled,
  isMatrixCallSupportDebugEnabled,
  MATRIX_CALL_DEBUG_LOCAL_STORAGE_KEYS,
} from '../matrix-webrtc-env';

describe('matrix call debug localStorage keys', () => {
  it('accepts hypha.callDebug and legacy hypha.group_call.debug', () => {
    expect(MATRIX_CALL_DEBUG_LOCAL_STORAGE_KEYS).toEqual([
      'hypha.callDebug',
      'hypha.group_call.debug',
    ]);
  });

  it('enables support debug when hypha.callDebug=1', () => {
    const storage = {
      getItem: (key: string) => (key === 'hypha.callDebug' ? '1' : null),
    };
    expect(isMatrixCallDebugLocalStorageEnabled(storage)).toBe(true);
    expect(isMatrixCallSupportDebugEnabled(storage)).toBe(true);
  });

  it('does not require env flag when localStorage is set', () => {
    const storage = {
      getItem: (key: string) => (key === 'hypha.group_call.debug' ? '1' : null),
    };
    expect(isMatrixCallDebugEnabled(storage)).toBe(true);
  });
});
