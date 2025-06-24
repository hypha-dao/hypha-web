interface SqlGeneratorOptions {
  tableName: string;
  // Add more options as needed, like schema, custom type mappings, etc.
}

export const generateInsertStatements = (
  data: Record<string, unknown>[],
  options: SqlGeneratorOptions,
): string => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Data must be a non-empty array of objects');
  }

  const { tableName } = options;
  const columns = Object.keys(data[0]);

  const statements = data.map((row) => {
    const values = columns.map((col) => {
      const value = row[col];
      if (value === null) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'object')
        return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return value;
    });

    return `INSERT INTO ${tableName} (${columns.join(
      ', ',
    )}) VALUES (${values.join(', ')});`;
  });

  return statements.join('\n');
};
