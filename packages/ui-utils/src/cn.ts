import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['xs', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        },
      ],
    },
  },
});

export const cn = function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
};

export function prefix(prefix: string, classes: string[]): string {
  return classes.map((cls) => `${prefix}${cls}`).join(' ');
}
