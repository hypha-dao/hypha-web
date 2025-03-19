import type { Meta, StoryObj } from '@storybook/react';
import { EditPersonSection } from './edit-person-section';
import { Dispatch, SetStateAction } from 'react';
import {
  UseEditProfile,
  UseUploadThingFileUploaderReturn,
} from '../hooks/types';

const mockUseUploadThing = () =>
  ({
    isUploading: false,
    uploadedFile: null,
    setUploadedFile: ((value: string | null) =>
      console.log('setUploadedFile:', value)) as Dispatch<
      SetStateAction<string | null>
    >,
    handleDrop: async (files: File[]) => {
      console.log('handleDrop:', files);
      return Promise.resolve();
    },
  } satisfies UseUploadThingFileUploaderReturn);

const mockUseEditProfile: UseEditProfile = () => ({
  editProfile: async (data) => {
    console.log('Editing profile:', data);
    return {
      id: 1,
      slug: 'john-doe',
      name: data.name,
      surname: data.surname,
      nickname: data.nickname,
      description: data.description,
      avatarUrl: '',
      leadImageUrl: data.leadImageUrl,
    };
  },
});

const meta = {
  component: EditPersonSection,
  title: 'Epics/People/EditPersonSection',
  args: {
    isLoading: false,
    closeUrl: '#',
    avatar: '',
    name: 'John',
    surname: 'Doe',
    id: 1,
    description: 'Test description',
    nickname: 'johndoe',
    leadImageUrl: '',
    useUploadThingFileUploader: mockUseUploadThing,
    useEditProfile: mockUseEditProfile,
  },
} satisfies Meta<typeof EditPersonSection>;

export default meta;

type Story = StoryObj<typeof EditPersonSection>;

export const Default: Story = {
  args: {
    avatar: '',
    leadImageUrl: '',
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    name: '',
    surname: '',
    nickname: '',
    description: '',
    leadImageUrl: '',
  },
};
