import { SpaceCalendar, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelCalendarPage(
  props: WhiteLabelPageProps,
) {
  const { id: slug, lang } = await props.params;
  const space = await getWhiteLabelSpace(slug);

  return (
    <SpaceTabAccessWrapper
      spaceId={space.web3SpaceId ?? undefined}
      spaceSlug={slug}
    >
      <div className="flex flex-col py-2">
        <SpaceCalendar
          spaceSlug={slug}
          spaceId={space.id}
          lang={lang as Locale}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
