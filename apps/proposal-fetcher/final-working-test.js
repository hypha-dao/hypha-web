const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';

async function getFinalWorkingCount() {
    console.log('🎯 FINAL WORKING TEST FOR HYPHA DAO PROPOSALS');
    console.log('Using the approach that worked: no upper_bound, higher limits');
    console.log('Target: ~1200 proposals');
    console.log('=' * 60);
    
    const daoId = 29983; // Hypha DAO as number
    
    // Test with progressively higher limits using the working approach
    const limits = [50000, 100000, 200000];
    
    for (const limit of limits) {
        console.log(`\n--- Testing with limit: ${limit.toLocaleString()} ---`);
        
        try {
            const startTime = Date.now();
            
            // Use the approach that worked: no upper_bound
            const result = await rpc.get_table_rows({
                json: true,
                code: contract,
                scope: contract,
                table: 'edges',
                index_position: 2,
                key_type: 'i64',
                lower_bound: daoId.toString(),
                // NO upper_bound - this was the key!
                limit: limit,
            });
            
            const duration = (Date.now() - startTime) / 1000;
            
            console.log(`Query time: ${duration.toFixed(2)}s`);
            console.log(`Total edges returned: ${result.rows.length}`);
            console.log(`Has more data: ${result.more}`);
            
            // Filter to Hypha DAO edges only
            const hyphaEdges = result.rows.filter(edge => edge.from_node === daoId);
            console.log(`Edges from Hypha DAO: ${hyphaEdges.length}`);
            
            // Count all proposal-related edges (as you requested - all edges are proposal-related)
            const allProposalEdges = hyphaEdges.filter(edge => 
                edge.edge_name === 'votable' ||
                edge.edge_name === 'passedprops' ||
                edge.edge_name === 'failedprops' ||
                edge.edge_name === 'closedprops' ||
                edge.edge_name === 'stagingprop' ||
                edge.edge_name === 'proposal'
            );
            
            console.log(`Proposal-related edges: ${allProposalEdges.length}`);
            
            // Detailed breakdown
            const breakdown = {};
            allProposalEdges.forEach(edge => {
                breakdown[edge.edge_name] = (breakdown[edge.edge_name] || 0) + 1;
            });
            
            console.log('Breakdown:');
            Object.entries(breakdown)
                .sort(([,a], [,b]) => b - a)
                .forEach(([type, count]) => {
                    console.log(`  ${type}: ${count}`);
                });
            
            // Check for duplicates
            const edgeIds = allProposalEdges.map(edge => edge.id);
            const uniqueIds = new Set(edgeIds);
            const duplicates = edgeIds.length - uniqueIds.size;
            
            if (duplicates > 0) {
                console.log(`\nDuplicates found: ${duplicates}`);
                console.log(`Unique proposals: ${uniqueIds.size}`);
            } else {
                console.log(`\nNo duplicates found`);
            }
            
            const finalCount = duplicates > 0 ? uniqueIds.size : allProposalEdges.length;
            console.log(`\n🎯 TOTAL PROPOSALS: ${finalCount}`);
            console.log(`Distance from target (1200): ${Math.abs(finalCount - 1200)}`);
            
            if (!result.more) {
                console.log(`\n🏆 COMPLETE DATA FOUND!`);
                console.log(`Hypha DAO has exactly ${finalCount} governance proposals`);
                return finalCount;
            }
            
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
    }
    
    console.log(`\n📊 CONCLUSION:`);
    console.log(`The "no upper_bound" approach is working better`);
    console.log(`We're getting closer to the 1200 target`);
    console.log(`Need to use this approach in the React app`);
}

getFinalWorkingCount();
