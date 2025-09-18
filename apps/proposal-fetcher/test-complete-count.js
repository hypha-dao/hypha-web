const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';

async function getCompleteProposalCount() {
    console.log('🎯 GETTING COMPLETE PROPOSAL COUNT FOR HYPHA DAO');
    console.log('Using contract-correct logic with high limit...');
    
    const daoId = "29983";
    
    try {
        // Use very high limit to get all data
        const result = await rpc.get_table_rows({
            json: true,
            code: contract,
            scope: contract,
            table: 'edges',
            index_position: 2,
            key_type: 'i64',
            lower_bound: daoId,
            upper_bound: daoId,
            limit: 100000, // Very high limit
        });
        
        console.log(`📊 QUERY RESULTS:`);
        console.log(`  Total edges returned: ${result.rows.length}`);
        console.log(`  Has more data: ${result.more}`);
        
        // Count each proposal edge type separately
        const edgeCounts = {
            active: result.rows.filter(edge => edge.edge_name === 'proposal').length,
            closed: result.rows.filter(edge => edge.edge_name === 'closedprops').length,
            staging: result.rows.filter(edge => edge.edge_name === 'stagingprop').length,
            passed: result.rows.filter(edge => edge.edge_name === 'passedprops').length,
            failed: result.rows.filter(edge => edge.edge_name === 'failedprops').length,
            votable: result.rows.filter(edge => edge.edge_name === 'votable').length
        };
        
        console.log(`\n📋 EDGE TYPE COUNTS:`);
        Object.entries(edgeCounts).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        
        // Based on contract logic:
        // Total proposals = active + closed + staging
        // (passed/failed are subsets of closed, votable includes everything)
        const totalProposals = edgeCounts.active + edgeCounts.closed + edgeCounts.staging;
        
        console.log(`\n🎯 ANALYSIS:`);
        console.log(`  Active proposals: ${edgeCounts.active}`);
        console.log(`  Completed proposals: ${edgeCounts.closed}`);
        console.log(`  Staging proposals: ${edgeCounts.staging}`);
        console.log(`  ─────────────────────────────────`);
        console.log(`  TOTAL PROPOSALS: ${totalProposals}`);
        
        console.log(`\n📊 VERIFICATION:`);
        console.log(`  Passed subset: ${edgeCounts.passed} (should be ≤ closed: ${edgeCounts.closed})`);
        console.log(`  Failed subset: ${edgeCounts.failed} (should be ≤ closed: ${edgeCounts.closed})`);
        console.log(`  Passed + Failed: ${edgeCounts.passed + edgeCounts.failed} vs Closed: ${edgeCounts.closed}`);
        
        if (result.more) {
            console.log(`\n⚠️  INCOMPLETE DATA: Still more edges beyond limit`);
            console.log(`   This count is a MINIMUM, actual total is higher`);
        } else {
            console.log(`\n✅ COMPLETE DATA: This is the definitive count`);
        }
        
        return {
            totalProposals,
            breakdown: edgeCounts,
            isComplete: !result.more
        };
        
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

getCompleteProposalCount().then(result => {
    if (result) {
        console.log('\n' + '='.repeat(60));
        console.log('🏆 FINAL ANSWER');
        console.log('='.repeat(60));
        console.log(`Hypha DAO has ${result.isComplete ? 'exactly' : 'at least'} ${result.totalProposals} governance proposals`);
        
        if (!result.isComplete) {
            console.log('⚠️  Note: This is a minimum count due to API limits');
        }
    }
});
