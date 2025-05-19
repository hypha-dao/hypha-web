import { dnull } from './dnull';

it('converts null to undefined', () => {
  expect(dnull(null)).toEqual(undefined);
});

it('works on objects', () => {
  expect(dnull({ a: 1, b: null })).toEqual({ a: 1 });
});

it('works on arrays', () => {
  expect(dnull([1, 2, null])).toEqual([1, 2, undefined]);
});

it('works on dates', () => {
  expect(dnull(new Date('01-01-2000'))).toEqual(new Date('01-01-2000'));
});

it('works on nested structures', () => {
  const obj = {
    name: 'john',
    address: {
      street: "john's street",
      number: null,
      tags: [1, 2, null, 4],
    },
  };

  expect(dnull(obj)).toEqual({
    name: 'john',
    address: {
      street: "john's street",
      number: undefined,
      tags: [1, 2, undefined, 4],
    },
  });
});
