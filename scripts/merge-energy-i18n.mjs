#!/usr/bin/env node
/**
 * Merges the Energy i18n namespace into all locale message files.
 * Locale strings live in scripts/energy-i18n/{locale}.json.
 * Run from repo root: node scripts/merge-energy-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, '../packages/i18n/src/messages');
const energyDir = join(__dirname, 'energy-i18n');

const agreementFlowEnergyLabels = {
  en: {
    enableEnergyCommunity: 'Enable Energy Community',
    energySharing: 'Energy Sharing',
    registerEnergySource: 'Register Energy Source',
    addEnergyMember: 'Add Energy Member',
    changeEnergyOptimization: 'Change Energy Optimization',
    whitelistEnergySettlement: 'Whitelist Energy Settlement',
  },
  de: {
    enableEnergyCommunity: 'Energiegemeinschaft aktivieren',
    energySharing: 'Energie teilen',
    registerEnergySource: 'Energiequelle registrieren',
    addEnergyMember: 'Energiemitglied hinzufügen',
    changeEnergyOptimization: 'Energieoptimierung ändern',
    whitelistEnergySettlement: 'Energieabrechnung whitelisten',
  },
  pt: {
    enableEnergyCommunity: 'Ativar comunidade de energia',
    energySharing: 'Compartilhar energia',
    registerEnergySource: 'Registrar fonte de energia',
    addEnergyMember: 'Adicionar membro de energia',
    changeEnergyOptimization: 'Alterar otimização de energia',
    whitelistEnergySettlement: 'Whitelist de liquidação de energia',
  },
  es: {
    enableEnergyCommunity: 'Activar comunidad energética',
    energySharing: 'Compartir energía',
    registerEnergySource: 'Registrar fuente de energía',
    addEnergyMember: 'Añadir miembro de energía',
    changeEnergyOptimization: 'Cambiar optimización energética',
    whitelistEnergySettlement: 'Lista blanca de liquidación energética',
  },
  fr: {
    enableEnergyCommunity: 'Activer la communauté énergétique',
    energySharing: "Partage d'énergie",
    registerEnergySource: "Enregistrer une source d'énergie",
    addEnergyMember: 'Ajouter un membre énergie',
    changeEnergyOptimization: "Modifier l'optimisation énergétique",
    whitelistEnergySettlement: 'Liste blanche de règlement énergétique',
  },
  mk: {
    enableEnergyCommunity: 'Активирај енергетска заедница',
    energySharing: 'Споделување енергија',
    registerEnergySource: 'Регистрирај енергетски извор',
    addEnergyMember: 'Додај енергетски член',
    changeEnergyOptimization: 'Промени енергетска оптимизација',
    whitelistEnergySettlement: 'Whitelist на енергетско порамнување',
  },
  nl: {
    enableEnergyCommunity: 'Schakel de Energiegemeenschap in',
    energySharing: 'Energie delen',
    registerEnergySource: 'Registreer energiebron',
    addEnergyMember: 'Energielid toevoegen',
    changeEnergyOptimization: 'Verander energieoptimalisatie',
    whitelistEnergySettlement: 'Energieafwikkeling op de witte lijst',
  },
};

const commonEnergyLabel = {
  en: 'Energy',
  de: 'Energie',
  pt: 'Energia',
  es: 'Energía',
  fr: 'Énergie',
  mk: 'Енергија',
  nl: 'Energie',
};

for (const locale of ['en', 'de', 'pt', 'es', 'fr', 'mk', 'nl']) {
  const filePath = join(messagesDir, `${locale}.json`);
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const energyPath = join(energyDir, `${locale}.json`);
  data.Energy = JSON.parse(readFileSync(energyPath, 'utf8'));

  if (!data.Common.Energy) {
    data.Common.Energy = commonEnergyLabel[locale];
  }

  const labels = agreementFlowEnergyLabels[locale];
  data.AgreementFlow ??= {};
  data.AgreementFlow.labels ??= {};
  Object.assign(data.AgreementFlow.labels, labels);

  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Updated ${locale}.json`);
}
