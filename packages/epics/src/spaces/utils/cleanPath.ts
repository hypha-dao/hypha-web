export const cleanPath = (pathname: string, keepSegments = 4): string => {
  return pathname
    .split('/')
    .slice(0, keepSegments + 1)
    .join('/');
};
