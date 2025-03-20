import type { Meta, StoryObj } from '@storybook/react';
import { EditPersonSection } from './edit-person-section';
import { Dispatch, SetStateAction } from 'react';
import {
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

const meta = {
  component: EditPersonSection,
  title: 'Epics/People/EditPersonSection',
  args: {
    person: {
      avatarUrl: '',
      name: 'John',
      surname: 'Doe',
      id: 1,
      description: 'Test description',
      nickname: 'johndoe',
      leadImageUrl: '',
    },
    isLoading: false,
    closeUrl: '#',
    
    useUploadThingFileUploader: mockUseUploadThing,
  },
} satisfies Meta<typeof EditPersonSection>;

export default meta;

type Story = StoryObj<typeof EditPersonSection>;

export const Default: Story = {
  args: {
    person: {
      avatarUrl: '',
      name: 'John',
      surname: 'Doe',
      id: 1,
      description: 'Test description',
      nickname: 'johndoe',
      leadImageUrl: '',
    },
    isLoading: false,
    closeUrl: '#',
    
    useUploadThingFileUploader: mockUseUploadThing,
  },
};
