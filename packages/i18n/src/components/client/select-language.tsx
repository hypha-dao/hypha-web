'use client';

import { SelectItem, SelectMenu } from '@hypha-platform/ui/server';
import { usePathname, useRouter } from 'next/navigation';

type LangSelectProps = {
  currentLanguage: string;
  languages: readonly string[];
};

export const SelectLanguage: React.FC<LangSelectProps> = ({
  currentLanguage,
  languages,
}) => {
  const { push } = useRouter();
  const path = usePathname();

  const handleLangChange = (value: string) => {
    const newPath = path.replace(/^\/[a-z]{2}/, `/${value}`);
    push(newPath);
  };

  return (
    <SelectMenu value={currentLanguage} onValueChange={handleLangChange}>
      {languages.map((lang) => (
        <SelectItem key={lang} value={lang}>
          {lang.toUpperCase()}
        </SelectItem>
      ))}
    </SelectMenu>
  );
};
