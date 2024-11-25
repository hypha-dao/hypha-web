import { Locale } from "@hypha-platform/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@hypha-platform/ui/server";
import Link from "next/link";
import { ListOuterSpaces, ListInnerSpaces, ListMembers, CardOrganisation } from "@hypha-platform/epics";
import { Text } from "@radix-ui/themes";
import { Carousel, CarouselContent, CarouselItem } from "@hypha-platform/ui";
import { getDhoPathAgreements } from "../constants";
import { getAccessToken, getDaoList } from '@hypha-platform/graphql/rsc';

type PageProps = {
  params: { lang: Locale; id: string };
};

export default async function MembershipPage({ params: { lang, id } }: PageProps) {
  const newtoken = await getAccessToken();
  const daos = await getDaoList({ token: newtoken.accessJWT });
  return (
    <div>
      <Tabs value="membership" className="w-full mt-16">
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
        <TabsContent value="membership">
          <div className='flex flex-col items-center mt-4'>
            <ListOuterSpaces/>
            <ListInnerSpaces/>
            <ListMembers/>
          </div>
        </TabsContent>
        <Text className='text-3'>Spaces you might like</Text>
        <Carousel className='my-8'>
          <CarouselContent>
            {daos.map((dao) => (
              <CarouselItem
                key={dao.name}
                className="mb-5 w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
              >
                <Link className="w-96" href={getDhoPathAgreements(lang, dao.url as string)}>
                  <CardOrganisation
                    createdDate={dao.date}
                    description={dao.description as string}
                    icon={dao.logo}
                    members={0}
                    agreements={0}
                    title={dao.title as string}
                  />
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </Tabs>
    </div>
  );
}