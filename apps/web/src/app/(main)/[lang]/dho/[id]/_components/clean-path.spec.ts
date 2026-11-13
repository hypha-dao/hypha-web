import { cleanPath } from './clean-path';

describe('cleanPath', () => {
  const testCases = [
    {
      input: '/en/dho/my-org/agreements/something/else',
      expected: '/en/dho/my-org/agreements',
      description: 'should clean path after agreements tab',
    },
    {
      input: '/en/dho/my-org/agreements/select-settings-action',
      expected: '/en/dho/my-org/agreements',
      description: 'should remove settings action after tab',
    },
    {
      input: '',
      expected: '',
      description: 'should handle empty path',
    },
  ];

  testCases.forEach(({ input, expected, description }) => {
    it(description, () => {
      expect(cleanPath(input)).toBe(expected);
    });
  });
});
