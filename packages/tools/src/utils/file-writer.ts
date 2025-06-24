import { writeFile } from 'fs/promises';

export interface WriteJsonOptions {
  spaces?: number;
  silent?: boolean;
}

export const writeJson = async (
  outputPath: string,
  data: unknown,
  options: WriteJsonOptions = {},
) => {
  const { spaces = 2, silent = false } = options;
  await writeFile(outputPath, JSON.stringify(data, null, spaces));

  if (!silent) {
    console.log(`Data written to ${outputPath}`);
  }
};
