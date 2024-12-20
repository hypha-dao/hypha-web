import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{
        text: ['1', '2', '3', '4', '5', '6', '7', '8', '9']
      }]
    }
  }
});

export const cn = function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
};
