import { describe, expect, it } from 'vitest';

import { spokenAs } from '../spoken-as';

describe('spokenAs', () => {
  it('reads he or she from the given name', () => {
    expect(spokenAs('Gerardo Roza')).toBe('he');
    expect(spokenAs('Ada Lovelace')).toBe('she');
    expect(spokenAs('José')).toBe('he');
  });

  it('leaves a name that does not show he or she', () => {
    expect(spokenAs('Noor')).toBeNull();
    expect(spokenAs('Alex')).toBeNull();
    expect(spokenAs(null)).toBeNull();
  });
});
