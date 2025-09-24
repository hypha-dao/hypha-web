import {
  Person,
  FilterParams,
  PaginationMetadata,
  Space,
} from '@hypha-platform/core/client';

export type UseMeReturn = {
  person: Person | undefined;
  isLoading: boolean;
};
export type UseMe = () => UseMeReturn;

export type UseMembersReturn = {
  persons: {
    data: Person[];
    pagination?: PaginationMetadata;
  };
  spaces: {
    data: Space[];
    pagination?: PaginationMetadata;
  };
  isLoading: boolean;
};

export type UseMembersProps = {
  page?: number;
  filter?: FilterParams<Person>;
  spaceSlug?: string;
  searchTerm?: string;
  refreshInterval?: number;
};

export type UseMembers = (props: UseMembersProps) => UseMembersReturn;

export type UseMemberSpacesReturn = {
  members: Person[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};
export type UseMemberSpaces = () => UseMemberSpacesReturn;

export type EditProfileData = {
  name: string;
  surname: string;
  nickname: string;
  description: string;
  leadImageUrl: string;
  id: number | null;
};

export interface UseUploadThingFileUploaderProps {
  onUploadComplete?: (url: string) => void;
}

export type UseUploadThingFileUploaderReturn = {
  isUploading: boolean;
  uploadedFile: string | null;
  setUploadedFile: (file: string | null) => void;
  handleDrop: (files: File[]) => Promise<void>;
};

export type UseUploadThingFileUploader = (
  props: UseUploadThingFileUploaderProps,
) => UseUploadThingFileUploaderReturn;
