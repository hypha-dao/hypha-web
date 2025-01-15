import type { Meta, StoryObj } from '@storybook/react';
import { MemberDetail } from './member-detail';

const meta: Meta<typeof MemberDetail> = {
  component: MemberDetail,
  title: 'Epics/Membership/MemberDetail',
};
export default meta;
type Story = StoryObj<typeof MemberDetail>;

export const Primary: Story = {
  args: {
    member: {
      avatar:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
      name: 'Name',
      surname: 'Surname',
      nickname: 'username',
      status: 'applicant',
      commitment: 50,
      about:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat',
      spaces: [
        {
          name: 'Space name',
          logo: 'https://s3-alpha-sig.figma.com/img/43bc/b5bb/3fde1f75e375e7852efe7651b1ffe90a?Expires=1737936000&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=iPI3x2cKxy8buIlOT1uaWD9gCJky7mR-9PeouWW8KJmFWE-Zd2Axp2DjaEgNm6f3cuyVA4UW9rYxd~uWEMM8tLE1doiDCZVnFTI1lYBFMAp92Jhn5YXFOIqb5MQ7sfhWGEOOxPdkF2Q6ZPoS5KRlfCC9MQuArQVbHBMVYAouDyyzQD9Y~LLIoCR1nI0~i2ur8WvbnX968zJI4SHgEsjKE11OWzNRHL4axkRWW3V6N9Yslb3TANDUkj6A2fE-9uZnzaeHmji99v8RAog1GUOkbzICQEL2Xclok9TyM~fI0jftyq3glLtRrJsCrNQbXnMIJ9fPtytavHTA944s24YT7A__',
        },
        {
          name: 'Space name',
          logo: 'https://s3-alpha-sig.figma.com/img/43bc/b5bb/3fde1f75e375e7852efe7651b1ffe90a?Expires=1737936000&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=iPI3x2cKxy8buIlOT1uaWD9gCJky7mR-9PeouWW8KJmFWE-Zd2Axp2DjaEgNm6f3cuyVA4UW9rYxd~uWEMM8tLE1doiDCZVnFTI1lYBFMAp92Jhn5YXFOIqb5MQ7sfhWGEOOxPdkF2Q6ZPoS5KRlfCC9MQuArQVbHBMVYAouDyyzQD9Y~LLIoCR1nI0~i2ur8WvbnX968zJI4SHgEsjKE11OWzNRHL4axkRWW3V6N9Yslb3TANDUkj6A2fE-9uZnzaeHmji99v8RAog1GUOkbzICQEL2Xclok9TyM~fI0jftyq3glLtRrJsCrNQbXnMIJ9fPtytavHTA944s24YT7A__',
        },
        {
          name: 'Space name',
          logo: 'https://s3-alpha-sig.figma.com/img/43bc/b5bb/3fde1f75e375e7852efe7651b1ffe90a?Expires=1737936000&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=iPI3x2cKxy8buIlOT1uaWD9gCJky7mR-9PeouWW8KJmFWE-Zd2Axp2DjaEgNm6f3cuyVA4UW9rYxd~uWEMM8tLE1doiDCZVnFTI1lYBFMAp92Jhn5YXFOIqb5MQ7sfhWGEOOxPdkF2Q6ZPoS5KRlfCC9MQuArQVbHBMVYAouDyyzQD9Y~LLIoCR1nI0~i2ur8WvbnX968zJI4SHgEsjKE11OWzNRHL4axkRWW3V6N9Yslb3TANDUkj6A2fE-9uZnzaeHmji99v8RAog1GUOkbzICQEL2Xclok9TyM~fI0jftyq3glLtRrJsCrNQbXnMIJ9fPtytavHTA944s24YT7A__',
        },
        {
          name: 'Space name',
          logo: 'https://s3-alpha-sig.figma.com/img/43bc/b5bb/3fde1f75e375e7852efe7651b1ffe90a?Expires=1737936000&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=iPI3x2cKxy8buIlOT1uaWD9gCJky7mR-9PeouWW8KJmFWE-Zd2Axp2DjaEgNm6f3cuyVA4UW9rYxd~uWEMM8tLE1doiDCZVnFTI1lYBFMAp92Jhn5YXFOIqb5MQ7sfhWGEOOxPdkF2Q6ZPoS5KRlfCC9MQuArQVbHBMVYAouDyyzQD9Y~LLIoCR1nI0~i2ur8WvbnX968zJI4SHgEsjKE11OWzNRHL4axkRWW3V6N9Yslb3TANDUkj6A2fE-9uZnzaeHmji99v8RAog1GUOkbzICQEL2Xclok9TyM~fI0jftyq3glLtRrJsCrNQbXnMIJ9fPtytavHTA944s24YT7A__',
        },
        {
          name: 'Space name',
          logo: 'https://s3-alpha-sig.figma.com/img/43bc/b5bb/3fde1f75e375e7852efe7651b1ffe90a?Expires=1737936000&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=iPI3x2cKxy8buIlOT1uaWD9gCJky7mR-9PeouWW8KJmFWE-Zd2Axp2DjaEgNm6f3cuyVA4UW9rYxd~uWEMM8tLE1doiDCZVnFTI1lYBFMAp92Jhn5YXFOIqb5MQ7sfhWGEOOxPdkF2Q6ZPoS5KRlfCC9MQuArQVbHBMVYAouDyyzQD9Y~LLIoCR1nI0~i2ur8WvbnX968zJI4SHgEsjKE11OWzNRHL4axkRWW3V6N9Yslb3TANDUkj6A2fE-9uZnzaeHmji99v8RAog1GUOkbzICQEL2Xclok9TyM~fI0jftyq3glLtRrJsCrNQbXnMIJ9fPtytavHTA944s24YT7A__',
        },
        {
          name: 'Space name',
          logo: 'https://s3-alpha-sig.figma.com/img/43bc/b5bb/3fde1f75e375e7852efe7651b1ffe90a?Expires=1737936000&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=iPI3x2cKxy8buIlOT1uaWD9gCJky7mR-9PeouWW8KJmFWE-Zd2Axp2DjaEgNm6f3cuyVA4UW9rYxd~uWEMM8tLE1doiDCZVnFTI1lYBFMAp92Jhn5YXFOIqb5MQ7sfhWGEOOxPdkF2Q6ZPoS5KRlfCC9MQuArQVbHBMVYAouDyyzQD9Y~LLIoCR1nI0~i2ur8WvbnX968zJI4SHgEsjKE11OWzNRHL4axkRWW3V6N9Yslb3TANDUkj6A2fE-9uZnzaeHmji99v8RAog1GUOkbzICQEL2Xclok9TyM~fI0jftyq3glLtRrJsCrNQbXnMIJ9fPtytavHTA944s24YT7A__',
        },
      ],
      agreements: [
        {
          id: '1',
          slug: 'project-title-1',
          title: 'Project Title',
          creator: {
            avatar:
              'https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop',
            name: 'Name',
            surname: 'Surname',
          },
          commitment: 50,
          status: 'active',
          views: 59,
          comments: [
            {
              id: '1',
              comment:
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
              author: {
                avatar: 'https://github.com/shadcn.png',
                name: 'Name',
                surname: 'Surname',
              },
              likes: 16,
            },
            {
              id: '2',
              comment:
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
              author: {
                avatar: 'https://github.com/shadcn.png',
                name: 'Name',
                surname: 'Surname',
              },
              likes: 16,
            },
            {
              id: '3',
              comment:
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
              author: {
                avatar: 'https://github.com/shadcn.png',
                name: 'Name',
                surname: 'Surname',
              },
              likes: 16,
            },
          ],
          content:
            'irure deserunt laboris incididunt proident ea consectetur officia ipsum ad ipsum reprehenderit eiusmod id ut nostrud occaecat elit ut labore cupidatat quis commodo labore anim ad cupidatat eu proident et Lorem ut aliquip minim laboris sunt veniam do in sunt id veniam excepteur duis sit adipisicing cupidatat nulla eu et ipsum duis proident cillum ut in reprehenderit reprehenderit quis irure dolore fugiat irure voluptate anim consequat aliqua incididunt sunt ipsum dolore eu amet et laboris id ut ea ex id minim sit laboris pariatur amet anim eu et ad reprehenderit commodo aliquip aliquip sint laboris aliquip in irure aute duis',
        },
      ],
    },
    isLoading: false,
    closeUrl: '',
  },
};
