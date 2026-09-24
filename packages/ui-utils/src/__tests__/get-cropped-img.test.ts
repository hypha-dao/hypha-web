import { describe, expect, it } from 'vitest';

import { getCroppedImg } from '../get-cropped-img';

describe('getCroppedImg', () => {
  it('rejects a zero-size crop before drawing', async () => {
    await expect(
      getCroppedImg('data:image/png;base64,xx', {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      }),
    ).rejects.toThrow('Cropped image area is empty.');
  });
});
