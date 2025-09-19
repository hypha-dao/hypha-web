import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';

const getContentValue = (contentGroups, groupLabel, contentLabel) => {
  const group = contentGroups.find(g => {
    const groupLabelContent = g.find(c => c.label === 'content_group_label');
    return groupLabelContent && groupLabelContent.value[1] === groupLabel;
  });

  if (group) {
    const content = group.find(c => c.label === contentLabel);
    if (content) {
      return content.value[1];
    }
  }
  return null;
};

// Fetch the URL mappings from the settings document
const getUrlMappings = async () => {
  try {
    const settingsDoc = await getDocument(1); // Settings document is always ID 1
    if (!settingsDoc || !settingsDoc.content_groups) {
      return {};
    }

    const urlMappings = {};
    const urlsGroup = settingsDoc.content_groups.find(group => {
      const groupLabel = group.find(c => c.label === 'content_group_label');
      return groupLabel && groupLabel.value[1] === 'urls';
    });

    if (urlsGroup) {
      urlsGroup.forEach(content => {
        if (content.label.startsWith('url_')) {
          const daoName = content.label.replace('url_', '');
          const displayName = content.value[1];
          urlMappings[daoName] = displayName;
        }
      });
    }

    return urlMappings;
  } catch (error) {
    console.error('Error fetching URL mappings:', error);
    return {};
  }
};

// Transform URL slug to human-readable name
const urlSlugToDisplayName = (slug) => {
  if (!slug) return null;
  
  // Convert common patterns to readable names
  return slug
    .replace(/-/g, ' ')           // Replace hyphens with spaces
    .replace(/dao/gi, 'DAO')      // Capitalize DAO
    .split(' ')
    .map(word => {
      // Keep certain words lowercase
      const lowercaseWords = ['of', 'the', 'and', 'in', 'on', 'at', 'to', 'for', 'with'];
      if (lowercaseWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
};

const getDocument = async (docId) => {
  try {
    const result = await rpc.get_table_rows({
      json: true,
      code: contract,
      scope: contract,
      table: 'documents',
      lower_bound: docId,
      upper_bound: docId,
      limit: 1,
    });

    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching document ${docId}:`, error);
    return null;
  }
};

const getAllDaos = async () => {
  let daos = [];
  let lower_bound = null;
  
  try {
    while (true) {
      const result = await rpc.get_table_rows({
        json: true,
        code: contract,
        scope: contract,
        table: 'daos',
        limit: 500, // Fetch in batches
        lower_bound: lower_bound,
      });
      
      daos = daos.concat(result.rows);
      
      if (result.more && result.next_key) {
        lower_bound = result.next_key;
      } else {
        break;
      }
    }
    return daos;
  } catch (error) {
    console.error('Error fetching DAOs:', error);
    return [];
  }
};

const main = async () => {
  console.log('Fetching all DAOs...');
  const allDaos = await getAllDaos();
  console.log(`Found ${allDaos.length} DAOs.`);

  console.log('Fetching URL mappings from settings...');
  const urlMappings = await getUrlMappings();
  console.log(`Found ${Object.keys(urlMappings).length} URL mappings.`);

  const daosWithNames = [];
  let processedCount = 0;
  let foundNamesCount = 0;

  console.log('Processing DAOs...');
  for (let i = 0; i < allDaos.length; i++) {
    const dao = allDaos[i];
    process.stdout.write(`- Processing DAO ${i + 1} of ${allDaos.length}: ${dao.name}...\r`);
    
    let displayName = dao.name;

    // First, check if we have a URL mapping for this DAO
    if (urlMappings[dao.name]) {
      const urlSlug = urlMappings[dao.name];
      const humanReadableName = urlSlugToDisplayName(urlSlug);
      if (humanReadableName && humanReadableName !== dao.name) {
        displayName = humanReadableName;
        foundNamesCount++;
      }
    } else {
      // Fallback: try to get name from the DAO document
      const daoDoc = await getDocument(dao.id);
      if (daoDoc && daoDoc.content_groups) {
        const possibleNames = [
          getContentValue(daoDoc.content_groups, 'details', 'dao_title'),
          getContentValue(daoDoc.content_groups, 'details', 'title'),
          getContentValue(daoDoc.content_groups, 'system', 'node_label')
        ].filter(name => name && name.trim() && name !== dao.name);

        if (possibleNames.length > 0) {
          displayName = possibleNames[0];
          foundNamesCount++;
        }
      }

      // Add a small delay to avoid hitting rate limits when fetching documents
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    daosWithNames.push({ 
      id: dao.id.toString(), // Numeric ID for API calls
      name: displayName,     // Human-readable name for display
      daoName: dao.name      // Original DAO name for reference
    });
    processedCount++;
  }
  
  process.stdout.write('\n');
  console.log(`Found human-readable names for ${foundNamesCount} out of ${processedCount} DAOs`);
  
  const outputPath = path.resolve(__dirname, './public/dao-names.json');
  fs.writeFileSync(outputPath, JSON.stringify(daosWithNames, null, 2));

  console.log(`\nSuccessfully generated DAO list at: ${outputPath}`);
};

main();
