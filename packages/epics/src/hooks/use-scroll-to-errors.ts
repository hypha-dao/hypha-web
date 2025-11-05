import React from 'react';
import { FieldErrors, FieldValues } from 'react-hook-form';
// Built-in scrollIntoView options are not supported in Safari before 14
import { scrollIntoView } from 'seamless-scroll-polyfill';

export const useScrollToErrors = <T extends FieldValues>(form: T) => {
  React.useEffect(
    () => scrollIntoError(form.formState.errors),
    [form.formState.errors],
  );

  const scrollIntoError = <T extends FieldValues>(errors: FieldErrors<T>) => {
    const elements = Object.keys(errors)
      .map((name) => document.getElementsByName(name)[0])
      .filter((el) => !!el);
    elements.sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    );
    if (elements.length > 0) {
      const errorElement = elements[0]!;
      scrollIntoView(errorElement, { behavior: 'smooth', block: 'center' });
      errorElement.focus({ preventScroll: true });
    }
  };

  return { scrollIntoError };
};
