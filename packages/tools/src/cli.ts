#!/usr/bin/env node

import { Command } from 'commander';
import { daosToJson } from './dao-to-json';
import { jsonToSql } from './json-to-sql';

const program = new Command();

program
  .name('hypha-tools')
  .description('CLI tools for Hypha platform')
  .version('0.0.1');

program
  .command('dao-to-json')
  .description('Export DAOs to JSON format')
  .requiredOption('-o, --output <path>', 'output file path')
  .action(async (options) => {
    try {
      await daosToJson(options.output);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('json-to-sql')
  .description('Convert JSON file to SQL INSERT statements')
  .requiredOption('-i, --input <path>', 'input JSON file path')
  .requiredOption('-o, --output <path>', 'output SQL file path')
  .requiredOption('-t, --table <name>', 'target table name')
  .action(async (options) => {
    try {
      await jsonToSql(options.input, options.output, options.table);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();
