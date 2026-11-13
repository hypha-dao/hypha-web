import { getTranslations } from 'next-intl/server';

/** Not-found inside the white-label root layout (matched `/wl/...` routes). */
export default async function WhiteLabelNotFound() {
  const tCommon = await getTranslations('Common');

  return (
    <div className="w-full min-h-[24rem] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-9 font-medium">
        <span>{tCommon('notFoundOops')} </span>
        <span>{tCommon('notFoundCouldNotFindPage')}</span>
      </h1>
      <p className="text-4 text-neutral-11">{tCommon('notFoundDescription')}</p>
    </div>
  );
}
