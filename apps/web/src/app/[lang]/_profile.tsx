'use client';

import { useMe } from '@web/hooks/use-me';
import {
  generateUploadDropzone,
} from "@uploadthing/react";

import type { OurFileRouter } from "@web/app/api/uploadthing/core";

const UploadDropzone = generateUploadDropzone<OurFileRouter>();

export const Profile = () => {
  const { person } = useMe();

  return <div>
    <pre>{JSON.stringify(person, null, 2)}</pre>
    <UploadDropzone
        endpoint="imageUploader"
        onClientUploadComplete={(res) => {
          console.log("Files: ", res);
          alert("Upload Completed");
        }}
        onUploadError={(error: Error) => {
          alert(`ERROR! ${error.message}`);
        }}
      />
    </div>
};
