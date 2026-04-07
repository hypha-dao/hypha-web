const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');
const fs = require('fs');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';

// Helper function to parse content groups and get a specific value
function getContentValue(contentGroups, groupLabel, contentLabel) {
    const group = contentGroups.find(g => {
        const groupLabelContent = g.find(c => c.label === 'content_group_label');
        return groupLabelContent && groupLabelContent.value[1] === groupLabel;
    });

    if (group) {
        const content = group.find(c => c.label === contentLabel);
        if (content) {
            // value is an array where the second element is the actual value
            return content.value[1];
        }
    }
    return null;
}

async function getDaos(limit = 3) {
    const result = await rpc.get_table_rows({
        json: true,
        code: contract,
        scope: contract,
        table: 'daos',
        limit: limit,
    });
    return result.rows;
}

async function getProposalsForDao(daoId) {
    const result = await rpc.get_table_rows({
        json: true,
        code: contract,
        scope: contract,
        table: 'edges',
        index_position: 2, // byfrom index
        key_type: 'i64',
        lower_bound: daoId,
        upper_bound: daoId,
        limit: 5000, // Increased to handle large DAOs like Hypha
    });

    const proposalEdges = result.rows.filter(edge => 
        edge.edge_name === 'stagingprop' || 
        edge.edge_name === 'closedprops' || 
        edge.edge_name === 'passedprops' ||
        edge.edge_name === 'failedprops' ||
        edge.edge_name === 'votable' // Active proposals being voted on
    );
    
    const proposals = [];
    for (const edge of proposalEdges) {
        const proposalDoc = await getDocument(edge.to_node);
        if (proposalDoc) {
            proposals.push(proposalDoc);
        }
    }
    return proposals;
}

async function getDocument(docId) {
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
}

async function main() {
    try {
        console.log('Fetching up to 50 DAOs to find 3 with proposals...');
        const daos = await getDaos(50); // Fetch a larger batch of DAOs

        if (daos.length === 0) {
            console.log('No DAOs found.');
            return;
        }

        const daosWithProposals = [];
        const allProposals = [];

        console.log(`Checking ${daos.length} DAOs for proposals...`);
        for (const dao of daos) {
            process.stdout.write(`- Checking DAO: ${dao.name}...\r`);
            const proposals = await getProposalsForDao(dao.id);
            if (proposals.length > 0) {
                daosWithProposals.push({ dao, proposals });

                proposals.forEach(proposal => {
                    const title = getContentValue(proposal.content_groups, 'details', 'title') || getContentValue(proposal.content_groups, 'details', 'ballot_title') || 'No Title';
                    const description = getContentValue(proposal.content_groups, 'details', 'description') || getContentValue(proposal.content_groups, 'details', 'ballot_description') || 'No Description';
                    const state = getContentValue(proposal.content_groups, 'details', 'state') || 'No State';
                    const proposer = proposal.creator;
                    const creationDate = proposal.created_date;
                    const proposalType = getContentValue(proposal.content_groups, 'system', 'type') || 'N/A';
                    const expirationDate = getContentValue(proposal.content_groups, 'ballot', 'expiration') || 'N/A';
                    const url = getContentValue(proposal.content_groups, 'details', 'url') || '';
                    
                    // Sanitize for CSV
                    const sanitizedTitle = `"${title.replace(/"/g, '""')}"`;
                    const sanitizedDescription = `"${description.replace(/\n/g, ' ').replace(/"/g, '""')}"`;

                    allProposals.push({
                        daoId: dao.id,
                        daoName: dao.name,
                        proposalId: proposal.id,
                        proposer,
                        creationDate,
                        proposalType,
                        expirationDate,
                        title: sanitizedTitle,
                        description: sanitizedDescription,
                        url,
                        state
                    });
                });

                if (daosWithProposals.length >= 3) {
                    break; // Found 3, so we can stop searching
                }
            }
        }
        process.stdout.write('\n'); // New line after the progress indicator

        if (daosWithProposals.length === 0) {
            console.log(`Searched the first ${daos.length} DAOs, but none had proposals.`);
            return;
        }

        console.log(`\nFound ${daosWithProposals.length} DAOs with proposals. Displaying details and saving to CSV...\n`);

        // Display logic remains the same
        for (const { dao, proposals } of daosWithProposals) {
            console.log(`=======================================================`);
            console.log(` DAO: ${dao.name} (ID: ${dao.id})`);
            console.log(`-------------------------------------------------------`);
            console.log(`Found ${proposals.length} proposals:`);
            proposals.forEach((proposal, index) => {
                const title = getContentValue(proposal.content_groups, 'details', 'title') || getContentValue(proposal.content_groups, 'details', 'ballot_title') || 'No Title';
                const description = getContentValue(proposal.content_groups, 'details', 'description') || getContentValue(proposal.content_groups, 'details', 'ballot_description') || 'No Description';
                const state = getContentValue(proposal.content_groups, 'details', 'state') || 'No State';
                const proposer = proposal.creator;
                const creationDate = proposal.created_date;
                const proposalType = getContentValue(proposal.content_groups, 'system', 'type') || 'N/A';

                console.log(`\n  [${index + 1}] Proposal ID: ${proposal.id}`);
                console.log(`      Title: ${title}`);
                console.log(`      Proposer: ${proposer}`);
                console.log(`      Type: ${proposalType}`);
                console.log(`      Created: ${creationDate}`);
                console.log(`      State: ${state}`);
                console.log(`      Description: ${description.substring(0, 100)}...`);
            });
            console.log(`=======================================================\n`);
        }

        // Save to CSV
        const csvHeader = 'DAO ID,DAO Name,Proposal ID,Proposer,Creation Date,Type,Expiration Date,Title,Description,URL,State\n';
        const csvRows = allProposals.map(p => `${p.daoId},${p.daoName},${p.proposalId},${p.proposer},${p.creationDate},${p.proposalType},${p.expirationDate},${p.title},${p.description},${p.url},${p.state}`).join('\n');
        const csvContent = csvHeader + csvRows;

        fs.writeFileSync('proposals.csv', csvContent);
        console.log('Proposal data has been saved to proposals.csv');

    } catch (error) {
        console.error('An error occurred while fetching data:', error);
    }
}

main();
