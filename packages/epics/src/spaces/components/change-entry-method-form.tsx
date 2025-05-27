'use client';

import { useParams } from "next/navigation";

interface ChangeEntryMethodFormProps {
  successfulUrl: string;
}

export const ChangeEntryMethodForm = ({
  successfulUrl,
}: ChangeEntryMethodFormProps) => {
  const { lang, id } = useParams();

  return (
    <></>
  );
};
