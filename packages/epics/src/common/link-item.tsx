import { cn } from '@hypha-platform/ui-utils';
import { Input } from '@hypha-platform/ui';
import React from 'react';
import { LinkIcon } from './link-icon';

type LinkItemProps = {
  link: string;
  error?: string;
  onChange: (value: string) => void;
};

export const LinkItem = ({ link, error, onChange }: LinkItemProps) => {
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <div
      className={cn('flex justify-between items-center', !link && 'opacity-50')}
    >
      <LinkIcon url={link} />
      <span className="flex flex-col flex-1 ml-4">
        <Input
          placeholder="Add your URL"
          className={cn(
            'text-2',
            error && 'border-red-500 focus-visible:ring-red-500',
          )}
          value={link}
          onChange={handleChange}
        />
        {error && <span className="text-sm text-red-500 mt-1">{error}</span>}
      </span>
    </div>
  );
};
