export type FilePart = {
  type: 'file';
  mediaType: string;
  url: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function convertFilesToParts(files: File[]): Promise<FilePart[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<FilePart>((resolve, reject) => {
          if (file.size > MAX_FILE_SIZE) {
            reject(
              new Error(
                `File "${file.name}" exceeds maximum size of ${MAX_FILE_SIZE} bytes`,
              ),
            );
            return;
          }
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
