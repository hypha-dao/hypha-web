'use client';
import { Locale } from "@hypha-platform/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@hypha-platform/ui/server";
import Link from "next/link";
import { ListAssets, ListRequests } from "@hypha-platform/epics";
import { listRequestsData } from "@hypha-platform/ui-utils";
import { useState } from "react";

type PageProps = {
  params: { lang: Locale, id: string}
}

export default function TreasuryPage({ params: { lang, id } }: PageProps) {
  const [requests, setRequests] = useState(listRequestsData.requests);

  const loadMoreRequests = () => {
    const newRequests = listRequestsData.newRequests;
    setRequests(prevRequests => [...prevRequests, ...newRequests]);
  }

  return (
    <div>
      <Tabs value="treasury" className="w-full mt-16">
        <TabsList className='w-full'>
          <TabsTrigger asChild value="agreements" className="w-full" variant="ghost">
            <Link href={`/${lang}/dho/${id}/agreements`} className="w-full" passHref>
              Agreements
            </Link>
          </TabsTrigger>
          <TabsTrigger asChild value="membership" className="w-full" variant="ghost">
            <Link href={`/${lang}/dho/${id}/membership`} className="w-full" passHref>
              Membership
            </Link>
          </TabsTrigger>
          <TabsTrigger asChild value="treasury" className="w-full" variant="ghost">
            <Link href={`/${lang}/dho/${id}/treasury`} className="w-full" passHref>
              Treasury
            </Link>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="treasury">
          <div className='flex flex-col justify-between items-center mt-4'>
            <ListAssets/>
            <ListRequests
              requests={requests}
              totalValue={listRequestsData.totalValue}
              onLoadMore={loadMoreRequests}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
