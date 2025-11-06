'use client';

import React from 'react';
import { FieldErrors, FieldValues, UseFormReturn } from 'react-hook-form';

export type CustomScrollIntoError = () => void;

export const useScrollToErrors = <T extends FieldValues>(
  form: UseFormReturn<T>,
  formRef?: React.RefObject<HTMLFormElement | null>,
) => {
  const [customScrollIntoError, setCustomScrollIntoError] =
    React.useState<CustomScrollIntoError | null>(null);
  const scrollIntoError = React.useCallback(
    <T extends FieldValues>(errors: FieldErrors<T>) => {
      const formContainer = formRef?.current ?? document;
      const allParagraphs = Array.from(formContainer.querySelectorAll('p'));

      const elements = Object.keys(errors)
        .map((name) => {
          const error = errors[name];
          const message = error?.message?.toString() ?? '';

          const selector = `[name="${name.replace(/"/g, '\\"')}"]`;
          const [element] = Array.from(
            formContainer.querySelectorAll(selector),
          ).filter((el) => {
            if (!(el instanceof HTMLElement)) {
              return;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 || rect.height > 0;
          });

          const foundParagraph = !element
            ? allParagraphs.find(
                (p) => p.textContent?.includes(message) ?? false,
              )
            : undefined;

          return (element as HTMLElement) ?? foundParagraph;
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
    },
    [formRef],
  );

  React.useEffect(() => {
    if (customScrollIntoError) {
      customScrollIntoError();
    } else {
      scrollIntoError(form.formState.errors);
    }
  }, [form.formState.errors, scrollIntoError]);

  return {
    customScrollIntoError,
    setCustomScrollIntoError,
    scrollIntoError,
  };
};
