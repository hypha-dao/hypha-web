import { readFile, writeFile } from 'fs/promises';
import { generateInsertStatements } from './utils/json-to-sql';

export const jsonToSql = async (
  inputPath: string,
  outputPath: string,
  tableName: string,
) => {
  console.debug('json-to-sql', { inputPath, outputPath, tableName });

  // Read and parse JSON file
  const jsonContent = await readFile(inputPath, 'utf-8');
  const data = JSON.parse(jsonContent);

  // Generate SQL statements
  const sqlStatements = generateInsertStatements(data, { tableName });

  // Write SQL to file
  await writeFile(outputPath, sqlStatements, 'utf-8');
  console.log(`SQL statements written to ${outputPath}`);

  return sqlStatements;
};
