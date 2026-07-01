'use client';

import { useFormatter, useTranslations } from 'next-intl';
import {
  LOCAL_DATE_FORMAT_OPTIONS,
  LOCAL_DATE_TIME_FORMAT_OPTIONS,
  parseDateInput,
} from '@hypha-platform/ui-utils';

type FormattedLocalDateTimeProps = {
  value: string | number | Date;
  withTime?: boolean;
};

export function FormattedLocalDateTime({
  value,
  withTime = true,
}: FormattedLocalDateTimeProps) {
  const format = useFormatter();
  const date = parseDateInput(value);

  if (!date) {
    return null;
  }

  return (
    <>
      {format.dateTime(
        date,
        withTime ? LOCAL_DATE_TIME_FORMAT_OPTIONS : LOCAL_DATE_FORMAT_OPTIONS,
      )}
    </>
  );
}

type SpaceCreatedOnTextProps = {
  createdAt: string | number | Date;
};

export function SpaceCreatedOnText({ createdAt }: SpaceCreatedOnTextProps) {
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const date = parseDateInput(createdAt);

  if (!date) {
    return null;
  }

  return (
    <>
      {tCommon('createdOn', {
        date: format.dateTime(date, LOCAL_DATE_TIME_FORMAT_OPTIONS),
      })}
    </>
  );
}
