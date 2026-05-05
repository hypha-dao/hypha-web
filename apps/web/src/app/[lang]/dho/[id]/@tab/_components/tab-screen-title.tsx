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
      <h1 className="text-7 font-semibold tracking-tight text-foreground">
        {title}
        {formattedCount ? (
          <span className="ml-2 text-5 font-medium text-muted-foreground">
            | {formattedCount}
          </span>
        ) : null}
      </h1>
      {filters ? <div>{filters}</div> : null}
    </div>
  );
}
