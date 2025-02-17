import { ROOT_PATH } from '@web/app/constants';

export const createPathHelper =
  <T extends Record<string, string>>(dirname: string) =>
  (props: T) => {
    const segments = Object.keys(props);
    return segments.reduce(
      (acc, segment) => acc.replace(`[${segment}]`, String(props[segment])),
      dirname.split(ROOT_PATH)[0],
    );
  };
