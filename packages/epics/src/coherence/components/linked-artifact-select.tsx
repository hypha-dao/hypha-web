'use client';

import { FC } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export type LinkedArtifactOption = {
  id: string;
  title: string;
};

const NONE_VALUE = '__none__';

type LinkedArtifactSelectProps = {
  id?: string;
  value: string;
  onChange: (artifactId: string) => void;
  artifacts: LinkedArtifactOption[];
  disabled?: boolean;
};

export const LinkedArtifactSelect: FC<LinkedArtifactSelectProps> = ({
  id,
  value,
  onChange,
  artifacts,
  disabled,
}) => {
  const t = useTranslations('CoherenceTab');
  const selectValue = value.trim() ? value : NONE_VALUE;
  return (
    <Select
      value={selectValue}
      onValueChange={(next) => onChange(next === NONE_VALUE ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue
          placeholder={t('spaceDocumentationFieldLinkedArtifactNone')}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          {t('spaceDocumentationFieldLinkedArtifactNone')}
        </SelectItem>
        {artifacts.map((artifact) => (
          <SelectItem key={artifact.id} value={artifact.id}>
            {artifact.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
