import { Locale } from '@hypha-platform/i18n';
import { MembersSection, SubspaceSection } from '@hypha-platform/epics';

import { useMembers } from '@web/hooks/use-members';

import { getDhoPathMembership } from './constants';
import { getDhoPathGovernance } from '../governance/constants';
import { findSpaceBySlug, getDb } from '@hypha-platform/core/server';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = getDhoPathMembership(lang as Locale, id as string);

  return (
    <div className="flex flex-col gap-6 py-4">
      <MembersSection
        basePath={`${basePath}/person`}
        useMembers={useMembers}
        spaceSlug={id}
        refreshInterval={2000}
      />
    </div>
  );
}
