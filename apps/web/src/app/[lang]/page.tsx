import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { SpaceGroupSlider, Search } from '@hypha-platform/epics';
import { readAllSpaces } from '../actions/space';
import { getDhoPathAgreements } from './dho/[id]/agreements/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;

  const { lang } = params;

  const getHref = (id: string) => {
    return getDhoPathAgreements(lang, id);
  };

  const spaces = await readAllSpaces();

  return (
    <Container>
      <Text className="text-9 text-center flex mb-8">
        Explore hundreds of Spaces in the Hypha Network
      </Text>
      <Search />
      <SpaceGroupSlider spaces={spaces} type="Hypha" getHref={getHref} />
    </Container>
  );
}
