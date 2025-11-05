const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';

async function runSingleTest(runNumber, limit) {
    console.log(`\n--- RUN ${runNumber} (limit: ${limit.toLocaleString()}) ---`);
    
    const daoId = 29983;
    
    try {
        const startTime = Date.now();
        
        const result = await rpc.get_table_rows({
            json: true,
            code: contract,
            scope: contract,
            table: 'edges',
            index_position: 2,
            key_type: 'i64',
            lower_bound: daoId.toString(),
            // NO upper_bound (this approach worked better)
            limit: limit,
        });
        
        const duration = (Date.now() - startTime) / 1000;
        
        // Filter to Hypha DAO edges only
        const hyphaEdges = result.rows.filter(edge => edge.from_node === daoId);
        
        // Count proposal-related edges
        const proposalEdges = hyphaEdges.filter(edge => 
            edge.edge_name === 'votable' ||
            edge.edge_name === 'passedprops' ||
            edge.edge_name === 'failedprops' ||
            edge.edge_name === 'closedprops' ||
            edge.edge_name === 'stagingprop' ||
            edge.edge_name === 'proposal'
        );
        
        // Breakdown
        const breakdown = {};
        proposalEdges.forEach(edge => {
            breakdown[edge.edge_name] = (breakdown[edge.edge_name] || 0) + 1;
        });
        
        console.log(`  Query time: ${duration.toFixed(2)}s`);
        console.log(`  Total edges: ${result.rows.length}, Has more: ${result.more}`);
        console.log(`  Hypha edges: ${hyphaEdges.length}`);
        console.log(`  Proposal edges: ${proposalEdges.length}`);
        console.log(`  Breakdown: ${Object.entries(breakdown).map(([k,v]) => `${k}:${v}`).join(', ')}`);
        
        return {
            totalEdges: result.rows.length,
            hyphaEdges: hyphaEdges.length,
            proposalEdges: proposalEdges.length,
            breakdown,
            hasMore: result.more,
            duration
        };
        
    } catch (error) {
        console.log(`  ERROR: ${error.message}`);
        return null;
    }
}

async function testConsistency() {
    console.log('🧪 TESTING CONSISTENCY WITH MULTIPLE RUNS');
    console.log('Running the same query multiple times to check for consistent results');
    console.log('Target: ~1200 proposals for Hypha DAO');
    console.log('=' * 70);
    
    const limit = 100000; // Use the limit that gave best results
    const numRuns = 5;
    
    const results = [];
    
    for (let i = 1; i <= numRuns; i++) {
        const result = await runSingleTest(i, limit);
        if (result) {
            results.push(result);
        }
        
        // Small delay between runs
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 CONSISTENCY ANALYSIS');
    console.log('='.repeat(70));
    
    if (results.length === 0) {
        console.log('❌ No successful results');
        return;
    }
    
    // Analyze consistency
    const proposalCounts = results.map(r => r.proposalEdges);
    const hyphaEdgeCounts = results.map(r => r.hyphaEdges);
    const totalEdgeCounts = results.map(r => r.totalEdges);
    
    console.log(`\nProposal edge counts across ${numRuns} runs:`);
    proposalCounts.forEach((count, i) => {
        console.log(`  Run ${i + 1}: ${count} proposals`);
    });
    
    const minProposals = Math.min(...proposalCounts);
    const maxProposals = Math.max(...proposalCounts);
    const avgProposals = Math.round(proposalCounts.reduce((a, b) => a + b, 0) / proposalCounts.length);
    
    console.log(`\n📈 STATISTICS:`);
    console.log(`  Minimum: ${minProposals}`);
    console.log(`  Maximum: ${maxProposals}`);
    console.log(`  Average: ${avgProposals}`);
    console.log(`  Variance: ${maxProposals - minProposals}`);
    console.log(`  Target: 1200`);
    console.log(`  Distance from target: ${Math.abs(avgProposals - 1200)}`);
    
    if (maxProposals - minProposals === 0) {
        console.log(`\n✅ PERFECTLY CONSISTENT: All runs returned exactly ${minProposals} proposals`);
    } else if (maxProposals - minProposals < 10) {
        console.log(`\n✅ HIGHLY CONSISTENT: Variance of only ${maxProposals - minProposals} proposals`);
    } else {
        console.log(`\n⚠️  INCONSISTENT: Variance of ${maxProposals - minProposals} proposals`);
        console.log(`   This suggests the API is not deterministic`);
    }
    
    // Check if all runs had more data
    const allHaveMore = results.every(r => r.hasMore);
    if (allHaveMore) {
        console.log(`\n⚠️  ALL RUNS HAD MORE DATA: Need even higher limits`);
    }
    
    console.log(`\n🎯 RECOMMENDATION:`);
    if (maxProposals - minProposals < 10) {
        console.log(`Use ${avgProposals} as the expected proposal count`);
        console.log(`Update React app to use: no upper_bound, limit: ${limit}`);
    } else {
        console.log(`Results are too inconsistent - need different approach`);
    }
}

testConsistency();
