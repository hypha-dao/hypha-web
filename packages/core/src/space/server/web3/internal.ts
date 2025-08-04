export function formMap<T extends { spaceId: bigint }>(
  input: Array<T>,
): Map<bigint, T> {
  return new Map(input.map((element) => [element.spaceId, element]));
}
