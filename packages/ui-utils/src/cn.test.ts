import { cn } from './cn';

describe('cn utility', () => {
  it('should handle custom font-size classes correctly', () => {
    expect(cn('text-1', 'text-2', 'text-accent-1')).toBe(
      'text-2 text-accent-1',
    );
  });
});
