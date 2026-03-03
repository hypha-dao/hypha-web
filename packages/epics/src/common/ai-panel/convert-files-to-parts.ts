export type FilePart = {
  type: 'file';
  mediaType: string;
  url: string;
};

export async function convertFilesToParts(files: File[]): Promise<FilePart[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<FilePart>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              type: 'file',
              mediaType: file.type,
              url: reader.result as string,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
    ),
  );
}
