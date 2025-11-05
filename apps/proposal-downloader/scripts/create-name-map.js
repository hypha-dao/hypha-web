const fs = require('fs');
const path = require('path');

const main = async () => {
  const rawDaoListPath = path.resolve(__dirname, '../downloader-react/public/dao-list.json');
  const finalDaoListPath = path.resolve(__dirname, '../downloader-react/public/dao-names.json');
  
  const rawDaos = JSON.parse(fs.readFileSync(rawDaoListPath, 'utf8'));

  // Manual map of known DAO names
  const nameMap = {
    'hypha': 'Hypha',
    'seedscommons': 'SEEDS Commons',
    'regen.civs': 'Regen Civics',
    'originwisdom': 'Origin Wisdom',
    // Add other known DAOs here
  };

  const finalDaos = rawDaos.map(dao => {
    const readableName = nameMap[dao.name];
    return {
      id: dao.id,
      name: readableName || dao.name, // Fallback to the original name
    };
  });

  fs.writeFileSync(finalDaoListPath, JSON.stringify(finalDaos, null, 2));

  console.log(`Successfully created final DAO list at: ${finalDaoListPath}`);
};

main();
