'use client';

import React from 'react';
import { FieldErrors, FieldValues, UseFormReturn } from 'react-hook-form';
// Built-in scrollIntoView options are not supported in Safari before 14
import { polyfill } from 'seamless-scroll-polyfill';

if (typeof window !== 'undefined') {
  polyfill();
}

export const useScrollToErrors = <T extends FieldValues>(
  form: UseFormReturn<T>,
) => {
  const scrollIntoError = React.useCallback(
    <T extends FieldValues>(errors: FieldErrors<T>) => {
      console.log('Errors:', errors);
      const allParagraphs = Array.from(document.querySelectorAll('p'));
      const elements = Object.keys(errors)
        .map((name) => {
          const error = errors[name];
          const message = error?.message?.toString() ?? '';
          const [element] = Array.from(document.getElementsByName(name)).filter(
            (el) => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 || rect.height > 0;
            },
          );
          const foundParagraph = element
            ? allParagraphs.find(
                (div) => div.textContent?.includes(message) ?? false,
              )
            : undefined;
          return element ?? foundParagraph;
        })
        .filter((el) => !!el);
      elements.sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      );
      console.log(
        'elements:',
        elements.map((el) => el.getBoundingClientRect()),
      );
      if (elements.length > 0) {
        const errorElement = elements[0]!;
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errorElement.focus({ preventScroll: true });
      }
    },
    [],
  );

  React.useEffect(() => {
    scrollIntoError(form.formState.errors);
  }, [form.formState.errors, scrollIntoError]);

  return { scrollIntoError };
};
