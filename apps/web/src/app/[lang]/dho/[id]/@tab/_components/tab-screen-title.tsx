import type { ReactNode } from 'react';

type TabScreenTitleProps = {
  title: string;
  count?: number | null;
  lang?: string;
  filters?: ReactNode;
};

function formatCount(count?: number | null, lang?: string): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
    return null;
  }
  return Intl.NumberFormat(lang).format(count);
}

export function TabScreenTitle({
  title,
  count,
  lang,
  filters,
}: TabScreenTitleProps) {
  const formattedCount = formatCount(count, lang);
  return (
    <div className="flex flex-col gap-3">
      <header className="craft-page-header">
        <h1 className="craft-page-title text-6 font-medium">
          {title}
          {formattedCount ? (
            <span className="ml-2 text-4 font-normal text-muted-foreground">
              | {formattedCount}
            </span>
          ) : null}
        </h1>
      </header>
      {filters ? <div>{filters}</div> : null}
    </div>
  );
}
