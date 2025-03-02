'use client';

import { useParams } from 'next/navigation';
import { useSpaces } from 'packages/epics/src/membership/hooks/use-spaces';
import { getDhoPathAgreements } from '../../../agreements/constants';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathMembership } from '../../constants';
import { useMemberBySlug } from '@web/hooks/use-member-by-slug';
import { MemberDetail } from '@hypha-platform/epics';
import { useSpaceDocuments } from '@web/hooks/use-space-documents';

export default function Member() {
  const { slug, id, lang } = useParams();
  const { person, isLoading } = useMemberBySlug(slug as string);
  const { spaces } = useSpaces({
    page: 1,
    sort: { sort: 'all' },
  });

  return (
    <MemberDetail
      closeUrl={getDhoPathMembership(lang as Locale, id as string)}
      member={{
        avatarUrl: person?.avatarUrl,
        name: person?.name,
        surname: person?.surname,
        nickname: person?.nickname,
        commitment: 50, // TODO: get commitment
        status: 'active', // TODO: get status
        about: person?.description,
      }}
      isLoading={isLoading}
      basePath={getDhoPathAgreements(lang as Locale, id as string)}
      spaces={spaces}
      useDocuments={useSpaceDocuments}
    />
  );
}
