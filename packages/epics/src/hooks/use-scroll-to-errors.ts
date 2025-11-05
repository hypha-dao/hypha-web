'use client';

import React from 'react';
import { FieldErrors, FieldValues } from 'react-hook-form';
// Built-in scrollIntoView options are not supported in Safari before 14
import { polyfill } from 'seamless-scroll-polyfill';

if (typeof window !== 'undefined') {
  polyfill();
}

export const useScrollToErrors = <T extends FieldValues>(form: T) => {
  React.useEffect(
    () => scrollIntoError(form.formState.errors),
    [form.formState.errors],
  );

  const scrollIntoError = <T extends FieldValues>(errors: FieldErrors<T>) => {
    const allParagraphs = Array.from(document.querySelectorAll('p'));
    const elements = Object.keys(errors)
      .map((name) => {
        const error = errors[name];
        const message = error?.message?.toString() ?? '';
        const foundParagraph = allParagraphs.find((div) =>
          div.textContent.includes(message),
        );
        const element = Array.from(document.getElementsByName(name)).filter(
          (el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 || rect.height > 0;
          },
        )[0];
        return element ?? foundParagraph;
      })
      .filter((el) => !!el);
    elements.sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    );
    if (elements.length > 0) {
      const errorElement = elements[0]!;
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      errorElement.focus({ preventScroll: true });
    }
  };

  return { scrollIntoError };
};
