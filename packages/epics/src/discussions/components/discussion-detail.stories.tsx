import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';
import { DiscussionDetail } from './discussion-detail';

const meta: Meta<typeof DiscussionDetail> = {
  component: DiscussionDetail,
  title: 'Epics/Discussions/DiscussionDetail',
};
export default meta;
type Story = StoryObj<typeof DiscussionDetail>;

export const Primary: Story = {
  args: {
    creator: {
      avatar: 'https://github.com/shadcn.png',
      name: 'John',
      surname: 'Doe',
    },
    title: 'Discussion Title',
    isLoading: false,
    content:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum./bLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    messages: [
      {
        creator: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        date: '2024/09/24',
        replies: [],
      },
      {
        creator: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        date: '2024/09/24',
        replies: [
          {
            creator: {
              avatar: 'https://github.com/shadcn.png',
              name: 'Name',
              surname: 'Surname',
            },
            message:
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            date: '2024/09/24',
            replies: [],
          },
        ],
      },
      {
        creator: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        date: '2024/09/24',
        replies: [],
      },
      {
        creator: {
          avatar: 'https://github.com/shadcn.png',
          name: 'John',
          surname: 'Doe',
        },
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        date: '2024/09/24',
        replies: [],
      },
    ],
    image:
      'https://s3-alpha-sig.figma.com/img/c889/6f0a/3adc833b2ffa10c90cbad7d66cf542cc?Expires=1736121600&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=LgIpT47FbgZcRP-ySpC5UFVkhib1vaupivEJJCW3Ovg9zqYMkLzUZihdkVZopGQaRfC4Jk8f9wJCjTpdRdiC3y5U3I3Hq32EAP~HVVcKjKmfBWfgn2a1i6b~ZJk0nHv28eZfcgKRD8HImTrwX1SbTNb9IG38NwEx-nhYUHb4bbH3llwS7XwcBzpwiQK2do4tWSba~hToD5Q4ids0pL9b1qHQRmPp1DAkR1pxaUUH-bBFxlhXeTcwgl-w4-z457L~Eas4orcllKNjj4K38s4AMW09QTtDMxpt9XQgNvOxuEYaT8P1v7ySYh1oALxs8IxDWJsfzZmjudZCgPH~82-YZA__',
  },
};
