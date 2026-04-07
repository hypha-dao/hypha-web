const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

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
  console.log(`Found ${allDaos.length} DAOs. Fetching details...`);

  const daosWithNames = [];

  for (let i = 0; i < allDaos.length; i++) {
    const dao = allDaos[i];
    process.stdout.write(`- Processing DAO ${i + 1} of ${allDaos.length}: ${dao.name}...\r`);
    
    const daoDoc = await getDocument(dao.id);
    let displayName = dao.name;

    if (daoDoc) {
      displayName = getContentValue(daoDoc.content_groups, 'details', 'name') || 
                    getContentValue(daoDoc.content_groups, 'details', 'dao_name') ||
                    dao.name;
    }
    
    daosWithNames.push({ id: dao.id, name: displayName });

    // Add a small delay to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 50)); 
  }
  
  process.stdout.write('\n');
  
  const outputPath = path.resolve(__dirname, '../../../downloader-react/public/dao-list.json');
  fs.writeFileSync(outputPath, JSON.stringify(daosWithNames, null, 2));

  console.log(`\nSuccessfully generated DAO list at: ${outputPath}`);
};

main();
