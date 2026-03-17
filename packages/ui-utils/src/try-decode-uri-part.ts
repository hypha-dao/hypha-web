export function tryDecodeUriPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
