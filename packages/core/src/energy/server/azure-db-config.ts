import 'server-only';

export type EnergyDbConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export function getEnergyDbConfigFromEnv(): EnergyDbConfig | null {
  const host = process.env.ENERGY_DB_HOST?.trim();
  const database = process.env.ENERGY_DB_DATABASE?.trim();
  const user = process.env.ENERGY_DB_USER?.trim();
  const password = process.env.ENERGY_DB_PASSWORD?.trim();
  if (!host || !database || !user || !password) return null;

  const port = Number(process.env.ENERGY_DB_PORT ?? '5432');
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

  return {
    host,
    port,
    database,
    user,
    password,
    ssl: (process.env.ENERGY_DB_SSL ?? '1') !== '0',
  };
}

export function isEnergyDbConfigured(): boolean {
  return getEnergyDbConfigFromEnv() !== null;
}
