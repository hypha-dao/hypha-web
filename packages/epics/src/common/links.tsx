import React from 'react';
import { LinkItem } from './link-item';
import { FieldError } from 'react-hook-form';

type LinksProps = {
  links: string[];
  errors?: Partial<{ [key: number]: FieldError }> | FieldError;
  onChange: (value: string[]) => void;
};

export const Links = ({ links, errors, onChange }: LinksProps) => {
  const handleChange = React.useCallback(
    (index: number) => (value: string) => {
      const newLinks = [...links];
      newLinks[index] = value;
      onChange(newLinks.filter(Boolean));
    },
    [links, onChange],
  );

  const getError = (index: number) => {
    if (!errors) return undefined;
    if ('message' in errors) return errors.message;
    return (errors as Partial<{ [key: number]: FieldError }>)[index]?.message;
  };

  return (
    <div className="flex gap-2 flex-col">
      {Array(3)
        .fill(null)
        .map((_, index) => (
          <LinkItem
            key={index}
            link={links[index]}
            error={getError(index)}
            onChange={handleChange(index)}
          />
        ))}
    </div>
  );
};
